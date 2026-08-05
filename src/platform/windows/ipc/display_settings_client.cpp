/**
 * @file src/platform/windows/ipc/display_settings_client.cpp
 */
#ifdef _WIN32

  // standard
  #include <algorithm>
  #include <array>
  #include <chrono>
  #include <cstdint>
  #include <mutex>
  #include <optional>
  #include <string>
  #include <vector>

  // local
  #include "display_settings_client.h"
  #include "src/globals.h"
  #include "src/logging.h"
  #include "src/platform/windows/ipc/pipes.h"

namespace platf::display_helper_client {

  namespace {
    constexpr int kConnectTimeoutMs = 2000;
    constexpr int kSendTimeoutMs = 5000;
    constexpr int kShutdownIpcTimeoutMs = 500;
    constexpr int kApplyResultTimeoutMs = 5000;
    constexpr int kPingAckTimeoutMs = 3000;

    bool shutdown_requested() {
      if (!mail::man) {
        return false;
      }
      try {
        auto shutdown_event = mail::man->event<bool>(mail::shutdown);
        return shutdown_event && shutdown_event->peek();
      } catch (...) {
        return false;
      }
    }

    int effective_connect_timeout() {
      return shutdown_requested() ? kShutdownIpcTimeoutMs : kConnectTimeoutMs;
    }

    int effective_send_timeout() {
      return shutdown_requested() ? kShutdownIpcTimeoutMs : kSendTimeoutMs;
    }

    int effective_ping_ack_timeout() {
      return shutdown_requested() ? kShutdownIpcTimeoutMs : kPingAckTimeoutMs;
    }

  }  // namespace

  /**
   * @brief IPC message types used by the display settings helper protocol.
   */
  enum class MsgType : uint8_t {
    Apply = 1,  ///< Apply display settings from JSON payload.
    Revert = 2,  ///< Revert display settings to the previous state.
    Reset = 3,  ///< Reset helper persistence/state (if supported).
    ExportGolden = 4,  ///< Export current OS settings as golden snapshot
    ApplyResult = 6,  ///< Helper acknowledgement for APPLY (payload: [u8 success][optional message...]).
    Disarm = 7,  ///< Cancel any pending restore/watchdog actions on the helper.
    SnapshotCurrent = 8,  ///< Save current session snapshot (rotate current->previous) without applying config.
    Ping = 0xFE,  ///< Health check message; expects a response.
    Stop = 0xFF  ///< Request helper process to terminate gracefully.
  };

  namespace {
    std::optional<bool> wait_for_apply_result_locked(platf::dxgi::INamedPipe &pipe) {
      using namespace std::chrono;

      const auto deadline = steady_clock::now() + milliseconds(kApplyResultTimeoutMs);
      std::array<uint8_t, 2048> buffer {};

      while (steady_clock::now() < deadline) {
        const auto now = steady_clock::now();
        auto remaining = duration_cast<milliseconds>(deadline - now);
        if (remaining.count() < 0) {
          remaining = milliseconds(0);
        }
        int timeout_ms = static_cast<int>(std::max<long long>(remaining.count(), 100LL));
        size_t bytes_read = 0;
        auto result = pipe.receive(buffer, bytes_read, timeout_ms);

        if (result == platf::dxgi::PipeResult::Timeout) {
          continue;
        }
        if (result != platf::dxgi::PipeResult::Success) {
          BOOST_LOG(error) << "Display helper IPC: failed waiting for APPLY result (pipe error)";
          return std::nullopt;
        }
        if (bytes_read == 0) {
          BOOST_LOG(error) << "Display helper IPC: connection closed while waiting for APPLY result";
          return std::nullopt;
        }

        const uint8_t msg_type = buffer[0];
        if (msg_type == static_cast<uint8_t>(MsgType::ApplyResult)) {
          bool success = bytes_read >= 2 && buffer[1] != 0;
          if (!success && bytes_read > 2) {
            std::string helper_msg(reinterpret_cast<const char *>(buffer.data() + 2), reinterpret_cast<const char *>(buffer.data() + bytes_read));
            BOOST_LOG(error) << "Display helper reported APPLY failure: " << helper_msg;
          }
          return success;
        }

        if (msg_type == static_cast<uint8_t>(MsgType::Ping)) {
          continue;
        }

        BOOST_LOG(debug) << "Display helper IPC: ignoring unexpected message type=" << static_cast<int>(msg_type)
                         << " while awaiting APPLY result";
      }

      BOOST_LOG(error) << "Display helper IPC: timed out waiting for APPLY result acknowledgement";
      return std::nullopt;
    }

    // Discard any frames already buffered on the pipe (e.g. Ping echoes nobody
    // read) so a subsequent echo wait can only be satisfied by a fresh response.
    void drain_stale_frames_locked(platf::dxgi::INamedPipe &pipe) {
      std::array<uint8_t, 2048> buffer {};
      size_t bytes_read = 0;
      while (pipe.receive(buffer, bytes_read, 0) == platf::dxgi::PipeResult::Success && bytes_read > 0) {
        bytes_read = 0;
      }
    }

    // The helper echoes Ping from its single, strictly-ordered command worker,
    // so receiving the echo proves the worker is alive and has processed every
    // frame sent before the ping. A wedged worker never echoes even though the
    // pipe write itself succeeds.
    bool wait_for_ping_echo_locked(platf::dxgi::INamedPipe &pipe, int timeout_ms) {
      using namespace std::chrono;

      const auto deadline = steady_clock::now() + milliseconds(timeout_ms);
      std::array<uint8_t, 2048> buffer {};

      while (steady_clock::now() < deadline) {
        const auto now = steady_clock::now();
        auto remaining = duration_cast<milliseconds>(deadline - now);
        if (remaining.count() < 0) {
          remaining = milliseconds(0);
        }
        int wait_ms = static_cast<int>(std::max<long long>(remaining.count(), 100LL));
        size_t bytes_read = 0;
        auto result = pipe.receive(buffer, bytes_read, wait_ms);

        if (result == platf::dxgi::PipeResult::Timeout) {
          continue;
        }
        if (result != platf::dxgi::PipeResult::Success || bytes_read == 0) {
          return false;
        }
        if (buffer[0] == static_cast<uint8_t>(MsgType::Ping)) {
          return true;
        }
        BOOST_LOG(debug) << "Display helper IPC: ignoring unexpected message type=" << static_cast<int>(buffer[0])
                         << " while awaiting ping echo";
      }
      return false;
    }
  }  // namespace

  static bool send_message(
    platf::dxgi::INamedPipe &pipe,
    MsgType type,
    const std::vector<uint8_t> &payload,
    std::optional<int> send_timeout_override_ms = std::nullopt
  ) {
    const bool is_ping = (type == MsgType::Ping);
    if (!is_ping) {
      BOOST_LOG(info) << "Display helper IPC: sending frame type=" << static_cast<int>(type)
                      << ", payload_len=" << payload.size();
    }
    std::vector<uint8_t> out;
    out.reserve(1 + payload.size());
    out.push_back(static_cast<uint8_t>(type));
    out.insert(out.end(), payload.begin(), payload.end());
    const int timeout_ms = send_timeout_override_ms.value_or(effective_send_timeout());
    const bool ok = pipe.send(out, timeout_ms);
    if (!is_ping) {
      BOOST_LOG(info) << "Display helper IPC: send result=" << (ok ? "true" : "false");
    }
    return ok;
  }

  // Persistent connection across a stream session. Helper stays alive until
  // successful revert; we reuse the data pipe for APPLY/REVERT.
  static std::unique_ptr<platf::dxgi::INamedPipe> &pipe_singleton() {
    static std::unique_ptr<platf::dxgi::INamedPipe> s_pipe;
    return s_pipe;
  }

  // Global mutex to serialize all access to the pipe (connect, reset, send)
  // and prevent interleaved writes on a BYTE-mode pipe.
  static std::timed_mutex &pipe_mutex() {
    static std::timed_mutex m;
    return m;
  }

  // Ensure connected while holding the pipe mutex. Returns true on success.
  static bool ensure_connected_locked(std::optional<int> connect_timeout_override_ms = std::nullopt) {
    if (shutdown_requested()) {
      return false;
    }
    auto &pipe = pipe_singleton();
    if (pipe && pipe->is_connected()) {
      return true;
    }
    BOOST_LOG(debug) << "Display helper IPC: connecting to server pipe 'sunshine_display_helper'";
    const int connect_timeout_ms = connect_timeout_override_ms.value_or(effective_connect_timeout());
    const auto connect_start = std::chrono::steady_clock::now();
    auto remaining_ms = [&]() -> int {
      const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - connect_start
      );
      const long long remaining = static_cast<long long>(connect_timeout_ms) - elapsed.count();
      return static_cast<int>(std::max<long long>(0LL, remaining));
    };

    // If we still have a pipe object (just disconnected), try reconnecting it
    // instead of recreating - avoids unnecessary factory/timeout overhead
    if (pipe) {
      pipe->wait_for_client_connection(remaining_ms());
      if (pipe->is_connected()) {
        return true;
      }
      pipe.reset();
    }

    // Create fresh pipe - try anonymous first, then named fallback
    if (remaining_ms() > 0) {
      auto creator_anon = []() -> std::unique_ptr<platf::dxgi::INamedPipe> {
        platf::dxgi::FramedPipeFactory ff(std::make_unique<platf::dxgi::AnonymousPipeFactory>());
        return ff.create_client("sunshine_display_helper");
      };
      pipe = std::make_unique<platf::dxgi::SelfHealingPipe>(creator_anon);
      if (pipe) {
        pipe->wait_for_client_connection(remaining_ms());
        if (pipe->is_connected()) {
          return true;
        }
      }
    }
    if (remaining_ms() > 0) {
      BOOST_LOG(debug) << "Display helper IPC: anonymous connect failed; trying named fallback";
      auto creator_named = []() -> std::unique_ptr<platf::dxgi::INamedPipe> {
        platf::dxgi::FramedPipeFactory ff(std::make_unique<platf::dxgi::NamedPipeFactory>());
        return ff.create_client("sunshine_display_helper");
      };
      pipe = std::make_unique<platf::dxgi::SelfHealingPipe>(creator_named);
      if (pipe) {
        pipe->wait_for_client_connection(remaining_ms());
        if (pipe->is_connected()) {
          return true;
        }
      }
    }
    BOOST_LOG(warning) << "Display helper IPC: connection failed";
    return false;
  }

  void reset_connection() {
    std::lock_guard<std::timed_mutex> lg(pipe_mutex());
    auto &pipe = pipe_singleton();
    if (pipe) {
      BOOST_LOG(debug) << "Display helper IPC: resetting cached connection";
      pipe->disconnect();
    }
    pipe.reset();
  }

  bool send_apply_json(const std::string &json) {
    BOOST_LOG(debug) << "Display helper IPC: APPLY request queued (json_len=" << json.size() << ")";
    std::unique_lock<std::timed_mutex> lk(pipe_mutex());
    if (!ensure_connected_locked()) {
      BOOST_LOG(warning) << "Display helper IPC: APPLY aborted - no connection";
      return false;
    }
    std::vector<uint8_t> payload(json.begin(), json.end());
    auto &pipe = pipe_singleton();
    if (!pipe) {
      BOOST_LOG(warning) << "Display helper IPC: APPLY aborted - no pipe instance";
      return false;
    }

    if (!send_message(*pipe, MsgType::Apply, payload)) {
      return false;
    }

    if (auto result = wait_for_apply_result_locked(*pipe)) {
      return *result;
    }

    return false;
  }

  bool send_revert(const std::string &json_payload) {
    BOOST_LOG(debug) << "Display helper IPC: REVERT request queued";
    std::unique_lock<std::timed_mutex> lk(pipe_mutex());
    if (!ensure_connected_locked()) {
      BOOST_LOG(warning) << "Display helper IPC: REVERT aborted - no connection";
      return false;
    }
    std::vector<uint8_t> payload(json_payload.begin(), json_payload.end());
    auto &pipe = pipe_singleton();
    if (!pipe) {
      return false;
    }
    drain_stale_frames_locked(*pipe);
    if (!send_message(*pipe, MsgType::Revert, payload)) {
      return false;
    }
    // The command worker processes frames in order, so a Ping echo arriving
    // after the REVERT frame proves the handler accepted and scheduled the
    // restore. The helper performs the restore asynchronously after its grace
    // period, so this does not prove that display state was restored.
    if (!send_message(*pipe, MsgType::Ping, {})) {
      BOOST_LOG(warning) << "Display helper IPC: REVERT written but follow-up ping could not be sent";
      return false;
    }
    const int ack_timeout_ms = shutdown_requested() ? kShutdownIpcTimeoutMs : kApplyResultTimeoutMs;
    if (wait_for_ping_echo_locked(*pipe, ack_timeout_ms)) {
      BOOST_LOG(info) << "Display helper IPC: REVERT accepted and restore scheduled by helper worker";
      return true;
    }
    BOOST_LOG(warning) << "Display helper IPC: REVERT written but helper worker did not acknowledge within "
                       << ack_timeout_ms << "ms";
    return false;
  }

  bool send_export_golden(const std::string &json_payload) {
    BOOST_LOG(debug) << "Display helper IPC: EXPORT_GOLDEN request queued";
    std::unique_lock<std::timed_mutex> lk(pipe_mutex());
    if (!ensure_connected_locked()) {
      BOOST_LOG(warning) << "Display helper IPC: EXPORT_GOLDEN aborted - no connection";
      return false;
    }
    std::vector<uint8_t> payload(json_payload.begin(), json_payload.end());
    auto &pipe = pipe_singleton();
    if (pipe && send_message(*pipe, MsgType::ExportGolden, payload)) {
      return true;
    }
    return false;
  }

  bool send_reset() {
    BOOST_LOG(debug) << "Display helper IPC: RESET request queued";
    std::unique_lock<std::timed_mutex> lk(pipe_mutex());
    if (!ensure_connected_locked()) {
      BOOST_LOG(warning) << "Display helper IPC: RESET aborted - no connection";
      return false;
    }
    std::vector<uint8_t> payload;
    auto &pipe = pipe_singleton();
    if (pipe && send_message(*pipe, MsgType::Reset, payload)) {
      return true;
    }
    return false;
  }

  bool send_disarm_restore() {
    BOOST_LOG(info) << "Display helper IPC: DISARM request queued";
    std::unique_lock<std::timed_mutex> lk(pipe_mutex());
    if (!ensure_connected_locked()) {
      BOOST_LOG(warning) << "Display helper IPC: DISARM aborted - no connection";
      return false;
    }
    std::vector<uint8_t> payload;
    auto &pipe = pipe_singleton();
    if (pipe && send_message(*pipe, MsgType::Disarm, payload)) {
      return true;
    }
    return false;
  }

  bool send_disarm_restore_fast(int timeout_ms) {
    BOOST_LOG(debug) << "Display helper IPC: DISARM (fast) request queued (timeout_ms=" << timeout_ms << ")";
    // The fast path has a hard TOTAL time budget, and send_revert can now hold
    // the pipe mutex for up to 5s while awaiting its echo. Lock acquisition,
    // connect, and send all draw from the same deadline instead of each getting
    // the full budget.
    using namespace std::chrono;
    const auto deadline = steady_clock::now() + milliseconds(timeout_ms);
    auto remaining_ms = [&]() -> int {
      const auto left = duration_cast<milliseconds>(deadline - steady_clock::now()).count();
      return static_cast<int>(std::max<long long>(0LL, left));
    };
    std::unique_lock<std::timed_mutex> lk(pipe_mutex(), std::defer_lock);
    if (!lk.try_lock_for(milliseconds(timeout_ms))) {
      BOOST_LOG(debug) << "Display helper IPC: DISARM (fast) skipped - pipe busy beyond budget";
      return false;
    }
    if (!ensure_connected_locked(remaining_ms())) {
      return false;
    }
    std::vector<uint8_t> payload;
    auto &pipe = pipe_singleton();
    if (pipe && send_message(*pipe, MsgType::Disarm, payload, std::max(remaining_ms(), 1))) {
      return true;
    }
    return false;
  }

  bool send_snapshot_current(const std::string &json_payload) {
    BOOST_LOG(debug) << "Display helper IPC: SNAPSHOT_CURRENT request queued";
    std::unique_lock<std::timed_mutex> lk(pipe_mutex());
    if (!ensure_connected_locked()) {
      BOOST_LOG(warning) << "Display helper IPC: SNAPSHOT_CURRENT aborted - no connection";
      return false;
    }
    std::vector<uint8_t> payload(json_payload.begin(), json_payload.end());
    auto &pipe = pipe_singleton();
    if (pipe && send_message(*pipe, MsgType::SnapshotCurrent, payload)) {
      return true;
    }
    return false;
  }

  bool send_stop() {
    BOOST_LOG(info) << "Display helper IPC: STOP request queued";
    std::unique_lock<std::timed_mutex> lk(pipe_mutex());
    if (!ensure_connected_locked()) {
      BOOST_LOG(warning) << "Display helper IPC: STOP aborted - no connection";
      return false;
    }
    std::vector<uint8_t> payload;
    auto &pipe = pipe_singleton();
    if (pipe && send_message(*pipe, MsgType::Stop, payload)) {
      return true;
    }
    return false;
  }

  bool send_ping() {
    // No logging for ping path to reduce log spam
    std::unique_lock<std::timed_mutex> lk(pipe_mutex());
    if (!ensure_connected_locked()) {
      return false;
    }
    std::vector<uint8_t> payload;
    auto &pipe = pipe_singleton();
    if (!pipe) {
      return false;
    }
    drain_stale_frames_locked(*pipe);
    if (!send_message(*pipe, MsgType::Ping, payload)) {
      return false;
    }
    return wait_for_ping_echo_locked(*pipe, effective_ping_ack_timeout());
  }
}  // namespace platf::display_helper_client

#endif

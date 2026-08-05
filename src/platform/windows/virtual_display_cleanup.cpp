#include "virtual_display_cleanup.h"

#ifdef _WIN32

  #include "display_helper_integration.h"
  #include "src/logging.h"
  #include "src/platform/windows/impersonating_display_device.h"
  #include "src/platform/windows/virtual_display.h"

  #include <algorithm>
  #include <atomic>
  #include <chrono>
  #include <display_device/windows/win_api_layer.h>
  #include <display_device/windows/win_display_device.h>
  #include <exception>
  #include <memory>
  #include <string>
  #include <thread>

// Forward-declared to avoid pulling in process.h (heavy/circular include). Defined in
// src/process.cpp — releases the SudoVDA driver when no stream is active + host not headless.
namespace proc {
  void release_idle_vdisplay();
}

// Forward-declared to avoid pulling in the rtsp/webrtc headers here (same rationale
// as proc above). Defined in src/rtsp.cpp and src/webrtc_stream.cpp.
namespace rtsp_stream {
  int session_count();
}

namespace webrtc_stream {
  bool has_active_sessions();
}

namespace platf::virtual_display_cleanup {
  namespace {
    bool has_active_virtual_display() {
      const auto virtual_displays = VDISPLAY::enumerateSudaVDADisplays();
      return std::any_of(
        virtual_displays.begin(),
        virtual_displays.end(),
        [](const VDISPLAY::SudaVDADisplayInfo &info) {
          return info.is_active;
        }
      );
    }

    std::size_t active_virtual_display_count() {
      const auto virtual_displays = VDISPLAY::enumerateSudaVDADisplays();
      return static_cast<std::size_t>(std::count_if(
        virtual_displays.begin(),
        virtual_displays.end(),
        [](const VDISPLAY::SudaVDADisplayInfo &info) {
          return info.is_active;
        }
      ));
    }

    bool wait_for_virtual_display_teardown(std::chrono::steady_clock::duration timeout) {
      constexpr auto kPollInterval = std::chrono::milliseconds(100);

      const auto deadline = std::chrono::steady_clock::now() + timeout;
      while (true) {
        const auto remaining = active_virtual_display_count();
        if (remaining == 0) {
          return true;
        }

        if (std::chrono::steady_clock::now() >= deadline) {
          BOOST_LOG(warning) << "Virtual display cleanup: teardown wait expired with "
                             << remaining << " virtual display(s) still enumerated.";
          return false;
        }

        std::this_thread::sleep_for(kPollInterval);
      }
    }

    bool restore_windows_display_database() {
      try {
        auto api = std::make_shared<display_device::WinApiLayer>();
        auto win_dd = std::make_shared<display_device::WinDisplayDevice>(api);
        auto impersonating_dd = std::make_shared<display_device::ImpersonatingDisplayDevice>(win_dd);
        return impersonating_dd->restoreMonitorSettings();
      } catch (const std::exception &e) {
        BOOST_LOG(warning) << "Virtual display cleanup: direct database restore threw exception: " << e.what();
      } catch (...) {
        BOOST_LOG(warning) << "Virtual display cleanup: direct database restore threw unknown exception.";
      }
      return false;
    }

    // Single-flight guard for the asynchronous database restore dispatched when
    // the helper failure cooldown blocks the synchronous path.
    std::atomic<bool> g_async_restore_inflight {false};
  }  // namespace

  void ensure_database_restore(
    cleanup_result_t &result,
    const bool enforce_db_restore,
    const bool helper_unavailable,
    const std::function<bool()> &synchronous_restore,
    const std::function<void()> &asynchronous_restore
  ) {
    if (!enforce_db_restore) {
      return;
    }

    if (helper_unavailable) {
      asynchronous_restore();
      return;
    }

    result.database_restore_applied = synchronous_restore();
  }

  cleanup_result_t run(
    const std::string_view reason,
    const bool enforce_db_restore,
    const revert_order_t revert_order,
    const bool prefer_golden_if_current_missing
  ) {
    cleanup_result_t result;

    const std::string reason_text = reason.empty() ? "unspecified" : std::string(reason);
    BOOST_LOG(info) << "Virtual display cleanup: begin (reason=" << reason_text
                    << ", enforce_db_restore=" << (enforce_db_restore ? "true" : "false")
                    << ", revert_order="
                    << (revert_order == revert_order_t::restore_before_remove ? "restore_before_remove" : "remove_before_restore")
                    << ")";

    const bool had_active_virtual_display = has_active_virtual_display();
    VDISPLAY::setWatchdogFeedingEnabled(false);

    const auto try_helper_revert = [&]() {
      if (!enforce_db_restore || result.helper_revert_dispatched) {
        return;
      }

      result.helper_revert_dispatched = display_helper_integration::revert(prefer_golden_if_current_missing);
    };

    if (enforce_db_restore && revert_order == revert_order_t::restore_before_remove) {
      try_helper_revert();
    }

    result.virtual_displays_removed = VDISPLAY::removeAllVirtualDisplays();
    const bool should_wait_for_teardown_before_restore =
      had_active_virtual_display &&
      enforce_db_restore &&
      (revert_order == revert_order_t::remove_before_restore || !result.helper_revert_dispatched);
    // When the helper recently failed to start, its display driver state is likely
    // wedged: the virtual display won't settle and the synchronous database restore
    // below can stall for many seconds. Fast-fail those paths so session teardown
    // stays well under the 10s hang watchdog (the helper recovery monitor and the
    // next session start reconcile the display configuration instead).
    const bool helper_unavailable = display_helper_integration::helper_recently_failed();

    if (should_wait_for_teardown_before_restore) {
      const auto kTeardownSettleTimeout = helper_unavailable ? std::chrono::milliseconds(250)
                                                             : std::chrono::milliseconds(5000);
      if (wait_for_virtual_display_teardown(kTeardownSettleTimeout)) {
        BOOST_LOG(debug) << "Virtual display cleanup: teardown settled before restore.";
      }
    }

    if (enforce_db_restore) {
      if (revert_order == revert_order_t::remove_before_restore) {
        try_helper_revert();
      }

      ensure_database_restore(
        result,
        enforce_db_restore,
        helper_unavailable,
        []() {
          // Use the same mutation barrier as stream-start APPLY/snapshot work so
          // a new session cannot modeset concurrently with the direct restore.
          std::lock_guard<std::mutex> mutation_lock(display_helper_integration::display_mutation_mutex());
          return restore_windows_display_database();
        },
        []() {
          // Skipping outright here left BOTH restore routes disabled for the whole
          // cooldown window (helper revert above + this database restore), which is
          // how the monitors stayed black on 07-31. Keep teardown fast, but run the
          // potentially-slow restore on a detached single-flight thread instead of
          // dropping it. database_restore_applied stays false: it was dispatched,
          // not applied synchronously.
          if (g_async_restore_inflight.exchange(true, std::memory_order_acq_rel)) {
            BOOST_LOG(warning) << "Virtual display cleanup: helper unavailable (failure cooldown); "
                                  "asynchronous database restore already in flight.";
            return;
          }

          BOOST_LOG(warning) << "Virtual display cleanup: helper unavailable (failure cooldown); "
                                "dispatched asynchronous database restore.";
          std::thread([]() {
            // A stream that started while this thread was being scheduled must not
            // get a modeset underneath it. apply_in_progress() flips at APPLY
            // dispatch — before the RTSP session registers, on both the helper
            // and in-process paths — and ms_since_last_apply() covers the gap
            // between an apply completing and the session registering. Together
            // with the settle-and-recheck this closes the check-then-restore
            // window down to a sliver far smaller than the seconds a session
            // start actually takes. Known accepted corner: a session that both
            // started and ended within the last 5s of a cooldown window skips
            // this restore (the recency term cannot tell it from a starting
            // one); the restore hotkey and the next session start remain the
            // recovery paths there.
            auto stream_activity = []() {
              return rtsp_stream::session_count() > 0 ||
                     webrtc_stream::has_active_sessions() ||
                     display_helper_integration::apply_in_progress() ||
                     display_helper_integration::ms_since_last_apply() < 5000 ||
                     display_helper_integration::ms_since_stream_display_start() < 30000;
            };
            bool clear = !stream_activity();
            if (clear) {
              std::this_thread::sleep_for(std::chrono::milliseconds(250));
              // Final check and restore run under the display-mutation mutex,
              // so an APPLY or SNAPSHOT_CURRENT that wins the lock first makes
              // this check see it, and one that arrives later blocks until the
              // restore has finished — true mutual exclusion, not just a
              // shrunken race window.
              std::lock_guard<std::mutex> mutation_lock(display_helper_integration::display_mutation_mutex());
              clear = !stream_activity();
              if (clear) {
                const bool restored = restore_windows_display_database();
                BOOST_LOG(info) << "Virtual display cleanup: asynchronous database restore "
                                << (restored ? "succeeded." : "failed.");
              }
            }
            if (!clear) {
              BOOST_LOG(info) << "Virtual display cleanup: asynchronous database restore skipped (stream active).";
            }
            g_async_restore_inflight.store(false, std::memory_order_release);
          }).detach();
        }
      );
    }

    BOOST_LOG(info) << "Virtual display cleanup: finished (reason=" << reason_text
                    << ", had_active_virtual_display=" << (had_active_virtual_display ? "true" : "false")
                    << ", virtual_displays_removed=" << (result.virtual_displays_removed ? "true" : "false")
                    << ", helper_revert_dispatched=" << (result.helper_revert_dispatched ? "true" : "false")
                    << ", database_restore_applied=" << (result.database_restore_applied ? "true" : "false")
                    << ")";

    // Displays are now removed and the physical display restored. Release the SudoVDA
    // driver if this host isn't headless and no client stream is active, so the host can
    // sleep — covers the disconnect / paused-then-reverted paths that skip proc::terminate().
    proc::release_idle_vdisplay();
    return result;
  }
}  // namespace platf::virtual_display_cleanup

#endif  // _WIN32

/**
 * @file src/update.cpp
 * @brief Definitions for update checking, notification, and command execution.
 */

// Windows socket headers must come first to avoid the WinSock.h / WinSock2.h
// conflict that arises when windows.h is included after Boost.Asio headers.
#ifdef _WIN32
  #ifndef WIN32_LEAN_AND_MEAN
    #define WIN32_LEAN_AND_MEAN
  #endif
  #include <winsock2.h>
  #include <windows.h>
#endif

#include "update.h"

// standard includes
#include <algorithm>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <future>
#include <sstream>
#include <thread>
#include <variant>

namespace fs = std::filesystem;

// lib includes
#include <boost/algorithm/string.hpp>
#include <nlohmann/json.hpp>

// local includes
#include "config.h"
#include "crypto.h"
#include "httpcommon.h"
#include "logging.h"
#include "nvhttp.h"  // for save_state persistence hooks
#include "platform/common.h"
#include "process.h"
#include "rtsp.h"  // for session_count
#include "system_tray.h"
#include "utility.h"
#include "version_compare.h"

using namespace std::literals;

namespace update {

  // Returns path to the pending-update marker file (lives in the same dir as apps.json).
  static fs::path pending_update_marker_path() {
    return fs::path(config::stream.file_apps).parent_path() / "pending_update.txt";
  }

  // CURL write callback: appends received data to a FILE*.
  static size_t write_to_file_cb(void *contents, size_t size, size_t nmemb, void *userp) {
    return fwrite(contents, size, nmemb, static_cast<FILE *>(userp));
  }

  // Download url to dest_path on disk. Returns true on success.
  static bool download_url_to_file(const std::string &url, const std::string &dest_path) {
    FILE *fp = fopen(dest_path.c_str(), "wb");
    if (!fp) {
      BOOST_LOG(error) << "Auto-update: cannot open dest file for writing: "sv << dest_path;
      return false;
    }

    CURL *curl = curl_easy_init();
    if (!curl) {
      fclose(fp);
      BOOST_LOG(error) << "Auto-update: CURL init failed"sv;
      return false;
    }

    struct curl_slist *headers = nullptr;
    headers = curl_slist_append(headers, "User-Agent: Sunshine-Updater/1.0");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    http::configure_curl_tls(curl);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_to_file_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, fp);

    CURLcode res = curl_easy_perform(curl);
    long code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &code);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    fclose(fp);

    if (res != CURLE_OK || code < 200 || code >= 300) {
      BOOST_LOG(error) << "Auto-update: download failed (curl="sv << res << " http="sv << code << "): "sv << url;
      fs::remove(dest_path);
      return false;
    }
    return true;
  }

  // Kick off a background download of the stable release installer.
  // Looks for the first .exe asset in the release. No-op if already downloading or downloaded.
  static void start_auto_download(const release_info_t &release) {
    if (state.download_in_progress.exchange(true)) {
      return;  // already in progress
    }
    if (!state.downloaded_version.empty() && state.downloaded_version == release.version) {
      state.download_in_progress.store(false);
      return;  // already downloaded this version
    }

    std::thread([release]() {
      auto fg = util::fail_guard([]() { state.download_in_progress.store(false); });

      // Find the Windows installer asset (.exe, not .pdb)
      std::string asset_url;
      std::string asset_name;
      std::string asset_sha256;
      for (const auto &a : release.assets) {
        if (a.name.size() > 4 &&
            a.name.substr(a.name.size() - 4) == ".exe" &&
            a.name.find(".pdb") == std::string::npos) {
          asset_url = a.download_url;
          asset_name = a.name;
          asset_sha256 = a.sha256;
          break;
        }
      }
      if (asset_url.empty()) {
        BOOST_LOG(info) << "Auto-update: no .exe asset found in release "sv << release.version << ", skipping auto-download"sv;
        return;
      }

      BOOST_LOG(info) << "Auto-update: downloading "sv << asset_name << " ("sv << release.version << ")"sv;

      fs::path dest = fs::temp_directory_path() / asset_name;
      if (!download_url_to_file(asset_url, dest.string())) {
        return;
      }

      BOOST_LOG(info) << "Auto-update: download complete → "sv << dest.string();

      // Write marker file so we apply on next restart
      auto marker = pending_update_marker_path();
      try {
        std::ofstream mf(marker);
        mf << dest.string() << "\n" << release.version << "\n" << asset_sha256 << "\n";
      } catch (...) {
        BOOST_LOG(error) << "Auto-update: failed to write marker file "sv << marker.string();
        std::error_code ec;
        fs::remove(dest, ec);  // noexcept overload — detached thread must not throw
        return;
      }

      state.downloaded_version = release.version;
      state.downloaded_path = dest.string();

      // Tray notification
#if defined SUNSHINE_TRAY && SUNSHINE_TRAY >= 1
      system_tray::tray_notify(
        "Update downloaded",
        ("Version " + release.version + " will be applied on restart").c_str(),
        nullptr);
#endif
      BOOST_LOG(info) << "Auto-update: ready to install "sv << release.version << " on next restart"sv;
    }).detach();
  }

  bool apply_pending_update_if_ready() {
#ifdef _WIN32
    auto marker = pending_update_marker_path();
    if (!fs::exists(marker)) {
      return false;
    }

    std::string installer_path, version, expected_sha256;
    try {
      std::ifstream mf(marker);
      std::getline(mf, installer_path);
      std::getline(mf, version);
      std::getline(mf, expected_sha256);
    } catch (...) {
      BOOST_LOG(warning) << "Auto-update: failed to read marker file"sv;
      fs::remove(marker);
      return false;
    }

    if (installer_path.empty() || !fs::exists(installer_path)) {
      BOOST_LOG(info) << "Auto-update: marker found but installer missing, cleaning up"sv;
      fs::remove(marker);
      return false;
    }

    // Verify the staged installer against the SHA-256 recorded from the GitHub
    // release asset before executing it elevated. This runs at the host's
    // elevated startup, so a same-user (medium-integrity) process could overwrite
    // the staged installer between download and this launch (a local TOCTOU).
    // Fail closed if the hash is missing or does not match.
    {
      std::error_code ec;
      if (expected_sha256.empty()) {
        BOOST_LOG(warning) << "Auto-update: no SHA-256 recorded for pending installer, refusing to apply"sv;
        fs::remove(installer_path, ec);
        fs::remove(marker, ec);
        return false;
      }
      std::ifstream in(installer_path, std::ios::binary);
      std::stringstream ss;
      ss << in.rdbuf();
      const std::string installer_bytes = ss.str();
      const auto actual_sha256 = util::hex(crypto::hash(installer_bytes)).to_string();
      if (!boost::iequals(actual_sha256, expected_sha256)) {
        BOOST_LOG(error) << "Auto-update: installer SHA-256 mismatch, refusing to apply (expected "sv
                         << expected_sha256 << ", got "sv << actual_sha256 << ")"sv;
        fs::remove(installer_path, ec);
        fs::remove(marker, ec);
        return false;
      }
      BOOST_LOG(info) << "Auto-update: installer SHA-256 verified"sv;
    }

    BOOST_LOG(info) << "Auto-update: applying pending update "sv << version << " from "sv << installer_path;

    // Launch installer silently. /S is the NSIS silent flag; most Sunshine-family
    // installers also accept /SILENT. We pass both for compatibility.
    std::wstring cmd = L"\"" + fs::path(installer_path).wstring() + L"\" /S /SILENT /CLOSEAPPLICATIONS";
    STARTUPINFOW si {};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION pi {};
    if (CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, FALSE, 0, nullptr, nullptr, &si, &pi)) {
      CloseHandle(pi.hProcess);
      CloseHandle(pi.hThread);
      fs::remove(marker);  // Only delete marker after confirmed launch — prevents lost marker if CreateProcessW fails
      BOOST_LOG(info) << "Auto-update: installer launched, exiting"sv;
      return true;
    }
    BOOST_LOG(error) << "Auto-update: failed to launch installer (err="sv << GetLastError() << ")"sv;
#endif
    return false;
  }


  state_t state;

  static size_t write_to_string(void *contents, size_t size, size_t nmemb, void *userp) {
    size_t total = size * nmemb;
    auto *out = static_cast<std::string *>(userp);
    out->append(static_cast<char *>(contents), total);
    return total;
  }

  bool download_github_release_data(const std::string &owner, const std::string &repo, std::string &out_json) {
    std::string url = "https://api.github.com/repos/" + owner + "/" + repo + "/releases";
    CURL *curl = curl_easy_init();
    if (!curl) {
      BOOST_LOG(error) << "CURL init failed for GitHub API"sv;
      return false;
    }
    struct curl_slist *headers = nullptr;
    headers = curl_slist_append(headers, "Accept: application/vnd.github+json");
    headers = curl_slist_append(headers, "X-GitHub-Api-Version: 2022-11-28");
    headers = curl_slist_append(headers, "User-Agent: Sunshine-Updater/1.0");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    bool tls_configured = http::configure_curl_tls(curl);
    if (!tls_configured) {
      BOOST_LOG(warning) << "GitHub release check is using libcurl defaults for TLS";
    }
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_to_string);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &out_json);
    char errbuf[CURL_ERROR_SIZE] = {0};
    curl_easy_setopt(curl, CURLOPT_ERRORBUFFER, errbuf);
    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
      BOOST_LOG(error) << "GitHub API request failed: "sv << curl_easy_strerror(res);
      if (errbuf[0] != '\0') {
        BOOST_LOG(error) << "GitHub API error detail: "sv << errbuf;
      }
      long verify_result = 0;
      if (curl_easy_getinfo(curl, CURLINFO_SSL_VERIFYRESULT, &verify_result) == CURLE_OK && verify_result != 0) {
        BOOST_LOG(error) << "TLS verification result code: "sv << verify_result;
      }
#ifdef CURLINFO_OS_ERRNO
      long os_err = 0;
      if (curl_easy_getinfo(curl, CURLINFO_OS_ERRNO, &os_err) == CURLE_OK && os_err != 0) {
        BOOST_LOG(error) << "OS-level error code: "sv << os_err;
      }
#endif
      curl_slist_free_all(headers);
      curl_easy_cleanup(curl);
      return false;
    }
    long code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &code);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    if (code < 200 || code >= 300) {
      BOOST_LOG(error) << "GitHub API returned HTTP "sv << code;
      return false;
    }
    return true;
  }

  // (removed) previous date-based comparison helper

  static void notify_new_version(const std::string &version, bool prerelease) {
#if defined SUNSHINE_TRAY && SUNSHINE_TRAY >= 1
    if (version.empty()) {
      return;
    }
    // Only notify once per version — on_stream_started() calls trigger_check(force=true) on
    // every stream, so without this guard we'd fire the same "new update" toast every session.
    if (version == state.last_notified_version) {
      return;
    }
    std::string title = prerelease ? "New update available (Pre-release)" : "New update available (Stable)";
    std::string body = "Version " + version;
    state.last_notified_version = version;
    state.last_notified_is_prerelease = prerelease;
    state.last_notified_url = prerelease ? state.latest_prerelease.url : state.latest_release.url;
    // On click, open the release page directly
    system_tray::tray_notify(title.c_str(), body.c_str(), []() {
      open_last_notified_release_page();
    });
#endif
  }

  static void perform_check() {
    state.check_in_progress = true;
    auto fg = util::fail_guard([]() {
      state.check_in_progress = false;
    });
    try {
      const bool allow_prerelease_updates = [&]() {
#ifdef PROJECT_VERSION_PRERELEASE
        const std::string installed_prerelease = PROJECT_VERSION_PRERELEASE;
        return config::sunshine.notify_pre_releases || !installed_prerelease.empty();
#else
        return config::sunshine.notify_pre_releases;
#endif
      }();
      // Fetch releases list once and compute latest stable/prerelease
      BOOST_LOG(info) << "Update check: querying GitHub releases from repo "sv
                      << SUNSHINE_REPO_OWNER << '/' << SUNSHINE_REPO_NAME;
      std::string releases_json;
      if (download_github_release_data(SUNSHINE_REPO_OWNER, SUNSHINE_REPO_NAME, releases_json)) {
        auto j = nlohmann::json::parse(releases_json);
        // Reset release info
        state.latest_release = release_info_t {};
        state.latest_prerelease = release_info_t {};

        // Track best by semver
        release_info_t best_stable;
        release_info_t best_pre;

        for (auto &rel : j) {
          const bool is_prerelease = rel.value("prerelease", false);
          const bool is_draft = rel.value("draft", false);
          if (is_draft) {
            continue;
          }

          // Parse assets for this release
          std::vector<asset_info_t> assets;
          if (rel.contains("assets") && rel["assets"].is_array()) {
            for (auto &asset : rel["assets"]) {
              asset_info_t ai;
              ai.name = asset.value("name", "");
              ai.download_url = asset.value("browser_download_url", "");
              ai.size = asset.value("size", 0);
              ai.content_type = asset.value("content_type", "");
              std::string digest = asset.value("digest", "");
              if (digest.starts_with("sha256:")) {
                ai.sha256 = digest.substr(7);
              }
              if (!ai.name.empty() && !ai.download_url.empty()) {
                assets.push_back(ai);
              }
            }
          }

          const std::string tag = rel.value("tag_name", "");
          if (!is_prerelease) {
            if (best_stable.version.empty() || version_compare::compare_semver(best_stable.version, tag) < 0) {
              best_stable.version = tag;
              best_stable.url = rel.value("html_url", "");
              best_stable.name = rel.value("name", "");
              best_stable.body = rel.value("body", "");
              best_stable.published_at = rel.value("published_at", "");
              best_stable.is_prerelease = false;
              best_stable.assets = assets;
            }
          } else if (allow_prerelease_updates) {
            if (best_pre.version.empty() || version_compare::compare_semver(best_pre.version, tag) < 0) {
              best_pre.version = tag;
              best_pre.url = rel.value("html_url", "");
              best_pre.name = rel.value("name", "");
              best_pre.body = rel.value("body", "");
              best_pre.published_at = rel.value("published_at", "");
              best_pre.is_prerelease = true;
              best_pre.assets = assets;
            }
          }
        }

        state.latest_release = best_stable;
        state.latest_prerelease = best_pre;
        if (!state.latest_release.version.empty()) {
          BOOST_LOG(info) << "Update check: latest stable tag="sv << state.latest_release.version;
        }
        if (!state.latest_prerelease.version.empty()) {
          BOOST_LOG(info) << "Update check: latest prerelease tag="sv << state.latest_prerelease.version;
        }
      }
      state.last_check_time = std::chrono::steady_clock::now();

      const std::string installed_version_tag = PROJECT_VERSION;
      const std::string latest_stable_tag = state.latest_release.version;
      const std::string latest_pre_tag = state.latest_prerelease.version;
      bool stable_available = !latest_stable_tag.empty() &&
                              (version_compare::compare_semver(installed_version_tag, latest_stable_tag) < 0);
      bool prerelease_available = allow_prerelease_updates &&
                                  !latest_pre_tag.empty() &&
                                  (version_compare::compare_semver(installed_version_tag, latest_pre_tag) < 0) &&
                                  (!latest_stable_tag.empty() ?
                                     (version_compare::compare_semver(latest_stable_tag, latest_pre_tag) < 0) :
                                     true);

      if (prerelease_available) {
        BOOST_LOG(info) << "Update check: prerelease available tag="sv << state.latest_prerelease.version
                        << ", installed="sv << installed_version_tag;
        notify_new_version(state.latest_prerelease.version, true);
        // Never auto-download prerelease builds — notification only.
      } else if (stable_available) {
        BOOST_LOG(info) << "Update check: stable available tag="sv << state.latest_release.version
                        << ", installed="sv << installed_version_tag;
        notify_new_version(state.latest_release.version, false);
        // Auto-download the stable installer in the background, but only when no
        // stream is active (we never interrupt a running session).
        if (rtsp_stream::session_count() == 0) {
          start_auto_download(state.latest_release);
        } else {
          BOOST_LOG(info) << "Auto-update download deferred: stream session is active"sv;
        }
      } else {
        BOOST_LOG(info) << "Update check (tag-based): up-to-date. installed="sv << installed_version_tag
                        << ", stable="sv << latest_stable_tag
                        << ", prerelease="sv << latest_pre_tag;
      }
    } catch (std::exception &e) {
      BOOST_LOG(warning) << "Update check failed: "sv << e.what();
    }
  }

  void trigger_check(bool force) {
    const bool in_progress = state.check_in_progress.load();
    if (in_progress) {
      BOOST_LOG(info) << "Update check trigger skipped: another check is in progress (force="sv << (force ? "true"sv : "false"sv) << ')';
      return;
    }
    if (!force && config::sunshine.update_check_interval_seconds == 0) {
      BOOST_LOG(info) << "Update check trigger skipped: checks are disabled by config (interval=0)"sv;
      return;
    }
    if (!force) {
      auto now = std::chrono::steady_clock::now();
      auto since_last = std::chrono::duration_cast<std::chrono::seconds>(now - state.last_check_time);
      if (since_last < std::chrono::seconds(config::sunshine.update_check_interval_seconds)) {
        BOOST_LOG(info) << "Update check trigger throttled: last ran "sv << since_last.count() << "s ago (interval="sv << config::sunshine.update_check_interval_seconds << 's' << ')';
        return;
      }
    }
    BOOST_LOG(info) << "Update check trigger accepted (force="sv << (force ? "true"sv : "false"sv) << ')';
    std::thread([]() {
      perform_check();
    }).detach();
  }

  // update command removed

  void on_stream_started() {
    // Kick a metadata refresh after a small delay but do not auto-execute updates while streaming.
    std::thread([]() {
      std::this_thread::sleep_for(3s);
      trigger_check(true);
    }).detach();
  }

  void periodic() {
    // Only trigger checks if no streaming sessions are active
    if (rtsp_stream::session_count() == 0) {
      trigger_check(false);
    }
  }

  void open_last_notified_release_page() {
    try {
      const std::string &url = state.last_notified_url;
      if (!url.empty()) {
        platf::open_url(url);
      }
    } catch (...) {
      // swallow errors; opening the URL is best-effort
    }
  }
}  // namespace update

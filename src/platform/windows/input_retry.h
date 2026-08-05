/**
 * @file src/platform/windows/input_retry.h
 * @brief Bounded retry helper for Windows input desktop transitions.
 */
#pragma once

namespace platf::win_input {
  template<class Inject, class SyncDesktop>
  bool inject_with_desktop_retry(Inject &&inject, SyncDesktop &&sync_desktop) {
    if (inject()) {
      return true;
    }

    if (!sync_desktop()) {
      return false;
    }

    return inject();
  }
}  // namespace platf::win_input

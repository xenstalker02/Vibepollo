/**
 * @file src/display_helper_integration.h
 * @brief Cross-platform wrapper for display helper integration. On Windows, routes to the IPC helper; on other platforms, no-ops.
 */
#pragma once

#include "src/config.h"
#include "src/display_helper_builder.h"
#include "src/rtsp.h"

#include <display_device/types.h>
#include <optional>

#ifdef _WIN32
  // Bring in the Windows implementation in the correct namespace
  #include "src/platform/windows/display_helper_integration.h"

// The Windows backend header included above already declares the full surface
// (enumerate_devices_json included), so nothing is re-declared here.

#else

namespace display_helper_integration {
  // Non-Windows: No-op implementations that allow callers to fallback to in-process logic
  inline bool apply(const DisplayApplyRequest &) {
    return false;
  }

  inline bool revert(bool = false) {
    return false;
  }

  inline bool export_golden_restore() {
    return false;
  }

  inline bool reset_persistence() {
    return false;
  }

  inline std::string enumerate_devices_json(
    [[maybe_unused]] display_device::DeviceEnumerationDetail detail = display_device::DeviceEnumerationDetail::Minimal
  ) {
    return "[]";
  }

  inline std::optional<display_device::EnumeratedDeviceList> enumerate_devices(
    [[maybe_unused]] display_device::DeviceEnumerationDetail detail = display_device::DeviceEnumerationDetail::Minimal
  ) {
    return std::nullopt;
  }
}  // namespace display_helper_integration

#endif

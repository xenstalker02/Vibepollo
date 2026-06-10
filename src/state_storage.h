#pragma once

#include <mutex>
#include <string>
#include <vector>

namespace statefile {

  const std::string &sunshine_state_path();

  const std::string &vibeshine_state_path();

  std::mutex &state_mutex();

  bool share_state_file();

  void migrate_recent_state_keys();

  /**
   * @brief Persist the snapshot exclusion device list to vibeshine_state.json.
   * @param devices List of device IDs to exclude from display snapshots.
   *
   * This is called when config is saved/applied so that the display helper
   * can read the exclusion list directly without depending on IPC from Sunshine.
   */
  void save_snapshot_exclude_devices(const std::vector<std::string> &devices);

  /**
   * @brief Load the snapshot exclusion device list from vibeshine_state.json.
   * @return The list of device IDs to exclude, or an empty vector if not found.
   */
  std::vector<std::string> load_snapshot_exclude_devices();

  /**
   * @brief Remember a Sunshine-managed virtual display device id in vibeshine_state.json.
   * @param device_id Device id of a virtual display created/resolved for a session.
   *
   * The display helper merges this list into its snapshot exclusions so virtual
   * displays are never captured into (or restored from) display baselines, even
   * when the virtual monitor uses a custom EDID the helper cannot classify.
   */
  void remember_virtual_display_device(const std::string &device_id);

  /**
   * @brief Load the remembered virtual display device ids from vibeshine_state.json.
   * @return The list of device IDs, or an empty vector if not found.
   */
  std::vector<std::string> load_virtual_display_devices();

}  // namespace statefile

#pragma once

#ifdef _WIN32

  #include <algorithm>
  #include <cctype>
  #include <set>
  #include <string>
  #include <vector>

  #include <display_device/windows/types.h>

namespace platf::display_snapshot_filter {
  struct filter_result_t {
    std::vector<std::string> excluded_device_ids;
    std::vector<std::string> temporarily_missing_device_ids;
  };

  inline std::string normalize_device_id(std::string id) {
    id.erase(id.begin(), std::find_if(id.begin(), id.end(), [](unsigned char ch) {
               return !std::isspace(ch);
             }));
    id.erase(std::find_if(id.rbegin(), id.rend(), [](unsigned char ch) {
               return !std::isspace(ch);
             }).base(),
             id.end());
    std::transform(id.begin(), id.end(), id.begin(), [](unsigned char ch) {
      return static_cast<char>(std::tolower(ch));
    });
    return id;
  }

  template<typename LayoutMap>
  filter_result_t apply_explicit_exclusions(
    display_device::DisplaySettingsSnapshot &snapshot,
    LayoutMap &layout_rotations,
    const std::vector<std::string> &excluded_device_ids,
    const std::vector<std::string> &currently_enumerated_device_ids
  ) {
    std::set<std::string> exclusions;
    for (const auto &id : excluded_device_ids) {
      exclusions.insert(normalize_device_id(id));
    }

    std::set<std::string> enumerated;
    for (const auto &id : currently_enumerated_device_ids) {
      enumerated.insert(normalize_device_id(id));
    }

    filter_result_t result;
    const auto is_excluded = [&](const std::string &id) {
      return exclusions.contains(normalize_device_id(id));
    };
    const auto note_device = [&](const std::string &id) {
      if (is_excluded(id)) {
        result.excluded_device_ids.push_back(id);
      } else if (!enumerated.contains(normalize_device_id(id))) {
        result.temporarily_missing_device_ids.push_back(id);
      }
    };

    display_device::ActiveTopology filtered_topology;
    for (const auto &group : snapshot.m_topology) {
      std::vector<std::string> filtered_group;
      for (const auto &device_id : group) {
        note_device(device_id);
        if (!is_excluded(device_id)) {
          filtered_group.push_back(device_id);
        }
      }
      if (!filtered_group.empty()) {
        filtered_topology.push_back(std::move(filtered_group));
      }
    }
    snapshot.m_topology = std::move(filtered_topology);

    const auto remove_excluded = [&](auto &values) {
      for (auto it = values.begin(); it != values.end();) {
        if (is_excluded(it->first)) {
          it = values.erase(it);
        } else {
          ++it;
        }
      }
    };
    remove_excluded(snapshot.m_modes);
    remove_excluded(snapshot.m_hdr_states);
    remove_excluded(snapshot.m_origins);
    remove_excluded(layout_rotations);

    if (!snapshot.m_primary_device.empty() && is_excluded(snapshot.m_primary_device)) {
      snapshot.m_primary_device.clear();
    }

    const auto unique_sorted = [](auto &ids) {
      std::sort(ids.begin(), ids.end());
      ids.erase(std::unique(ids.begin(), ids.end()), ids.end());
    };
    unique_sorted(result.excluded_device_ids);
    unique_sorted(result.temporarily_missing_device_ids);
    return result;
  }
}  // namespace platf::display_snapshot_filter

#endif  // _WIN32

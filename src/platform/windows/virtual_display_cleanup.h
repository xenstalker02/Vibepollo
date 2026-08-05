#pragma once

#ifdef _WIN32

  #include <functional>
  #include <string_view>

namespace platf::virtual_display_cleanup {
  enum class revert_order_t {
    remove_before_restore,
    restore_before_remove,
  };

  struct cleanup_result_t {
    bool virtual_displays_removed {false};
    bool helper_revert_dispatched {false};
    bool database_restore_applied {false};
  };

  void ensure_database_restore(
    cleanup_result_t &result,
    bool enforce_db_restore,
    bool helper_unavailable,
    const std::function<bool()> &synchronous_restore,
    const std::function<void()> &asynchronous_restore
  );

  cleanup_result_t run(
    std::string_view reason,
    bool enforce_db_restore = true,
    revert_order_t revert_order = revert_order_t::remove_before_restore,
    bool prefer_golden_if_current_missing = false
  );
}  // namespace platf::virtual_display_cleanup

#endif  // _WIN32

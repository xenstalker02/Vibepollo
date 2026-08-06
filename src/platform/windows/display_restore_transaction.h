#pragma once

#ifdef _WIN32

  #include <utility>

namespace platf::display_restore_transaction {
  template<typename SnapshotRestore, typename DatabaseRestore>
  bool run(SnapshotRestore &&snapshot_restore, DatabaseRestore &&database_restore) {
    if (std::forward<SnapshotRestore>(snapshot_restore)()) {
      return true;
    }
    return std::forward<DatabaseRestore>(database_restore)();
  }
}  // namespace platf::display_restore_transaction

#endif  // _WIN32

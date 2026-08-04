/**
 * @file tests/integration/test_hotkey_logging_order.cpp
 * @brief Keep Windows hotkey registration after logging initialization.
 */
#include "../tests_common.h"

#include <fstream>
#include <sstream>
#include <string>

namespace {
  std::string read_source(const std::string &path) {
    std::ifstream file {path};
    std::ostringstream contents;
    contents << file.rdbuf();
    return contents.str();
  }
}  // namespace

TEST(HotkeyLoggingOrder, RegistrationRunsAfterLoggingInitialization) {
  const auto main_source = read_source("src/main.cpp");
  const auto logging_init = main_source.find("logging::init(");
  const auto hotkey_registration = main_source.find("platf::hotkey::update_restore_hotkey(");

  ASSERT_NE(logging_init, std::string::npos);
  ASSERT_NE(hotkey_registration, std::string::npos);
  EXPECT_LT(logging_init, hotkey_registration);
}

TEST(HotkeyLoggingOrder, ConfigReloadStillUpdatesRegistration) {
  const auto config_source = read_source("src/config.cpp");
  const auto apply_config = config_source.find("void apply_config(");
  const auto parse_config = config_source.find("int parse(", apply_config);
  const auto reload_config = config_source.find("void apply_config_now(");
  const auto reload_end = config_source.find("void set_runtime_config_overrides(", reload_config);
  const auto hotkey_call = "platf::hotkey::update_restore_hotkey(";
  const auto hotkey_in_or_after_apply = config_source.find(hotkey_call, apply_config);
  const auto hotkey_in_or_after_reload = config_source.find(hotkey_call, reload_config);

  ASSERT_NE(apply_config, std::string::npos);
  ASSERT_NE(parse_config, std::string::npos);
  ASSERT_NE(reload_config, std::string::npos);
  ASSERT_NE(reload_end, std::string::npos);
  EXPECT_TRUE(hotkey_in_or_after_apply == std::string::npos || hotkey_in_or_after_apply >= parse_config)
    << "apply_config() runs before startup logging is initialized";
  EXPECT_TRUE(hotkey_in_or_after_reload != std::string::npos && hotkey_in_or_after_reload < reload_end)
    << "hot config reload must still update the registered shortcut";
}

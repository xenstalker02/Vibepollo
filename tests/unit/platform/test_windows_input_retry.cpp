#ifdef _WIN32

#include <gtest/gtest.h>

#include "src/platform/windows/input_retry.h"

TEST(WindowsInputRetry, DoesNotSyncWhenFirstInjectionSucceeds) {
  int injection_attempts = 0;
  int sync_attempts = 0;

  const auto injected = platf::win_input::inject_with_desktop_retry(
    [&]() {
      ++injection_attempts;
      return true;
    },
    [&]() {
      ++sync_attempts;
      return true;
    }
  );

  EXPECT_TRUE(injected);
  EXPECT_EQ(injection_attempts, 1);
  EXPECT_EQ(sync_attempts, 0);
}

TEST(WindowsInputRetry, DoesNotRetryWhenDesktopSyncFails) {
  int injection_attempts = 0;
  int sync_attempts = 0;

  const auto injected = platf::win_input::inject_with_desktop_retry(
    [&]() {
      ++injection_attempts;
      return false;
    },
    [&]() {
      ++sync_attempts;
      return false;
    }
  );

  EXPECT_FALSE(injected);
  EXPECT_EQ(injection_attempts, 1);
  EXPECT_EQ(sync_attempts, 1);
}

TEST(WindowsInputRetry, RetriesExactlyOnceAfterDesktopSync) {
  int injection_attempts = 0;
  int sync_attempts = 0;

  const auto injected = platf::win_input::inject_with_desktop_retry(
    [&]() {
      ++injection_attempts;
      return injection_attempts == 2;
    },
    [&]() {
      ++sync_attempts;
      return true;
    }
  );

  EXPECT_TRUE(injected);
  EXPECT_EQ(injection_attempts, 2);
  EXPECT_EQ(sync_attempts, 1);
}

TEST(WindowsInputRetry, StopsAfterOneFailedRetry) {
  int injection_attempts = 0;
  int sync_attempts = 0;

  const auto injected = platf::win_input::inject_with_desktop_retry(
    [&]() {
      ++injection_attempts;
      return false;
    },
    [&]() {
      ++sync_attempts;
      return true;
    }
  );

  EXPECT_FALSE(injected);
  EXPECT_EQ(injection_attempts, 2);
  EXPECT_EQ(sync_attempts, 1);
}

#endif

#include <gtest/gtest.h>
#include "src/http_origin.h"

TEST(HttpOrigin, RequiresExactHttpsAuthority) {
  EXPECT_TRUE(confighttp::same_https_origin("example.test:47990", "https://example.test:47990"));
  EXPECT_TRUE(confighttp::same_https_origin("EXAMPLE.test:443", "https://example.test"));
  EXPECT_TRUE(confighttp::same_https_origin("[::1]:47990", "https://[::1]:47990"));
  EXPECT_FALSE(confighttp::same_https_origin("example.test:47990", "https://example.test:47991"));
  EXPECT_FALSE(confighttp::same_https_origin("example.test:47990", "http://example.test:47990"));
  EXPECT_FALSE(confighttp::same_https_origin("example.test", "https://example.test.attacker.test"));
  EXPECT_FALSE(confighttp::same_https_origin("example.test", "null"));
  EXPECT_FALSE(confighttp::same_https_origin("example.test", ""));
  EXPECT_FALSE(confighttp::same_https_origin("", "https://"));
  EXPECT_FALSE(confighttp::same_https_origin("example.test/path", "https://example.test/path"));
  EXPECT_FALSE(confighttp::same_https_origin("example.test@attacker.test", "https://example.test@attacker.test"));
}

TEST(HttpOrigin, OnlyReadMethodsAreSafe) {
  EXPECT_TRUE(confighttp::safe_http_method("GET"));
  EXPECT_TRUE(confighttp::safe_http_method("HEAD"));
  EXPECT_TRUE(confighttp::safe_http_method("OPTIONS"));
  EXPECT_FALSE(confighttp::safe_http_method("POST"));
  EXPECT_FALSE(confighttp::safe_http_method("PUT"));
  EXPECT_FALSE(confighttp::safe_http_method("DELETE"));
}

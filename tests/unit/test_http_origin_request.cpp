#include <gtest/gtest.h>
#include "src/confighttp.h"
#include "src/http_auth.h"

namespace confighttp {
  bool cookie_origin_allowed(const req_https_t &request);

  namespace {
    // Build only an in-memory request through the library's session factory.
    // No socket, server instance, certificate, or connection is created.
    struct OriginRequestFactory: SimpleWeb::ServerBase<SimpleWeb::HTTPS> {
      static req_https_t make() {
        auto session = std::make_shared<Session>(4096, nullptr);
        return session->request;
      }
    };

    req_https_t cookie_request(std::string_view cookie_name = session_cookie_name) {
      auto request = OriginRequestFactory::make();
      request->method = "POST";
      request->path = "/api/quit";
      request->header.emplace("Host", "example.test:47990");
      request->header.emplace("Cookie", std::string(cookie_name) + "=fixture-not-a-live-token");
      return request;
    }
  }

  TEST(HttpOriginRequest, RejectsSiblingOriginBeforeAuthentication) {
    auto request = cookie_request();
    request->header.emplace("Origin", "https://example.test:47991");
    EXPECT_FALSE(cookie_origin_allowed(request));
    const auto result = check_auth(request);
    EXPECT_FALSE(result.ok);
    EXPECT_EQ(result.code, SimpleWeb::StatusCode::client_error_forbidden);
  }

  TEST(HttpOriginRequest, AcceptsSameOriginButRejectsAbsentAndDuplicateOrigins) {
    auto request = cookie_request();
    EXPECT_FALSE(cookie_origin_allowed(request));
    request->header.emplace("Origin", "https://example.test:47990");
    EXPECT_TRUE(cookie_origin_allowed(request));
    request->header.emplace("origin", "https://example.test:47990");
    EXPECT_FALSE(cookie_origin_allowed(request));
  }

  TEST(HttpOriginRequest, RefreshOnlyCookieRequiresOrigin) {
    auto request = cookie_request(refresh_cookie_name);
    request->path = "/api/auth/refresh";
    EXPECT_FALSE(cookie_origin_allowed(request));
    request->header.emplace("Origin", "https://example.test:47990");
    EXPECT_TRUE(cookie_origin_allowed(request));
    request->header.emplace("host", "example.test:47990");
    EXPECT_FALSE(cookie_origin_allowed(request));
  }

  TEST(HttpOriginRequest, ExplicitTokenWithoutAmbientCookiesNeedsNoOrigin) {
    auto request = OriginRequestFactory::make();
    request->method = "POST";
    request->path = "/api/config";
    request->header.emplace("Authorization", "Bearer fixture-not-a-live-token");
    EXPECT_TRUE(cookie_origin_allowed(request));
    // This tests origin admission only, never token authentication success.
  }

  TEST(HttpOriginRequest, ReadRequestsDoNotNeedOrigin) {
    auto request = cookie_request();
    request->method = "GET";
    EXPECT_TRUE(cookie_origin_allowed(request));
  }
}  // namespace confighttp

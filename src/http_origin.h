#pragma once

#include <algorithm>
#include <cctype>
#include <string>
#include <string_view>

namespace confighttp {
  // Cookies are ambient credentials. Mutating browser requests must come from
  // the same HTTPS authority (including port), not merely a same-site sibling.
  inline bool same_https_origin(std::string_view host, std::string_view origin) {
    if (host.empty() || host.find_first_of("/\\@?# \t\r\n,") != std::string_view::npos) {
      return false;
    }
    auto normalized = [](std::string_view value) {
      std::string result(value);
      std::transform(result.begin(), result.end(), result.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
      });
      if (result.size() > 4 && result.compare(result.size() - 4, 4, ":443") == 0) {
        result.resize(result.size() - 4);
      }
      return result;
    };
    return normalized(origin) == "https://" + normalized(host);
  }

  inline bool safe_http_method(std::string_view method) {
    return method == "GET" || method == "HEAD" || method == "OPTIONS";
  }
}  // namespace confighttp

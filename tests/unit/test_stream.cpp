/**
 * @file tests/unit/test_stream.cpp
 * @brief Test src/stream.*
 */

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

#include <boost/asio/error.hpp>
#include <boost/system/error_code.hpp>

namespace stream {
  std::vector<uint8_t> concat_and_insert(uint64_t insert_size, uint64_t slice_size, const std::string_view &data1, const std::string_view &data2);
  bool should_rearm_udp_receive(const boost::system::error_code &ec, bool socket_open, bool broadcast_shutdown);
}

#include "../tests_common.h"

TEST(ConcatAndInsertTests, ConcatNoInsertionTest) {
  char b1[] = {'a', 'b'};
  char b2[] = {'c', 'd', 'e'};
  auto res = stream::concat_and_insert(0, 2, std::string_view {b1, sizeof(b1)}, std::string_view {b2, sizeof(b2)});
  auto expected = std::vector<uint8_t> {'a', 'b', 'c', 'd', 'e'};
  ASSERT_EQ(res, expected);
}

TEST(ConcatAndInsertTests, ConcatLargeStrideTest) {
  char b1[] = {'a', 'b'};
  char b2[] = {'c', 'd', 'e'};
  auto res = stream::concat_and_insert(1, sizeof(b1) + sizeof(b2) + 1, std::string_view {b1, sizeof(b1)}, std::string_view {b2, sizeof(b2)});
  auto expected = std::vector<uint8_t> {0, 'a', 'b', 'c', 'd', 'e'};
  ASSERT_EQ(res, expected);
}

TEST(ConcatAndInsertTests, ConcatSmallStrideTest) {
  char b1[] = {'a', 'b'};
  char b2[] = {'c', 'd', 'e'};
  auto res = stream::concat_and_insert(1, 1, std::string_view {b1, sizeof(b1)}, std::string_view {b2, sizeof(b2)});
  auto expected = std::vector<uint8_t> {0, 'a', 0, 'b', 0, 'c', 0, 'd', 0, 'e'};
  ASSERT_EQ(res, expected);
}

TEST(UdpReceiveRearmTests, RearmsAfterRecoverableAndUnknownSocketConditions) {
  EXPECT_TRUE(stream::should_rearm_udp_receive({}, true, false));
  EXPECT_TRUE(stream::should_rearm_udp_receive(boost::asio::error::make_error_code(boost::asio::error::connection_reset), true, false));
  EXPECT_TRUE(stream::should_rearm_udp_receive(boost::asio::error::make_error_code(boost::asio::error::connection_refused), true, false));
  EXPECT_TRUE(stream::should_rearm_udp_receive(boost::asio::error::make_error_code(boost::asio::error::message_size), true, false));
  EXPECT_TRUE(stream::should_rearm_udp_receive(boost::asio::error::make_error_code(boost::asio::error::host_unreachable), true, false));
}

TEST(UdpReceiveRearmTests, StopsAfterTerminalSocketConditions) {
  EXPECT_FALSE(stream::should_rearm_udp_receive(boost::asio::error::make_error_code(boost::asio::error::operation_aborted), true, false));
  EXPECT_FALSE(stream::should_rearm_udp_receive(boost::asio::error::make_error_code(boost::asio::error::bad_descriptor), true, false));
}

TEST(UdpReceiveRearmTests, StopsWhenSocketOrBroadcastIsClosing) {
  EXPECT_FALSE(stream::should_rearm_udp_receive({}, false, false));
  EXPECT_FALSE(stream::should_rearm_udp_receive({}, true, true));
}

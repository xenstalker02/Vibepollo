/**
 * @file tests/unit/test_stream.cpp
 * @brief Test src/stream.*
 */

#include <array>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

#include <src/stream_udp_receive.h>

namespace stream {
  std::vector<uint8_t> concat_and_insert(uint64_t insert_size, uint64_t slice_size, const std::string_view &data1, const std::string_view &data2);
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

TEST(UdpReceiveEndpointsTests, SimultaneousLoopbackReceivesRetainTheirOwnSenders) {
  namespace asio = boost::asio;
  using udp = asio::ip::udp;

  asio::io_context io;
  udp::socket video_receiver {io, {asio::ip::address_v4::loopback(), 0}};
  udp::socket audio_receiver {io, {asio::ip::address_v4::loopback(), 0}};
  udp::socket video_sender {io, {asio::ip::address_v4::loopback(), 0}};
  udp::socket audio_sender {io, {asio::ip::address_v4::loopback(), 0}};
  stream::udp_receive_endpoints_t senders;
  std::array<char, 1> video_buffer {};
  std::array<char, 1> audio_buffer {};
  boost::system::error_code video_error;
  boost::system::error_code audio_error;
  std::size_t receives = 0;

  video_receiver.async_receive_from(asio::buffer(video_buffer), senders.video, [&](const auto &ec, std::size_t) {
    video_error = ec;
    ++receives;
  });
  audio_receiver.async_receive_from(asio::buffer(audio_buffer), senders.audio, [&](const auto &ec, std::size_t) {
    audio_error = ec;
    ++receives;
  });

  video_sender.send_to(asio::buffer("v", 1), video_receiver.local_endpoint());
  audio_sender.send_to(asio::buffer("a", 1), audio_receiver.local_endpoint());
  io.run();

  ASSERT_EQ(receives, 2U);
  ASSERT_FALSE(video_error);
  ASSERT_FALSE(audio_error);
  EXPECT_EQ(video_buffer[0], 'v');
  EXPECT_EQ(audio_buffer[0], 'a');
  EXPECT_EQ(senders.video, video_sender.local_endpoint());
  EXPECT_EQ(senders.audio, audio_sender.local_endpoint());
  EXPECT_NE(senders.video, senders.audio);
}

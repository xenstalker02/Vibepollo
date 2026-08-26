/**
 * @file src/stream_udp_receive.h
 * @brief Receive state shared by the stream UDP receiver and its regression tests.
 */
#pragma once

#include <boost/asio.hpp>

namespace stream {
  // Each UDP receive operation needs its own sender-endpoint storage. Asio writes
  // that endpoint asynchronously, so video and audio cannot safely share one.
  struct udp_receive_endpoints_t {
    boost::asio::ip::udp::endpoint video;
    boost::asio::ip::udp::endpoint audio;

    boost::asio::ip::udp::endpoint &for_lane(bool audio_lane) {
      return audio_lane ? audio : video;
    }
  };

  bool should_rearm_udp_receive(const boost::system::error_code &ec, bool socket_open, bool broadcast_shutdown);
}  // namespace stream

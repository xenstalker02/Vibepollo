/**
 * @file src/stream_udp_receive.h
 * @brief Receive state shared by the stream UDP receiver and its regression tests.
 */
#pragma once

#include <array>
#include <cstddef>
#include <stdexcept>
#include <utility>

#include <boost/asio.hpp>

namespace stream {
  enum class udp_receive_lane_e {
    video,
    audio,
  };

  // Each UDP receive operation needs its own sender-endpoint storage. Asio writes
  // that endpoint asynchronously, so video and audio cannot safely share one.
  class udp_receive_endpoints_t {
  public:
    template<typename ReceiveHandler>
    void async_receive_from(
      boost::asio::ip::udp::socket &socket,
      udp_receive_lane_e lane,
      boost::asio::mutable_buffer buffer,
      ReceiveHandler &&handler
    ) {
      socket.async_receive_from(buffer, endpoint_for(lane), 0, std::forward<ReceiveHandler>(handler));
    }

    const boost::asio::ip::udp::endpoint &sender(udp_receive_lane_e lane) const {
      return endpoints_[lane_index(lane)];
    }

  private:
    static std::size_t lane_index(udp_receive_lane_e lane) {
      switch (lane) {
        case udp_receive_lane_e::video:
          return 0;
        case udp_receive_lane_e::audio:
          return 1;
      }

      throw std::invalid_argument {"invalid UDP receive lane"};
    }

    boost::asio::ip::udp::endpoint &endpoint_for(udp_receive_lane_e lane) {
      return endpoints_[lane_index(lane)];
    }

    std::array<boost::asio::ip::udp::endpoint, 2> endpoints_;
  };

  bool should_rearm_udp_receive(const boost::system::error_code &ec, bool socket_open, bool broadcast_shutdown);
}  // namespace stream

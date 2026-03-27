/**
 * @file src/platform/windows/apollo_vmic.cpp
 * @brief apollo_vmic_t implementation.
 */

#include "apollo_vmic.h"
#include "src/logging.h"

using namespace std::literals;

namespace platf::audio {

  int apollo_vmic_t::init() {
    auto backend = std::make_unique<mic_write_wasapi_t>();
    backend->autodetect_patterns = {
      L"Steam Streaming Microphone",
      L"Speakers (Steam Streaming Microphone)",
    };
    backend->requested_device_name = "Steam Streaming Microphone";

    if (backend->init() != 0) {
      log_missing_driver_once();
      return -1;
    }

    speaker_backend = std::move(backend);
    return 0;
  }

  int apollo_vmic_t::write_pcm(const float *samples, std::uint32_t frame_count) {
    if (!speaker_backend) return -1;
    return speaker_backend->write_pcm(samples, frame_count);
  }

  void apollo_vmic_t::log_missing_driver_once() {
    if (!missing_driver_logged) {
      missing_driver_logged = true;
      BOOST_LOG(warning) << "[mic] Steam Streaming Microphone render endpoint not found — "
                            "is Steam running on this machine? Falling back to VB-Cable."sv;
    }
  }

}  // namespace platf::audio

// Packages
import Ffmpeg from 'fluent-ffmpeg';
// Stream
import {
	readStreamEsp32CamMonitorImg,
	readStreamEsp32CamSecurityGateImg,
} from './stream.service.js';
// Utils
import {
	handleCodecData,
	handleEnd,
	handleError,
	handleProgress,
	handleStart,
	reverseFrameSize,
} from '@/utils/ffmpeg.util.js';
// Configs
import {
	FFMPEG_PATH,
	FRAMESIZE,
	RTMP_MONITOR_URL,
	RTMP_SECURITY_GATE_URL,
} from '@/config/ffmpeg.config.js';
// Video filter config

//
// Initial ffmpeg service
//
export const ffmpegCommandSecurityGate = Ffmpeg({ priority: 0 })
  // .setFfmpegPath(FFMPEG_PATH)
  .input(readStreamEsp32CamSecurityGateImg)
  .inputOptions(["-re"])
  .withNativeFramerate()
  .withNoAudio()
  .withSize(FRAMESIZE)
  .nativeFramerate()
  .noAudio()
  .outputOptions([
    "-vf vflip",
    "-preset ultrafast",
    "-c:v libx264",
    "-b:v 2M",
    "-fps_mode auto",
    "-pix_fmt yuv420p",
    "-frame_drop_threshold -5.0",
    "-thread_queue_size 3M", // Từng gây lỗi khi chạy trong docker // spell-checker: disable-line
  ])
  .format("flv")
  .output(RTMP_SECURITY_GATE_URL)
  .on("start", handleStart)
  .on("codecData", (data: any) => handleCodecData(data))
  .on("progress", handleProgress)
  .on("end", handleEnd)
  .on("error", handleError);
// console.log(
// 	`-vf ` +
// 		//`hflip,` +
// 		`drawtext=${convertObjectConfigToString(timeFilterConfig, '=', ':')}` +
// 		`drawtext=${convertObjectConfigToString(
// 			securityGateFilterConfig,
// 			'=',
// 			':'
// 		)}`
// );

export const ffmpegCommandMonitor = Ffmpeg({ priority: 1 })
  // .setFfmpegPath(FFMPEG_PATH)
  .input(readStreamEsp32CamMonitorImg)
  .inputOptions(["-re"])
  .withNativeFramerate()
  .withNoAudio()
  .withSize(reverseFrameSize(FRAMESIZE))
  .nativeFramerate()
  .noAudio()
  .outputOptions([
    "-preset medium",
    "-c:v libx264",
    // `-vf ` +
    // 	//`hflip,` +
    // 	`drawtext=${convertObjectConfigToString(timeFilterConfig, '=', ':')},` +
    // 	`drawtext=${convertObjectConfigToString(monitorFilterConfig, '=', ':')}`,
    "-b:v 1M",
    "-fps_mode auto",
    "-pix_fmt yuv420p",
    "-frame_drop_threshold -5.0",
    // '-thread_queue_size 1M', // Từng gây lỗi khi chạy trong docker
  ])
  .format("flv")
  .output(RTMP_MONITOR_URL)
  .on("start", handleStart)
  .on("codecData", (data: any) => handleCodecData(data))
  .on("progress", handleProgress)
  .on("end", handleEnd)
  .on("error", handleError);

export const run = () => {
	ffmpegCommandSecurityGate.run();
	// ffmpegCommandMonitor.run();
};

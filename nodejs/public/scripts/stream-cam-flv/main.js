import '/public/scripts/stream-cam-flv/flv.min.js';

if (flvjs.isSupported()) {
	const videoElement = document.getElementById('my-video');
	const flvPlayer = flvjs.createPlayer({
		type: 'flv',
		url: `http://${path}/live/livestream0.flv`,
		isLive: true,
	});
	flvPlayer.attachMediaElement(videoElement);
	flvPlayer.load();
	flvPlayer.play();
}

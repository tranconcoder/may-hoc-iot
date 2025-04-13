const sendButton = document.getElementById('send');
const rfidInput = document.getElementById('rfid');
const sourceSelect = document.getElementById('source');
const captureButton = document.getElementById('capture');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

let websocket;

function connectWebSocket(source) {
	const ADDRESS = `wss://192.168.1.172:3000?source=${source}`;
	websocket = new WebSocket(ADDRESS);

	websocket.onopen = async () => {
		console.log('WebSocket connection opened');
		setInterval(() => {
			context.save();
			context.scale(-1, 1);
			context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
			context.restore();
			const imageData = canvas.toDataURL('image/jpeg');
			const binary = atob(imageData.split(',')[1]);
			const array = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				array[i] = binary.charCodeAt(i);
			}
			websocket.send(array.buffer);
		}, 1000 / 25); // Capture and send image every second
	};

	websocket.onclose = () => {
		console.log('WebSocket connection closed');
	};

	websocket.onerror = (error) => {
		console.error('WebSocket error: ', error);
	};
}

// Initial WebSocket connection
connectWebSocket(sourceSelect.value);

sourceSelect.addEventListener('change', () => {
	if (websocket) {
		websocket.close();
	}
	connectWebSocket(sourceSelect.value);
});

sendButton.addEventListener('click', () => {
	const rfid = rfidInput.value;
	fetch('https://192.168.1.172:3000/api/security-gate/auth-door', {
		method: 'POST',
		body: rfid,
	})
		.then((response) => response.json())
		.then((data) => {
			console.log('Success:', data);
		})
		.catch((error) => {
			console.error('Error:', error);
		});
});

// Get access to the camera
navigator.mediaDevices
	.getUserMedia({
		video: {
			facingMode: 'default',
			width: 640,
			height: 480,
			frameRate: 25,
		},
	})
	.then((stream) => {
		video.srcObject = stream;
		video.style.transform = 'scale(-1, 1)'; // Flip the video horizontally
	})
	.catch((err) => {
		console.error('Error accessing the camera: ', err);
		alert(
			'Camera access is required to use this feature. Please enable camera access in your browser settings.'
		);
	});

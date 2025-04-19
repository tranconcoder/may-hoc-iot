// filepath: /home/tranv/Workspace/mh-iot-new/nodejs/public/scripts/capture/main.js
// Giá trị mặc định có thể được ghi đè bởi người dùng
const DEFAULT_WEBSOCKET_URL = "172.28.31.150:3000";
const DEFAULT_API_KEY =
  "0e1f4b7dc39c63e9dbbfbf5afc2e50f9deb625507cada47b203117c82362d1d2";
const DEFAULT_CAMERA_ID = "68027ecbc11ceedc95d734df";

// DOM Elements
let startBtn,
  stopBtn,
  status,
  video,
  canvas,
  processingCanvas,
  log,
  frameCounter;
let frameRateSelect,
  qualitySelect,
  resolutionSelect,
  fpsModeSelect,
  fpsLimitContainer;
let sourceTypeSelect; // Biến cho việc chọn nguồn ghi hình
let cameraIdInput, apiKeyInput, websocketUrlInput; // Biến cho các trường nhập kết nối

// WebSocket connection
let socket = null;
let wsUrl = "";
let reconnectAttempts = 0;
let maxReconnectAttempts = Infinity; // Vô hạn số lần thử kết nối lại
let reconnectInterval = 1000; // 1 giây ban đầu
let maxReconnectInterval = 30000; // Tối đa 30 giây
let reconnectTimeoutId = null;
let isConnecting = false;

// Resolution settings
let currentResolution = {
  width: 1280,
  height: 720,
};

// Recording state
let mediaStream = null;
let isRecording = false;
let wasRecording = false; // Đánh dấu trạng thái ghi hình trước khi mất kết nối
let frameCount = 0;
let fps = 0;
let lastFpsUpdate = Date.now();
let animationFrameId = null;
let frameInterval = null;
let sendingFrame = false;

// Biến để theo dõi trạng thái hiển thị của trang
let isPageVisible = true;
let lastCaptureImage = null;

// Web Worker và các biến liên quan
let captureWorker = null;
let dedicatedWorker = null; // Worker thông thường
let useBackgroundMode = false; // Chế độ nền khi tab bị ẩn
let wakeLock = null; // Biến để giữ màn hình luôn bật
let mediaKeepAlive = null; // Giữ cho media pipeline hoạt động
let hiddenVideo = null; // Video ẩn để giữ cho trình duyệt tiếp tục xử lý media
let noSleepVideo = null; // Video chạy ngầm để ngăn browser throttling

// Các timer ID giữ cho tab hoạt động
let backgroundTimer = null;
let keepAliveTimer = null;

// Cài đặt thử nghiệm để cải thiện hiệu suất
const PERFORMANCE_MODE = {
  NORMAL: "normal", // Hiệu suất bình thường khi tab hiển thị
  BACKGROUND: "background", // Chế độ tối ưu khi tab bị ẩn
  THROTTLED: "throttled", // Chế độ tiết kiệm khi kết nối kém
  HIGH_PERFORMANCE: "high_performance", // Chế độ hiệu suất tối đa bất kể trạng thái tab
};

let currentPerformanceMode = PERFORMANCE_MODE.NORMAL;

// Initialize DOM elements when the page loads
window.addEventListener("load", () => {
  startBtn = document.getElementById("startBtn");
  stopBtn = document.getElementById("stopBtn");
  status = document.getElementById("status");
  video = document.getElementById("preview");
  canvas = document.getElementById("canvas");
  processingCanvas = document.getElementById("processingCanvas");
  log = document.getElementById("log");
  frameCounter = document.getElementById("frameCounter");
  frameRateSelect = document.getElementById("frameRate");
  qualitySelect = document.getElementById("quality");
  resolutionSelect = document.getElementById("resolution");
  fpsModeSelect = document.getElementById("fpsMode");
  fpsLimitContainer = document.getElementById("fpsLimitContainer");
  sourceTypeSelect = document.getElementById("sourceType"); // Khởi tạo biến cho việc chọn nguồn ghi hình

  // Khởi tạo các trường nhập WebSocket
  cameraIdInput = document.getElementById("cameraId");
  apiKeyInput = document.getElementById("apiKey");
  websocketUrlInput = document.getElementById("websocketUrl");

  // Tải các giá trị đã lưu trước đó từ localStorage nếu có
  cameraIdInput.value = localStorage.getItem("cameraId") || DEFAULT_CAMERA_ID;
  apiKeyInput.value = localStorage.getItem("apiKey") || DEFAULT_API_KEY;
  websocketUrlInput.value =
    localStorage.getItem("websocketUrl") || DEFAULT_WEBSOCKET_URL;

  // Thêm sự kiện lưu giá trị khi người dùng thay đổi
  cameraIdInput.addEventListener("change", () => {
    localStorage.setItem("cameraId", cameraIdInput.value);
  });
  apiKeyInput.addEventListener("change", () => {
    localStorage.setItem("apiKey", apiKeyInput.value);
  });
  websocketUrlInput.addEventListener("change", () => {
    localStorage.setItem("websocketUrl", websocketUrlInput.value);
  });

  // Update FPS control visibility based on mode selection
  fpsModeSelect.addEventListener("change", () => {
    fpsLimitContainer.style.display =
      fpsModeSelect.value === "limited" ? "block" : "none";
  });

  // Update resolution when selection changes
  resolutionSelect.addEventListener("change", () => {
    const [width, height] = resolutionSelect.value.split(",").map(Number);
    currentResolution.width = width;
    currentResolution.height = height;
    addLog(`Resolution set to: ${width}x${height}`);
  });

  // Event listeners for buttons
  startBtn.addEventListener("click", startCapture);
  stopBtn.addEventListener("click", stopCapture);

  // Initialize
  addLog("Page loaded. Ready to start capture.");

  // Initialize FPS control visibility
  fpsLimitContainer.style.display =
    fpsModeSelect.value === "limited" ? "block" : "none";

  // Clean up when page unloads
  window.addEventListener("beforeunload", () => {
    if (isRecording) {
      stopCapture();
    }

    if (socket) {
      socket.close();
    }
  });

  // Tạo video chạy ngầm để ngăn chặn browser throttling
  createNoSleepVideo();
});

// Tạo video ngầm để ngăn browser throttling
function createNoSleepVideo() {
  noSleepVideo = document.createElement("video");
  noSleepVideo.setAttribute("loop", "");
  noSleepVideo.setAttribute("playsinline", "");
  noSleepVideo.setAttribute("muted", "");
  noSleepVideo.setAttribute("defaultMuted", "");
  noSleepVideo.setAttribute("autoplay", "");
  noSleepVideo.setAttribute(
    "src",
    "data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1wNDJtcDQxaXNvbWF2YzEAAATKbW9vdgAAAGxtdmhkAAAAANLEP5XSxD+VAAB1MAAAdU4AAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAACFpb2RzAAAAABCAgIAQAE////9//w6AgIAEAAAAAQAABDV0cmFrAAAAXHRraGQAAAAH0sQ/ldLEP5UAAAABAAAAAAAAdU4AAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAACFpb2RzAAAAABCAgIAQAE////9//w6AgIAEAAAAAQAABDV0cmFrAAAAXHRraGQAAAAH0sQ/ldLEP5UAAAABAAAAAAAAdU4AAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAIhaWRzbwAAABBAgIAQAE////9//w6AgIAEAAAAAQAABDV0cmFrAAAAXHRraGQAAAAH0sQ/ldLEP5UAAAABAAAAAAAAdU4AAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAIhaWRzbwAAABBAgIAQAE////9//w6AgIAEAAAAAQAABDV0cmFrAAAAXHRraGQAAAAH0sQ/ldLEP5UAAAABAAAAAAAAdU4AAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAIhaWRzb"
  );
  noSleepVideo.style.display = "none";
  document.body.appendChild(noSleepVideo);
}

// Helper function to log messages
function addLog(message) {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  console.log(`[Log] ${message}`);
}

// Tạo URL WebSocket từ thông tin người dùng nhập
function buildWebSocketUrl() {
  const websocketServer = websocketUrlInput.value || DEFAULT_WEBSOCKET_URL;
  const cameraId = cameraIdInput.value || DEFAULT_CAMERA_ID;
  const apiKey = apiKeyInput.value || DEFAULT_API_KEY;

  return `ws://${websocketServer}?cameraId=${cameraId}&apiKey=${apiKey}`;
}

// Start screen capture
async function startCapture() {
  try {
    // Cập nhật URL WebSocket dựa trên thông tin người dùng nhập
    wsUrl = buildWebSocketUrl();

    // Connect to WebSocket if not connected
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (!connectWebSocket()) {
        return;
      }
    }

    // Get selected source type
    const sourceType = sourceTypeSelect.value;
    addLog(`Capture source type: ${sourceType}`);

    // Get screen capture stream based on source type
    const displayMediaOptions = {
      video: {
        cursor: "always",
        frameRate: {
          ideal: 60,
        },
        // Áp dụng các tùy chọn cụ thể dựa trên loại nguồn đã chọn
        displaySurface: sourceType, // 'display', 'window', 'tab'
      },
      audio: false,
      // Sử dụng thuộc tính preferCurrentTab nếu đã chọn ghi tab hiện tại
      preferCurrentTab: sourceType === "tab",
      // Hiển thị thông tin về loại selecetion
      surfaceSwitching: "include",
      selfBrowserSurface: "include",
      systemAudio: "exclude",
    };

    try {
      mediaStream = await navigator.mediaDevices.getDisplayMedia(
        displayMediaOptions
      );
      video.srcObject = mediaStream;

      // Lắng nghe sự kiện khi nguồn media bị dừng (khi người dùng hủy chia sẻ màn hình)
      mediaStream.getVideoTracks()[0].onended = () => {
        addLog("Media stream ended by user");
        stopCapture();
      };

      // Hiển thị thông tin về nguồn ghi hình đã chọn
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const surfaceType = settings.displaySurface || "unknown";
      addLog(
        `Đã chọn nguồn ghi hình: ${surfaceType} (${settings.width}x${settings.height})`
      );

      // Setup canvases
      const ctx = canvas.getContext("2d", { alpha: false });
      const processingCtx = processingCanvas.getContext("2d", { alpha: false });

      // Update canvas size when metadata is loaded
      video.onloadedmetadata = () => {
        // Set preview canvas to native resolution
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Set processing canvas to selected resolution
        processingCanvas.width = currentResolution.width;
        processingCanvas.height = currentResolution.height;

        addLog(`Native resolution: ${canvas.width}x${canvas.height}`);
        addLog(
          `Streaming at: ${currentResolution.width}x${currentResolution.height}`
        );

        const fpsMode = fpsModeSelect.value;
        if (fpsMode === "unlimited") {
          addLog("Sending frames at maximum speed (no FPS limit)");
        } else {
          const targetFps = parseInt(frameRateSelect.value, 10);
          addLog(`FPS limited to: ${targetFps}`);
        }

        // Kích hoạt chế độ hiệu suất tối đa ngay khi bắt đầu
        enableMaximumPerformanceMode();
      };

      // Start sending frames
      isRecording = true;
      frameCount = 0;
      fps = 0;
      lastFpsUpdate = Date.now();

      startBtn.disabled = true;
      stopBtn.disabled = false;
      addLog("Screen capture started");

      // Thiết lập xử lý cho các sự kiện nền của các tab browser để luôn duy trì hiệu suất cao
      enableContinuousHighPerformanceMode();
    } catch (error) {
      addLog(`Error accessing media: ${error.message}`);
      console.error("Error accessing media:", error);
    }
  } catch (error) {
    addLog(`Error starting capture: ${error.message}`);
    console.error("Error starting capture:", error);
  }
}

// Stop screen capture
function stopCapture() {
  isRecording = false;
  useBackgroundMode = false;
  currentPerformanceMode = PERFORMANCE_MODE.NORMAL;

  // Dừng animation frame nếu đang sử dụng
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Dừng interval nếu đang sử dụng
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }

  // Dừng worker xử lý nền nếu đang hoạt động
  if (captureWorker) {
    try {
      captureWorker.postMessage({ command: "stop" });
      captureWorker.terminate();
    } catch (e) {
      console.error("Error terminating worker:", e);
    }
    captureWorker = null;
    addLog("Đã dừng worker xử lý nền");
  }

  // Dừng các kỹ thuật ngăn browser throttling
  if (window.BrowserKeepAlive) {
    window.BrowserKeepAlive.stopPreventing();
  }

  // Dừng media stream
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    mediaStream = null;
  }

  // Xóa bỏ frame cuối cùng để giải phóng bộ nhớ
  lastCaptureImage = null;

  startBtn.disabled = false;
  stopBtn.disabled = true;
  addLog("Screen capture stopped");
}

// Kết nối WebSocket
function connectWebSocket() {
  if (isConnecting) return false;

  isConnecting = true;
  try {
    addLog(`Connecting to WebSocket server: ${wsUrl}`);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      status.textContent = "Connected to WebSocket server";
      status.style.color = "green";
      addLog("WebSocket connection established");
      startBtn.disabled = false;

      // Reset reconnect parameters on successful connection
      reconnectAttempts = 0;
      reconnectInterval = 1000;
      isConnecting = false;

      // Tự động bắt đầu lại việc ghi hình nếu trước đó đang ghi
      if (wasRecording) {
        addLog("Auto-resuming screen capture after reconnection");
        setTimeout(() => startCapture(), 500); // Chờ 500ms để đảm bảo kết nối ổn định
        wasRecording = false; // Đặt lại trạng thái
      }
    };

    socket.onclose = (event) => {
      status.textContent = "Disconnected from WebSocket server";
      status.style.color = "red";
      addLog(`WebSocket connection closed: ${event.reason}`);
      startBtn.disabled = true;

      // Lưu trạng thái ghi hình trước khi dừng
      wasRecording = isRecording;

      stopCapture();
      isConnecting = false;

      // Schedule reconnection
      scheduleReconnect();
    };

    socket.onerror = (error) => {
      status.textContent = "WebSocket error";
      status.style.color = "red";
      addLog("WebSocket error occurred");
      console.error("WebSocket error:", error);
      isConnecting = false;
    };

    return true;
  } catch (error) {
    status.textContent = "Failed to connect to WebSocket server";
    status.style.color = "red";
    addLog(`Connection error: ${error.message}`);
    console.error("Connection error:", error);
    isConnecting = false;

    // Schedule reconnection on error
    scheduleReconnect();
    return false;
  }
}

// Lên lịch kết nối lại với backoff theo cấp số nhân
function scheduleReconnect() {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
  }

  reconnectAttempts++;
  // Backoff theo cấp số nhân với jitter để tránh reconnection storms
  const jitter = Math.random() * 0.5 + 0.5; // Giá trị ngẫu nhiên giữa 0.5 và 1
  const timeout = Math.min(reconnectInterval * jitter, maxReconnectInterval);

  addLog(
    `Lên lịch kết nối lại lần thứ ${reconnectAttempts} sau ${Math.round(
      timeout / 1000
    )} giây...`
  );

  reconnectTimeoutId = setTimeout(() => {
    addLog(`Đang thử kết nối lại (lần thứ ${reconnectAttempts})...`);
    connectWebSocket();
    // Tăng khoảng thời gian cho lần kết nối tiếp theo (backoff theo cấp số nhân)
    reconnectInterval = Math.min(reconnectInterval * 1.5, maxReconnectInterval);
  }, timeout);
}

// Xử lý khi tab bị ẩn hoặc hiện
function handleVisibilityChange() {
  isPageVisible = !document.hidden;

  if (document.hidden) {
    // Tab không hiển thị - kích hoạt chế độ hiệu suất tối đa
    if (isRecording) {
      // Đảm bảo FPS luôn cao nhất ngay cả khi tab bị ẩn
      enableMaximumPerformanceMode();
    }
  } else {
    // Tab hiển thị trở lại - vẫn duy trì chế độ hiệu suất tối đa
    if (isRecording) {
      // Giữ chế độ hiệu suất tối đa hoặc khởi động lại nếu cần
      if (currentPerformanceMode !== PERFORMANCE_MODE.HIGH_PERFORMANCE) {
        enableMaximumPerformanceMode();
      }
      addLog("Tab hiển thị: Tiếp tục duy trì hiệu suất tối đa");
    }
  }
}

// Đăng ký sự kiện khi tài liệu đã tải xong
document.addEventListener("visibilitychange", handleVisibilityChange);

// Hàm cao cấp nhất để đảm bảo FPS cao dù ở chế độ ẩn
function enableMaximumPerformanceMode() {
  // Chuyển sang chế độ hiệu suất tối đa
  currentPerformanceMode = PERFORMANCE_MODE.HIGH_PERFORMANCE;
  addLog("Đã kích hoạt chế độ hiệu suất TỐI ĐA - luôn duy trì FPS cao nhất");

  // 1. Kích hoạt các kỹ thuật ngăn chặn throttling của trình duyệt
  if (window.BrowserKeepAlive) {
    window.BrowserKeepAlive.preventThrottling();
  }

  // 2. Thiết lập các cơ chế đảm bảo hiệu suất cao liên tục
  enableContinuousHighPerformanceMode();

  // 3. Cập nhật trạng thái hiển thị
  frameCounter.textContent = `Frames: ${frameCount} | FPS: ${fps} | Mode: TỐI ĐA`;
}

// Thiết lập các cơ chế đảm bảo hiệu suất cao liên tục
function enableContinuousHighPerformanceMode() {
  // Hàm xử lý chụp và gửi frame
  function captureAndSendFrame() {
    if (
      !isRecording ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      sendingFrame
    )
      return;

    try {
      sendingFrame = true;

      // Sử dụng các tùy chọn canvas tối ưu nhất cho hiệu suất
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
        willReadFrequently: true,
      });

      const processingCtx = processingCanvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
        willReadFrequently: true,
      });

      // Vẽ vào canvas với hiệu suất tối ưu
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      processingCtx.drawImage(
        video,
        0,
        0,
        currentResolution.width,
        currentResolution.height
      );

      // Chất lượng được chọn
      const quality = parseFloat(qualitySelect.value);

      // Nén và gửi hình ảnh
      processingCanvas.toBlob(
        (blob) => {
          if (socket && socket.readyState === WebSocket.OPEN && blob) {
            socket.send(blob);
            frameCount++;

            // Cập nhật FPS counter
            const now = Date.now();
            if (now - lastFpsUpdate >= 1000) {
              fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
              frameCounter.textContent = `Frames: ${frameCount} | FPS: ${fps} | Mode: TỐI ĐA`;
              lastFpsUpdate = now;
              frameCount = 0;
            }
          }
          sendingFrame = false;
        },
        "image/jpeg",
        quality
      );
    } catch (error) {
      console.error("Error in capture and send:", error);
      sendingFrame = false;
    }
  }

  // 1. Kiểm tra nếu tab đã ẩn và kích hoạt chế độ hiệu suất cao ngay
  if (document.hidden) {
    addLog("Tab đang bị ẩn: Kích hoạt chế độ hiệu suất tối đa");
  }

  // 2. Khởi tạo capture worker nếu chưa có
  if (!captureWorker) {
    try {
      captureWorker = new Worker("/public/scripts/capture/backgroundWorker.js");

      // Xử lý tin nhắn từ worker
      captureWorker.onmessage = function (e) {
        if (e.data.type === "requestFrame") {
          captureAndSendFrame();
        }
      };

      // Bắt đầu worker với FPS mục tiêu
      const targetFps =
        fpsModeSelect.value === "unlimited"
          ? 60 // Nhắm tới 60fps nếu unlimited
          : parseInt(frameRateSelect.value, 10);

      captureWorker.postMessage({
        command: "start",
        fps: targetFps,
      });

      addLog(
        `Đã kích hoạt worker xử lý nền với tốc độ FPS cao nhất (${targetFps} FPS)`
      );
    } catch (error) {
      console.error("Không thể tạo worker:", error);
      // Tiếp tục sử dụng requestAnimationFrame nếu không tạo được worker
    }
  }

  // 3. Sử dụng requestAnimationFrame song song với Web Worker để tránh bị throttle
  const keepMaxFPS = () => {
    if (!isRecording) return;

    // Chụp và gửi frame khi có thể
    if (!sendingFrame && socket?.readyState === WebSocket.OPEN) {
      captureAndSendFrame();
    }

    // Tiếp tục vòng lặp
    animationFrameId = requestAnimationFrame(keepMaxFPS);
  };

  // Bắt đầu vòng lặp FPS cao
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(keepMaxFPS);
  }
}

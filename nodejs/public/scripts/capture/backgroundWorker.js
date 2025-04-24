// Capture Worker Script
// Script này chạy trong một dedicated worker để duy trì hoạt động gửi frame khi tab bị ẩn

// Biến kiểm soát timing
let timerId = null;
let targetFps = 60;
let isActive = false;
let lastPostTime = 0;

// Sử dụng kỹ thuật tinh chỉnh thời gian để đạt được fps chính xác hơn
function setupPreciseTiming(fps) {
    const frameDuration = 1000 / fps;
    
    function sendFrameRequest() {
        if (!isActive) return;
        
        const now = Date.now();
        // Tính toán độ chênh lệch giữa thời gian mong đợi và thời gian thực tế
        const timeSinceLastPost = now - lastPostTime;
        
        // Gửi yêu cầu frame mới
        self.postMessage({ type: 'requestFrame' });
        lastPostTime = now;
        
        // Tính thời gian chờ tiếp theo, điều chỉnh dựa trên độ chênh lệch
        let nextFrameDelay = Math.max(0, frameDuration - (Date.now() - now));
        
        // Lập lịch cho frame tiếp theo
        timerId = setTimeout(sendFrameRequest, nextFrameDelay);
    }
    
    if (timerId) {
        clearTimeout(timerId);
        timerId = null;
    }
    
    lastPostTime = Date.now();
    isActive = true;
    timerId = setTimeout(sendFrameRequest, 0);
}

// Xử lý tin nhắn từ thread chính
self.onmessage = function(e) {
    const data = e.data;
    
    switch (data.command) {
        case 'start':
            targetFps = data.fps || 60;
            isActive = true;
            
            // Thông báo cho main thread biết worker đã bắt đầu
            self.postMessage({ type: 'started', fps: targetFps });
            
            // Thiết lập timing chính xác
            setupPreciseTiming(targetFps);
            break;
        
        case 'stop':
            isActive = false;
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
            self.postMessage({ type: 'stopped' });
            break;
        
        case 'updateFPS':
            targetFps = data.fps || targetFps;
            if (isActive) {
                // Khởi động lại timing với FPS mới
                setupPreciseTiming(targetFps);
            }
            self.postMessage({ type: 'fpsUpdated', fps: targetFps });
            break;
            
        case 'ping':
            // Dùng để kiểm tra worker còn hoạt động không
            self.postMessage({ type: 'pong', timestamp: Date.now() });
            break;
    }
};

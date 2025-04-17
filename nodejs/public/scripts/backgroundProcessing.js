// Shared Worker cho việc xử lý nền với hiệu suất tối đa
// Lưu ý: Tệp này sẽ được tải từ cùng nguồn gốc để đảm bảo các header bảo mật hoạt động

// Danh sách các kết nối
const connections = new Set();
let timerId = null;
let targetFPS = 60;
let useMaxPerformance = true;

// Tạo một bộ đếm thời gian hiệu suất cao thay thế cho setInterval/setTimeout
class HighResolutionTimer {
  constructor(callback, interval) {
    this.callback = callback;
    this.interval = interval;
    this.running = false;
    this.lastTime = 0;
    this.id = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  tick() {
    if (!this.running) return;
    const now = performance.now();
    const elapsed = now - this.lastTime;
    
    if (elapsed >= this.interval) {
      this.lastTime = now - (elapsed % this.interval);
      this.callback();
    }
    
    this.id = self.requestAnimationFrame(() => this.tick());
  }

  stop() {
    this.running = false;
    self.cancelAnimationFrame(this.id);
  }
  
  setInterval(newInterval) {
    this.interval = newInterval;
  }
}

// Xử lý tin nhắn từ trang chính
self.onconnect = function(e) {
  const port = e.ports[0];
  connections.add(port);
  
  port.onmessage = function(e) {
    const data = e.data;
    
    switch (data.command) {
      case 'start':
        // Bắt đầu hoặc cập nhật timer
        useMaxPerformance = data.useMaxPerformance !== false; // Mặc định là true
        targetFPS = data.fps || 60;
        startTimer();
        break;
        
      case 'stop':
        // Dừng timer nếu không còn kết nối nào
        if (timerId) {
          timerId.stop();
          timerId = null;
        }
        break;
        
      case 'updateFPS':
        // Cập nhật FPS
        targetFPS = data.fps || targetFPS;
        if (timerId) {
          timerId.setInterval(1000 / targetFPS);
        }
        break;
    }
  };
  
  port.onmessageerror = function(e) {
    console.error('Message error:', e);
  };
  
  port.start();
  
  // Thông báo cho trang biết rằng kết nối đã được thiết lập
  port.postMessage({ type: 'connected' });
  
  // Bắt đầu timer nếu chưa chạy
  startTimer();
};

// Hàm bắt đầu timer hiệu suất cao
function startTimer() {
  if (timerId) {
    timerId.stop();
  }
  
  const interval = 1000 / targetFPS;
  
  timerId = new HighResolutionTimer(() => {
    // Gửi yêu cầu chụp frame đến tất cả các kết nối
    for (const port of connections) {
      try {
        port.postMessage({ type: 'requestFrame' });
      } catch (error) {
        console.error('Error posting message:', error);
        connections.delete(port);
      }
    }
  }, interval);
  
  timerId.start();
}

// Dọn dẹp kết nối khi worker bị hủy
self.addEventListener('unload', () => {
  if (timerId) {
    timerId.stop();
  }
  connections.clear();
});

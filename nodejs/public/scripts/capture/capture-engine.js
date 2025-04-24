// Capture Engine - Mô-đun xử lý việc chụp và gửi frame với hiệu suất cao nhất có thể

// Kết nối tới main.js qua các hàm callback
let options = {
    onFrameSent: null,      // Khi một frame được gửi thành công
    onError: null,          // Khi xảy ra lỗi
    onFpsUpdate: null,      // Khi cập nhật FPS
    onLog: null             // Ghi log
};

// Thiết lập các tùy chọn callback
function setupCaptureEngine(callbacks) {
    options = { ...options, ...callbacks };
}

// Hàm chụp và gửi frame với hiệu suất tối đa - không bị giới hạn khi tab ẩn
function captureAndSendFrameMaxPerformance(video, canvas, processingCanvas, socket, currentResolution, quality) {
    if (!video || !canvas || !processingCanvas || !socket || socket.readyState !== WebSocket.OPEN || window._sendingFrame) return false;
    
    try {
        window._sendingFrame = true;
        
        // Sử dụng offscreenCanvas nếu được hỗ trợ để tăng hiệu suất
        let offscreenProcCanvas = null;
        let procCtx = null;
        
        if (typeof OffscreenCanvas !== "undefined") {
            offscreenProcCanvas = new OffscreenCanvas(currentResolution.width, currentResolution.height);
            procCtx = offscreenProcCanvas.getContext('2d', { 
                alpha: false, 
                desynchronized: true,
                willReadFrequently: true
            });
        } else {
            // Fallback nếu không hỗ trợ OffscreenCanvas
            procCtx = processingCanvas.getContext('2d', { 
                alpha: false, 
                desynchronized: true,
                willReadFrequently: true
            });
        }
        
        // Vẽ frame vào canvas xử lý - đây là bước quan trọng nhất
        procCtx.drawImage(video, 0, 0, currentResolution.width, currentResolution.height);
        
        // Lưu frame hiện tại để có thể sử dụng nếu cần
        try {
            if (window._savePreviewFrames && video.readyState === 4) {
                const canvasCtx = canvas.getContext('2d', { alpha: false });
                canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
        } catch (e) {
            console.warn('Không thể lưu preview frame:', e);
        }
        
        // Sử dụng Promise và Blob API để nén và gửi hình ảnh
        const convertToBlob = () => {
            return new Promise((resolve) => {
                if (offscreenProcCanvas) {
                    // Sử dụng OffscreenCanvas để tạo blob
                    offscreenProcCanvas.convertToBlob({ type: 'image/jpeg', quality })
                        .then(blob => resolve(blob))
                        .catch(() => {
                            // Fallback nếu có lỗi
                            processingCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
                        });
                } else {
                    // Sử dụng canvas thông thường
                    processingCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
                }
            });
        };
        
        // Xử lý theo cách không làm chậm main thread
        return convertToBlob().then(blob => {
            if (socket && socket.readyState === WebSocket.OPEN && blob) {
                socket.send(blob);
                if (options.onFrameSent) {
                    options.onFrameSent();
                }
                return true;
            }
            return false;
        }).catch(error => {
            if (options.onError) {
                options.onError('Lỗi khi gửi frame: ' + error.message);
            }
            return false;
        }).finally(() => {
            window._sendingFrame = false;
        });
    } catch (error) {
        if (options.onError) {
            options.onError('Lỗi trong captureAndSendFrameMaxPerformance: ' + error.message);
        }
        window._sendingFrame = false;
        return Promise.resolve(false);
    }
}

// Tạo các worker và system nền hỗ trợ gửi liên tục
async function setupBackgroundCapture(video, canvas, processingCanvas, socket, currentResolution, quality, fps) {
    if (!window._worker) {
        try {
            // Tạo worker mới
            window._worker = new Worker('/public/scripts/capture/backgroundWorker.js');
            
            if (options.onLog) {
                options.onLog('Đã khởi tạo worker nền để duy trì FPS khi tab bị ẩn');
            }
            
            // Xử lý tin nhắn từ worker
            window._worker.onmessage = async function(e) {
                if (e.data.type === 'requestFrame') {
                    // Chỉ gửi frame mới nếu đã gửi xong frame trước đó
                    if (!window._sendingFrame) {
                        await captureAndSendFrameMaxPerformance(video, canvas, processingCanvas, socket, currentResolution, quality);
                    }
                } else if (e.data.type === 'started') {
                    if (options.onLog) {
                        options.onLog(`Worker đã bắt đầu với ${e.data.fps} FPS`);
                    }
                }
            };
            
            // Khởi động worker
            window._worker.postMessage({
                command: 'start',
                fps: fps
            });
            
            // Đảm bảo worker vẫn hoạt động bằng cách ping định kỳ
            if (!window._workerWatchdog) {
                window._workerWatchdog = setInterval(() => {
                    if (window._worker) {
                        window._worker.postMessage({ command: 'ping' });
                    }
                }, 5000);
            }
            
            return true;
        } catch (error) {
            if (options.onError) {
                options.onError('Không thể tạo worker: ' + error.message);
            }
            return false;
        }
    }
    return true;
}

// Dừng và dọn dẹp background capture
function stopBackgroundCapture() {
    if (window._workerWatchdog) {
        clearInterval(window._workerWatchdog);
        window._workerWatchdog = null;
    }
    
    if (window._worker) {
        try {
            window._worker.postMessage({ command: 'stop' });
            window._worker.terminate();
            window._worker = null;
            if (options.onLog) {
                options.onLog('Đã dừng worker nền');
            }
        } catch (e) {
            console.error('Lỗi khi dừng worker:', e);
        }
    }
}

// Cập nhật FPS cho background capture
function updateBackgroundCaptureFps(fps) {
    if (window._worker) {
        window._worker.postMessage({
            command: 'updateFPS',
            fps: fps
        });
    }
}

// Xuất các hàm để sử dụng từ module khác
window.CaptureEngine = {
    setup: setupCaptureEngine,
    captureAndSendFrame: captureAndSendFrameMaxPerformance,
    setupBackgroundCapture: setupBackgroundCapture,
    stopBackgroundCapture: stopBackgroundCapture,
    updateFps: updateBackgroundCaptureFps
};

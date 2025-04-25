document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const btnAddCamera = document.getElementById('btnAddCamera');
    const btnRefreshCameras = document.getElementById('btnRefreshCameras');
    const btnAddFirstCamera = document.getElementById('btnAddFirstCamera');
    const cameraGrid = document.getElementById('cameraGrid');
    const noCamerasMessage = document.getElementById('noCamerasMessage');
    const searchInput = document.getElementById('cameraSearchInput');
    const statusFilter = document.getElementById('cameraStatusFilter');
    const locationFilter = document.getElementById('cameraLocationFilter');
    
    // WebSocket connection
    let socket;
    let cameras = [];
    
    // Initialize WebSocket connection
    function initializeWebSocket() {
        // Check if socket.io client is available
        if (typeof io === 'undefined') {
            console.error('Socket.IO client not loaded');
            return;
        }
        
        // Connect to the server
        socket = io();
        
        // Connection event
        socket.on('connect', () => {
            console.log('WebSocket connected');
            
            // Join all camera rooms on connection
            socket.emit('join_all_camera');
            console.log('Joined all camera rooms');
        });
        
        // Disconnection event
        socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
        });
        
        // Listen for image events from any camera
        socket.on('image', (data) => {
            if (data && data.cameraId && data.buffer) {
                updateCameraImage(data.cameraId, data.buffer);
            }
        });
    }
    
    // Update camera thumbnail with received image
    function updateCameraImage(cameraId, imageBuffer) {
        const cameraCard = document.querySelector(`.camera-card[data-camera-id="${cameraId}"]`);
        if (cameraCard) {
            const imgElement = cameraCard.querySelector('.camera-preview img');
            if (imgElement) {
                // Convert buffer to base64 if needed
                const imageData = typeof imageBuffer === 'string' 
                    ? imageBuffer 
                    : arrayBufferToBase64(imageBuffer);
                
                // Set the image source
                imgElement.src = `data:image/jpeg;base64,${imageData}`;
                
                // Update camera status to active
                const statusElement = cameraCard.querySelector('.camera-status');
                if (statusElement) {
                    statusElement.classList.remove('inactive');
                    statusElement.classList.add('active');
                    statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Đang hoạt động</span>';
                }
            }
        }
    }
    
    // Helper function to convert ArrayBuffer to base64
    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
    
    // Fetch and display cameras
    function fetchCameras() {
        fetch('/api/camera/all')
            .then(response => response.json())
            .then(data => {
                if (data.statusCode === 200 && Array.isArray(data.metadata)) {
                    cameras = data.metadata; // Store cameras globally
                    renderCameras(cameras);
                    updateLocationFilter(cameras);
                } else {
                    showNoCamerasMessage();
                }
            })
            .catch(error => {
                console.error('Error fetching cameras:', error);
                showNoCamerasMessage();
            });
    }
    
    // Render cameras from API response
    function renderCameras(cameras) {
        if (!cameras || cameras.length === 0) {
            showNoCamerasMessage();
            return;
        }
        
        cameraGrid.innerHTML = '';
        noCamerasMessage.style.display = 'none';
        
        cameras.forEach(camera => {
            const statusClass = camera.camera_status ? 'active' : 'inactive';
            const statusText = camera.camera_status ? 'Đang hoạt động' : 'Không hoạt động';
            
            const cameraCard = document.createElement('div');
            cameraCard.className = 'camera-card';
            cameraCard.dataset.cameraId = camera._id;
            
            cameraCard.innerHTML = `
                <div class="camera-preview">
                    <img src="/img/camera-preview-placeholder.jpg" alt="${camera.camera_name}" onerror="this.src='/img/camera-offline.jpg'">
                    <div class="camera-status ${statusClass}">
                        <i class="fas fa-circle"></i>
                        <span>${statusText}</span>
                    </div>
                    <div class="camera-resolution">HD</div>
                </div>
                <div class="camera-info">
                    <h3 class="camera-name">${camera.camera_name}</h3>
                    <p class="camera-location"><i class="fas fa-map-marker-alt"></i> ${camera.camera_location}</p>
                    <p class="camera-ip"><i class="fas fa-network-wired"></i> ID: ${camera._id}</p>
                </div>
                <div class="camera-actions">
                    <button class="btn btn-sm btn-primary btn-view" data-id="${camera._id}">
                        <i class="fas fa-eye"></i> Xem
                    </button>
                    <button class="btn btn-sm btn-info btn-edit" data-id="${camera._id}">
                        <i class="fas fa-edit"></i> Sửa
                    </button>
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${camera._id}">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            `;
            
            cameraGrid.appendChild(cameraCard);
        });
        
        // Add event listeners to the new buttons
        attachButtonEventListeners();
    }
    
    // Update location filter with unique locations
    function updateLocationFilter(cameras) {
        const locations = new Set();
        cameras.forEach(camera => {
            if (camera.camera_location) {
                locations.add(camera.camera_location);
            }
        });
        
        // Clear existing options except "All"
        locationFilter.innerHTML = '<option value="all">Tất cả khu vực</option>';
        
        // Add unique locations
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
        });
    }
    
    function showNoCamerasMessage() {
        cameraGrid.innerHTML = '';
        noCamerasMessage.style.display = 'flex';
    }
    
    // Attach event listeners to camera action buttons
    function attachButtonEventListeners() {
        // View buttons
        document.querySelectorAll('.btn-view').forEach(button => {
            button.addEventListener('click', function() {
                const cameraId = this.getAttribute('data-id');
                window.location.href = `/views/cameras/${cameraId}`;
            });
        });
        
        // Edit buttons
        document.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', function() {
                const cameraId = this.getAttribute('data-id');
                window.location.href = `/views/cameras/edit/${cameraId}`;
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', function() {
                const cameraId = this.getAttribute('data-id');
                if (confirm('Bạn có chắc chắn muốn xóa camera này?')) {
                    deleteCamera(cameraId);
                }
            });
        });
    }
    
    // Delete camera function
    function deleteCamera(cameraId) {
        fetch(`/api/camera/${cameraId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Không thể xóa camera');
            }
            return response.json();
        })
        .then(() => {
            // Remove from UI
            const cameraCard = document.querySelector(`.camera-card[data-camera-id="${cameraId}"]`);
            if (cameraCard) {
                cameraCard.remove();
            }
            
            // Check if any cameras remain
            const remainingCameras = document.querySelectorAll('.camera-card');
            if (remainingCameras.length === 0) {
                showNoCamerasMessage();
            }
        })
        .catch(error => {
            alert('Lỗi: ' + error.message);
        });
    }
    
    // Apply filters
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const statusValue = statusFilter.value;
        const locationValue = locationFilter.value;
        
        const cameras = document.querySelectorAll('.camera-card');
        let visibleCount = 0;
        
        cameras.forEach(camera => {
            const cameraName = camera.querySelector('.camera-name').textContent.toLowerCase();
            const cameraLocation = camera.querySelector('.camera-location').textContent.toLowerCase();
            const cameraStatus = camera.querySelector('.camera-status').classList.contains(statusValue);
            
            // Apply filters
            let showCamera = true;
            
            // Filter by name/location
            if (searchTerm && !cameraName.includes(searchTerm) && !cameraLocation.includes(searchTerm)) {
                showCamera = false;
            }
            
            // Filter by status
            if (statusValue !== 'all' && !cameraStatus) {
                showCamera = false;
            }
            
            // Filter by location
            if (locationValue !== 'all' && !cameraLocation.includes(locationValue)) {
                showCamera = false;
            }
            
            // Show/hide based on filters
            camera.style.display = showCamera ? 'block' : 'none';
            
            if (showCamera) {
                visibleCount++;
            }
        });
        
        // Show no cameras message if no results
        if (visibleCount === 0) {
            noCamerasMessage.style.display = 'flex';
            noCamerasMessage.querySelector('p').textContent = 'Không tìm thấy camera phù hợp với bộ lọc';
            noCamerasMessage.querySelector('button').style.display = 'none';
        } else {
            noCamerasMessage.style.display = 'none';
        }
    }
    
    // Initialize WebSocket and fetch cameras
    initializeWebSocket();
    fetchCameras();
    
    // Event Listeners
    btnAddCamera.addEventListener('click', function() {
        window.location.href = '/views/cameras/add';
    });
    
    btnRefreshCameras.addEventListener('click', function() {
        fetchCameras();
    });
    
    btnAddFirstCamera.addEventListener('click', function() {
        window.location.href = '/views/cameras/add';
    });
    
    // Filter change events
    searchInput.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    locationFilter.addEventListener('change', applyFilters);
}); 
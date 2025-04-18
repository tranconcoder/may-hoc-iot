/**
 * Traffic Dashboard JavaScript
 * Handles dashboard UI interactions, chart rendering, and data processing
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize components
  initSidebar();
  initCharts();
  setupEventListeners();
  checkScreenSize();
  
  // Check for real-time updates if on relevant pages
  if (isMonitoringPage()) {
    initRealTimeUpdates();
  }
});

/**
 * Sidebar functionality
 */
function initSidebar() {
  // Active link handling
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    // Remove all active classes first
    link.classList.remove('active');
    
    // Add active class to current page link
    const href = link.getAttribute('href');
    if (href === currentPath || 
        (href !== '/' && currentPath.startsWith(href))) {
      link.classList.add('active');
    }
  });

  // Toggle sidebar on mobile
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      document.querySelector('.dashboard-container').classList.toggle('sidebar-collapsed');
    });
  }
}

/**
 * Determine if current page is a monitoring page
 */
function isMonitoringPage() {
  const monitoringPaths = ['/cameras', '/capture', '/preview', '/traffic-stats'];
  const currentPath = window.location.pathname;
  return monitoringPaths.some(path => currentPath.startsWith(path));
}

/**
 * Chart initialization
 */
function initCharts() {
  initTrafficVolumeChart();
  initVehicleTypesChart();
  initTrafficTrendsChart();
  initCongestionLevelsChart();
}

/**
 * Initialize traffic volume chart
 */
function initTrafficVolumeChart() {
  const trafficVolumeChart = document.getElementById('trafficVolumeChart');
  if (!trafficVolumeChart) return;

  new Chart(trafficVolumeChart, {
    type: 'line',
    data: {
      labels: generateHourLabels(),
      datasets: [{
        label: 'Số lượng xe',
        data: [120, 145, 90, 70, 80, 100, 130, 180, 210, 190, 170, 150, 
              140, 160, 180, 200, 210, 220, 190, 160, 140, 120, 100, 110],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Lưu lượng giao thông theo giờ'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Số lượng phương tiện'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Giờ'
          }
        }
      }
    }
  });
}

/**
 * Initialize vehicle types chart
 */
function initVehicleTypesChart() {
  const vehicleTypesChart = document.getElementById('vehicleTypesChart');
  if (!vehicleTypesChart) return;

  new Chart(vehicleTypesChart, {
    type: 'doughnut',
    data: {
      labels: ['Xe máy', 'Ô tô con', 'Xe buýt', 'Xe tải', 'Xe khác'],
      datasets: [{
        data: [65, 20, 5, 8, 2],
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Phân loại phương tiện'
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

/**
 * Initialize traffic trends chart (weekly data)
 */
function initTrafficTrendsChart() {
  const trafficTrendsChart = document.getElementById('trafficTrendsChart');
  if (!trafficTrendsChart) return;

  new Chart(trafficTrendsChart, {
    type: 'bar',
    data: {
      labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'],
      datasets: [{
        label: 'Buổi sáng',
        data: [3200, 3100, 3300, 3400, 3600, 2100, 1800],
        backgroundColor: 'rgba(255, 206, 86, 0.7)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1
      }, {
        label: 'Buổi chiều',
        data: [2800, 2900, 3100, 3200, 3500, 2400, 1900],
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }, {
        label: 'Buổi tối',
        data: [2500, 2600, 2800, 3000, 3400, 3200, 2100],
        backgroundColor: 'rgba(153, 102, 255, 0.7)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Xu hướng lưu lượng theo ngày trong tuần'
        },
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Số lượng phương tiện'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Ngày trong tuần'
          }
        }
      }
    }
  });
}

/**
 * Initialize congestion levels chart
 */
function initCongestionLevelsChart() {
  const congestionLevelsChart = document.getElementById('congestionLevelsChart');
  if (!congestionLevelsChart) return;

  new Chart(congestionLevelsChart, {
    type: 'line',
    data: {
      labels: generateHourLabels(),
      datasets: [{
        label: 'Mức độ tắc nghẽn',
        data: [20, 30, 25, 15, 10, 30, 60, 80, 75, 60, 55, 60, 
              65, 70, 75, 85, 90, 85, 70, 50, 40, 30, 25, 20],
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Mức độ tắc nghẽn theo giờ (%)'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Tỷ lệ tắc nghẽn (%)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Giờ'
          }
        }
      }
    }
  });
}

/**
 * Generate hour labels (0-23)
 */
function generateHourLabels() {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push(i + 'h');
  }
  return hours;
}

/**
 * Set up global event listeners
 */
function setupEventListeners() {
  // Responsive handling
  window.addEventListener('resize', checkScreenSize);
  
  // Data refresh buttons
  const refreshButtons = document.querySelectorAll('.refresh-data');
  refreshButtons.forEach(button => {
    button.addEventListener('click', refreshDashboardData);
  });
  
  // Time period selectors
  const periodSelectors = document.querySelectorAll('.period-selector');
  periodSelectors.forEach(selector => {
    selector.addEventListener('change', changeDateRange);
  });
  
  // Camera view toggles
  const cameraViewToggles = document.querySelectorAll('.camera-view-toggle');
  cameraViewToggles.forEach(toggle => {
    toggle.addEventListener('click', toggleCameraView);
  });
}

/**
 * Handle responsive behavior
 */
function checkScreenSize() {
  const dashboardContainer = document.querySelector('.dashboard-container');
  if (!dashboardContainer) return;
  
  if (window.innerWidth < 768) {
    dashboardContainer.classList.add('sidebar-collapsed');
  } else {
    dashboardContainer.classList.remove('sidebar-collapsed');
  }
}

/**
 * Refresh dashboard data
 */
function refreshDashboardData() {
  // Add loading indicators
  const chartContainers = document.querySelectorAll('.chart-container');
  chartContainers.forEach(container => {
    container.classList.add('loading');
  });
  
  // Simulate data refresh (would be replaced with actual API calls)
  setTimeout(() => {
    // Here you would call your actual data refresh functions
    initCharts(); // Re-initialize charts with new data
    
    // Remove loading indicators
    chartContainers.forEach(container => {
      container.classList.remove('loading');
    });
    
    // Show success message
    showNotification('Dữ liệu đã được cập nhật', 'success');
  }, 1500);
}

/**
 * Handle date range changes
 */
function changeDateRange(e) {
  const selectedRange = e.target.value;
  
  // Show loading state
  const targetChart = document.querySelector(e.target.dataset.targetChart);
  if (targetChart) {
    targetChart.closest('.chart-container').classList.add('loading');
  }
  
  // Simulate API call for new date range data
  setTimeout(() => {
    // Here you would call your actual API with the selected range
    console.log(`Fetching data for range: ${selectedRange}`);
    
    // Update charts based on new data
    initCharts();
    
    // Remove loading state
    if (targetChart) {
      targetChart.closest('.chart-container').classList.remove('loading');
    }
  }, 1000);
}

/**
 * Toggle camera view (grid vs. list)
 */
function toggleCameraView(e) {
  const viewType = e.target.dataset.view;
  const cameraContainer = document.querySelector('.camera-container');
  
  if (!cameraContainer) return;
  
  // Remove all view classes
  cameraContainer.classList.remove('grid-view', 'list-view', 'single-view');
  
  // Add selected view class
  cameraContainer.classList.add(`${viewType}-view`);
  
  // Update active state on buttons
  document.querySelectorAll('.camera-view-toggle').forEach(btn => {
    btn.classList.remove('active');
  });
  e.target.classList.add('active');
}

/**
 * Initialize real-time data updates
 */
function initRealTimeUpdates() {
  // Check if we're on a page that needs real-time updates
  if (!isMonitoringPage()) return;
  
  // Set up WebSocket connection (example)
  setupWebSocketConnection();
  
  // Set up periodic data refresh
  setInterval(() => {
    refreshLiveData();
  }, 30000); // Refresh every 30 seconds
}

/**
 * Set up WebSocket for real-time data
 */
function setupWebSocketConnection() {
  // This would be replaced with your actual WebSocket implementation
  console.log('Setting up WebSocket connection for real-time traffic data');
  
  // Example WebSocket setup (commented out since we don't have the actual endpoint)
  /*
  const ws = new WebSocket('ws://your-websocket-server/traffic-data');
  
  ws.onopen = () => {
    console.log('WebSocket connection established');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateLiveTrafficData(data);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    showNotification('Kết nối dữ liệu trực tuyến bị gián đoạn', 'error');
  };
  
  ws.onclose = () => {
    console.log('WebSocket connection closed');
    // Try to reconnect after a delay
    setTimeout(setupWebSocketConnection, 5000);
  };
  */
}

/**
 * Refresh live data via API
 */
function refreshLiveData() {
  // This would be your actual API call for fresh data
  console.log('Refreshing live traffic data');
  
  // Example API call (commented out)
  /*
  fetch('/api/traffic/live-data')
    .then(response => response.json())
    .then(data => {
      updateLiveTrafficData(data);
    })
    .catch(error => {
      console.error('Error fetching live data:', error);
    });
  */
}

/**
 * Update live traffic data in the UI
 */
function updateLiveTrafficData(data) {
  // Update counters
  if (data.vehicleCounts) {
    const counters = document.querySelectorAll('.traffic-counter');
    counters.forEach(counter => {
      const type = counter.dataset.vehicleType;
      if (data.vehicleCounts[type]) {
        counter.textContent = data.vehicleCounts[type];
      }
    });
  }
  
  // Update congestion indicators
  if (data.congestionLevel) {
    const indicator = document.querySelector('.congestion-indicator');
    if (indicator) {
      indicator.style.width = `${data.congestionLevel}%`;
      
      // Update color based on level
      indicator.className = 'congestion-indicator';
      if (data.congestionLevel > 75) {
        indicator.classList.add('severe');
      } else if (data.congestionLevel > 50) {
        indicator.classList.add('moderate');
      } else {
        indicator.classList.add('normal');
      }
    }
  }
  
  // Check for alerts
  if (data.alerts && data.alerts.length > 0) {
    data.alerts.forEach(alert => {
      showNotification(alert.message, alert.type);
    });
  }
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="notification-icon fas fa-${getIconForNotificationType(type)}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  // Add to notification container (create if doesn't exist)
  let notificationContainer = document.querySelector('.notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container';
    document.body.appendChild(notificationContainer);
  }
  
  notificationContainer.appendChild(notification);
  
  // Add close button functionality
  const closeButton = notification.querySelector('.notification-close');
  closeButton.addEventListener('click', () => {
    notification.classList.add('hiding');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('hiding');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

/**
 * Get appropriate icon for notification type
 */
function getIconForNotificationType(type) {
  switch (type) {
    case 'success':
      return 'check-circle';
    case 'error':
      return 'exclamation-circle';
    case 'warning':
      return 'exclamation-triangle';
    default:
      return 'info-circle';
  }
}

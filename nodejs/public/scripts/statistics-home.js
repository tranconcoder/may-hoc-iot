document.addEventListener('DOMContentLoaded', function() {
  // Chart.js instance
  let trafficChart;
  let currentChartMode = 'hourly'; // Default chart mode
  let refreshInterval;
  
  // Initialize the dashboard
  initDashboard();
  
  // Set up refresh interval (every 30 seconds)
  startAutoRefresh();
  
  // Initialize dashboard components
  function initDashboard() {
    // Set up chart controls
    document.getElementById('btn-hourly').addEventListener('click', () => switchChartMode('hourly'));
    document.getElementById('btn-minute').addEventListener('click', () => switchChartMode('minute'));
    document.getElementById('btn-last-30').addEventListener('click', () => switchChartMode('last-30'));
    
    // Initialize chart
    initChart();
    
    // Load initial data
    loadDashboardData();
    
    // Initialize Google Map
    initMap();
  }
  
  // Start auto-refresh of dashboard data
  function startAutoRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    // Set up new interval - refresh every 30 seconds
    refreshInterval = setInterval(() => {
      loadDashboardData();
      updateLastUpdatedTime();
    }, 30000);
    
    // Initial update
    updateLastUpdatedTime();
  }
  
  // Update the "last updated" timestamp
  function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('last-updated-time').textContent = timeString;
  }
  
  // Initialize traffic chart
  function initChart() {
    const ctx = document.getElementById('traffic-chart').getContext('2d');
    
    trafficChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Số lượng phương tiện',
          data: [],
          backgroundColor: 'rgba(52, 152, 219, 0.5)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
              text: 'Thời gian'
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: function(tooltipItems) {
                return tooltipItems[0].label;
              },
              label: function(context) {
                return `Phương tiện: ${context.parsed.y}`;
              }
            }
          }
        }
      }
    });
  }
  
  // Switch between different chart modes (hourly, minute, last 30 minutes)
  function switchChartMode(mode) {
    currentChartMode = mode;
    
    // Update button states
    document.getElementById('btn-hourly').className = mode === 'hourly' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary';
    document.getElementById('btn-minute').className = mode === 'minute' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary';
    document.getElementById('btn-last-30').className = mode === 'last-30' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary';
    
    // Update chart data based on mode
    if (mode === 'hourly') {
      fetchHourlyStats();
    } else if (mode === 'minute') {
      fetchMinuteStats();
    } else if (mode === 'last-30') {
      fetchLast30MinutesStats();
    }
  }
  
  // Load all dashboard data
  function loadDashboardData() {
    fetchActiveCameras();
    fetchTodayVehicleCount();
    fetchTrafficAlerts();
    fetchCameraLocations();
    
    // Update the chart based on current mode
    switchChartMode(currentChartMode);
  }
  
  // Fetch active cameras information
  function fetchActiveCameras() {
    fetch('/api/statistics/active-cameras')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          document.getElementById('active-cameras-value').textContent = data.data.active;
          document.getElementById('total-cameras-value').textContent = data.data.total;
        } else {
          console.error('Error fetching active cameras:', data.message);
        }
      })
      .catch(error => console.error('Error fetching active cameras:', error));
  }
  
  // Fetch today's vehicle count
  function fetchTodayVehicleCount() {
    fetch('/api/statistics/today-vehicles')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          document.getElementById('today-vehicles-value').textContent = data.data.total.toLocaleString();
          
          // Update vehicle type breakdown
          document.getElementById('car-count').textContent = data.data.byType.car.toLocaleString();
          document.getElementById('truck-count').textContent = data.data.byType.truck.toLocaleString();
          document.getElementById('bus-count').textContent = data.data.byType.bus.toLocaleString();
          document.getElementById('motorcycle-count').textContent = data.data.byType.motorcycle.toLocaleString();
          document.getElementById('bicycle-count').textContent = data.data.byType.bicycle.toLocaleString();
        } else {
          console.error('Error fetching today\'s vehicle count:', data.message);
        }
      })
      .catch(error => console.error('Error fetching today\'s vehicle count:', error));
  }
  
  // Fetch hourly statistics for chart
  function fetchHourlyStats() {
    fetch('/api/statistics/hourly-stats')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          updateChart(data.data.labels, data.data.datasets[0].data, 'Phương tiện theo giờ');
        } else {
          console.error('Error fetching hourly stats:', data.message);
        }
      })
      .catch(error => console.error('Error fetching hourly stats:', error));
  }
  
  // Fetch minute statistics for chart
  function fetchMinuteStats() {
    // Get current hour from system
    const currentHour = new Date().getHours();
    
    fetch(`/api/statistics/minute-stats?hour=${currentHour}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          updateChart(data.data.labels, data.data.datasets[0].data, `Phương tiện theo phút (Giờ ${currentHour}:00)`);
        } else {
          console.error('Error fetching minute stats:', data.message);
        }
      })
      .catch(error => console.error('Error fetching minute stats:', error));
  }
  
  // Fetch last 30 minutes statistics for chart
  function fetchLast30MinutesStats() {
    fetch('/api/statistics/last-30-minutes')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          updateChart(data.data.labels, data.data.datasets[0].data, '30 phút gần đây');
        } else {
          console.error('Error fetching last 30 minutes stats:', data.message);
        }
      })
      .catch(error => console.error('Error fetching last 30 minutes stats:', error));
  }
  
  // Fetch traffic alerts
  function fetchTrafficAlerts() {
    fetch('/api/statistics/traffic-alerts')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const alertsContainer = document.getElementById('alerts-container');
          const alertsData = data.data;
          
          // Update alerts count
          document.getElementById('alerts-value').textContent = alertsData.length;
          
          // Clear existing alerts
          alertsContainer.innerHTML = '';
          
          if (alertsData.length > 0) {
            // Create alert items
            alertsData.forEach(alert => {
              const alertItem = createAlertItem(alert);
              alertsContainer.appendChild(alertItem);
            });
          } else {
            // No alerts message
            const noAlertsMessage = document.createElement('div');
            noAlertsMessage.className = 'no-alerts-message';
            noAlertsMessage.innerHTML = '<i class="fas fa-check-circle"></i><span>Không có cảnh báo kẹt xe</span>';
            alertsContainer.appendChild(noAlertsMessage);
          }
        } else {
          console.error('Error fetching traffic alerts:', data.message);
        }
      })
      .catch(error => console.error('Error fetching traffic alerts:', error));
  }
  
  // Create alert item HTML element
  function createAlertItem(alert) {
    const alertItem = document.createElement('div');
    alertItem.className = `alert-item ${alert.level}`;
    
    // Format timestamp
    const timestamp = new Date(alert.latestUpdate);
    const formattedTime = timestamp.toLocaleTimeString();
    
    alertItem.innerHTML = `
      <div class="alert-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <div class="alert-content">
        <div class="alert-location">${alert.camera_name}</div>
        <div class="alert-info">
          <span class="badge ${alert.level === 'high' ? 'bg-danger' : 'bg-warning'} text-white">
            ${alert.level === 'high' ? 'Kẹt xe nghiêm trọng' : 'Kẹt xe vừa phải'}
          </span>
          <span class="ms-2">Trung bình: ${alert.avgVehicles} phương tiện</span>
        </div>
        <div class="alert-time">Cập nhật lúc: ${formattedTime}</div>
      </div>
    `;
    
    return alertItem;
  }
  
  // Update chart with new data
  function updateChart(labels, data, title) {
    trafficChart.data.labels = labels;
    trafficChart.data.datasets[0].data = data;
    trafficChart.data.datasets[0].label = title;
    trafficChart.options.scales.x.title.text = title;
    trafficChart.update();
  }
  
  // Google Maps initialization
  let map;
  let markers = [];
  
  function initMap() {
    // Default center (Vietnam)
    const defaultCenter = { lat: 16.047079, lng: 108.206230 };
    
    map = new google.maps.Map(document.getElementById("map-container"), {
      zoom: 12,
      center: defaultCenter,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapTypeControl: true,
      streetViewControl: true,
      rotateControl: true,
    });
    
    // Load camera locations
    fetchCameraLocations();
  }
  
  // Fetch camera locations for the map
  function fetchCameraLocations() {
    fetch('/api/statistics/camera-locations')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Clear existing markers
          clearMapMarkers();
          
          const cameras = data.data;
          let bounds = new google.maps.LatLngBounds();
          let hasValidCoordinates = false;
          
          // Add markers for each camera
          cameras.forEach(camera => {
            if (camera.coordinates) {
              hasValidCoordinates = true;
              addCameraMarker(camera);
              bounds.extend(new google.maps.LatLng(
                camera.coordinates.lat,
                camera.coordinates.lng
              ));
            }
          });
          
          // Fit map to show all markers if there are valid coordinates
          if (hasValidCoordinates) {
            map.fitBounds(bounds);
            
            // Zoom out slightly to give some padding around markers
            const listener = google.maps.event.addListenerOnce(map, 'idle', function() {
              if (map.getZoom() > 15) {
                map.setZoom(15);
              }
            });
          }
        } else {
          console.error('Error fetching camera locations:', data.message);
        }
      })
      .catch(error => console.error('Error fetching camera locations:', error));
  }
  
  // Add camera marker to the map
  function addCameraMarker(camera) {
    const marker = new google.maps.Marker({
      position: camera.coordinates,
      map: map,
      title: camera.name,
      icon: {
        url: camera.isActive ? 
          'https://maps.google.com/mapfiles/ms/icons/green-dot.png' : 
          'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        scaledSize: new google.maps.Size(30, 30)
      },
      animation: google.maps.Animation.DROP
    });
    
    // Create info window content
    const contentString = `
      <div class="info-window">
        <h5>${camera.name}</h5>
        <p><strong>Địa điểm:</strong> ${camera.location}</p>
        <p><strong>Trạng thái:</strong> 
          <span class="badge ${camera.isActive ? 'bg-success' : 'bg-danger'}">
            ${camera.isActive ? 'Đang hoạt động' : 'Không hoạt động'}
          </span>
        </p>
        <a href="/views/cameras/${camera.id}" class="btn btn-sm btn-primary mt-2">Xem chi tiết</a>
      </div>
    `;
    
    const infowindow = new google.maps.InfoWindow({
      content: contentString,
      maxWidth: 250
    });
    
    // Add click event to show info window
    marker.addListener("click", () => {
      infowindow.open({
        anchor: marker,
        map,
      });
    });
    
    // Store marker for later reference
    markers.push(marker);
  }
  
  // Clear all markers from the map
  function clearMapMarkers() {
    markers.forEach(marker => {
      marker.setMap(null);
    });
    markers = [];
  }
  
  // Global function to initialize Google Map
  window.initMap = initMap;
});
// Traffic Statistics Component
class TrafficStatistics {
    constructor() {
        this.chart = null;
        this.currentCamera = null;
        this.currentDate = new Date().toISOString().split('T')[0];
        this.init();
    }

    init() {
        // Initialize date picker
        const datePicker = document.getElementById('statistics-date');
        if (datePicker) {
            datePicker.value = this.currentDate;
            datePicker.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
                this.loadStatistics();
            });
        }

        // Initialize camera selector
        const cameraSelect = document.getElementById('camera-select');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => {
                this.currentCamera = e.target.value;
                this.loadStatistics();
            });
        }

        // Initialize chart
        this.initChart();
    }

    initChart() {
        const ctx = document.getElementById('traffic-statistics-chart');
        if (!ctx) return;

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Tổng số xe',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    },
                    {
                        label: 'Ô tô',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    },
                    {
                        label: 'Xe tải',
                        data: [],
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.1
                    },
                    {
                        label: 'Xe bus',
                        data: [],
                        borderColor: 'rgb(255, 206, 86)',
                        tension: 0.1
                    },
                    {
                        label: 'Xe máy',
                        data: [],
                        borderColor: 'rgb(153, 102, 255)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    async loadStatistics() {
        if (!this.currentCamera) return;

        try {
            const response = await fetch(`/api/traffic-statistics/by-date?camera_id=${this.currentCamera}&date=${this.currentDate}`);
            const data = await response.json();

            if (!data.success) {
                console.error('Error loading statistics:', data.message);
                return;
            }

            this.updateChart(data.data);
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    updateChart(statistics) {
        if (!this.chart) return;

        // Prepare data
        const labels = statistics.map(stat => {
            const hour = Math.floor(stat.minute_of_day / 60);
            const minute = stat.minute_of_day % 60;
            return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        });

        const totalData = statistics.map(stat => stat.vehicle_count);
        const carData = statistics.map(stat => stat.vehicle_types.car);
        const truckData = statistics.map(stat => stat.vehicle_types.truck);
        const busData = statistics.map(stat => stat.vehicle_types.bus);
        const motorcycleData = statistics.map(stat => stat.vehicle_types.motorcycle);

        // Update chart
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = totalData;
        this.chart.data.datasets[1].data = carData;
        this.chart.data.datasets[2].data = truckData;
        this.chart.data.datasets[3].data = busData;
        this.chart.data.datasets[4].data = motorcycleData;

        this.chart.update();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.trafficStatistics = new TrafficStatistics();
});

document.addEventListener('DOMContentLoaded', function() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const filterBtn = document.getElementById('filterBtn');
    const statisticsTable = document.getElementById('statisticsTable');
    let trafficChart;

    // Initialize chart with initial data
    initChart();

    // Add event listener for filter button
    filterBtn.addEventListener('click', function() {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        loadStatistics(startDate, endDate);
    });

    function initChart() {
        const ctx = document.getElementById('trafficChart').getContext('2d');
        const initialData = window.initialStatistics || [];

        trafficChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: initialData.map(item => item.date),
                datasets: [{
                    label: 'Total Vehicles',
                    data: initialData.map(item => item.totalVehicles),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }, {
                    label: 'Violations',
                    data: initialData.map(item => item.violations),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Traffic Statistics'
                    }
                }
            }
        });
    }

    function loadStatistics(startDate, endDate) {
        fetch(`/api/statistics?startDate=${startDate}&endDate=${endDate}`)
            .then(response => response.json())
            .then(data => {
                updateChart(data);
                updateTable(data);
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to load statistics');
            });
    }

    function updateChart(data) {
        const labels = data.map(item => item.date);
        const totalVehicles = data.map(item => item.totalVehicles);
        const violations = data.map(item => item.violations);

        trafficChart.data.labels = labels;
        trafficChart.data.datasets[0].data = totalVehicles;
        trafficChart.data.datasets[1].data = violations;
        trafficChart.update();
    }

    function updateTable(data) {
        statisticsTable.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.date}</td>
                <td>${item.totalVehicles}</td>
                <td>${item.violations}</td>
            `;
            statisticsTable.appendChild(row);
        });
    }
}); 
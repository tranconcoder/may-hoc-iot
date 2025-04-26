/**
 * Statistics API Client
 * Cung cấp các hàm để gọi API thống kê
 */

/**
 * Lấy dữ liệu thống kê camera đang hoạt động
 * @returns {Promise} Promise chứa dữ liệu về camera đang hoạt động
 */
async function getActiveCameras() {
  try {
    const response = await fetch("/api/statistics/active-cameras");
    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        data: data.data,
      };
    } else {
      console.error("Lỗi khi lấy dữ liệu camera hoạt động:", data.message);
      return {
        success: false,
        error: data.message,
      };
    }
  } catch (error) {
    console.error("Lỗi khi gọi API camera hoạt động:", error);
    return {
      success: false,
      error: "Không thể kết nối đến máy chủ",
    };
  }
}

/**
 * Lấy số lượng phương tiện trong ngày hôm nay
 * @returns {Promise} Promise chứa dữ liệu về phương tiện trong ngày
 */
async function getTodayVehicleCount() {
  try {
    const response = await fetch("/api/statistics/today-vehicles");
    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        data: data.data,
      };
    } else {
      console.error(
        "Lỗi khi lấy dữ liệu phương tiện trong ngày:",
        data.message
      );
      return {
        success: false,
        error: data.message,
      };
    }
  } catch (error) {
    console.error("Lỗi khi gọi API phương tiện trong ngày:", error);
    return {
      success: false,
      error: "Không thể kết nối đến máy chủ",
    };
  }
}

/**
 * Lấy dữ liệu thống kê theo giờ
 * @param {string} date - Ngày cần lấy thống kê (định dạng YYYY-MM-DD), mặc định là ngày hiện tại
 * @returns {Promise} Promise chứa dữ liệu thống kê theo giờ
 */
async function getHourlyStats(date) {
  try {
    const url = date
      ? `/api/statistics/hourly-stats?date=${date}`
      : "/api/statistics/hourly-stats";
    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        data: data.data,
      };
    } else {
      console.error("Lỗi khi lấy dữ liệu thống kê theo giờ:", data.message);
      return {
        success: false,
        error: data.message,
      };
    }
  } catch (error) {
    console.error("Lỗi khi gọi API thống kê theo giờ:", error);
    return {
      success: false,
      error: "Không thể kết nối đến máy chủ",
    };
  }
}

/**
 * Lấy các cảnh báo kẹt xe
 * @returns {Promise} Promise chứa dữ liệu cảnh báo kẹt xe
 */
async function getTrafficAlerts() {
  try {
    const response = await fetch("/api/statistics/traffic-alerts");
    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        data: data.data,
      };
    } else {
      console.error("Lỗi khi lấy dữ liệu cảnh báo kẹt xe:", data.message);
      return {
        success: false,
        error: data.message,
      };
    }
  } catch (error) {
    console.error("Lỗi khi gọi API cảnh báo kẹt xe:", error);
    return {
      success: false,
      error: "Không thể kết nối đến máy chủ",
    };
  }
}

/**
 * Lấy vị trí của các camera
 * @returns {Promise} Promise chứa dữ liệu vị trí camera
 */
async function getCameraLocations() {
  try {
    const response = await fetch("/api/statistics/camera-locations");
    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        data: data.data,
      };
    } else {
      console.error("Lỗi khi lấy dữ liệu vị trí camera:", data.message);
      return {
        success: false,
        error: data.message,
      };
    }
  } catch (error) {
    console.error("Lỗi khi gọi API vị trí camera:", error);
    return {
      success: false,
      error: "Không thể kết nối đến máy chủ",
    };
  }
}

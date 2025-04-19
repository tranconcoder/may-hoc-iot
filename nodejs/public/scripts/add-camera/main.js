document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo các phần tử DOM
  const cancelBtn = document.getElementById("cancelBtn");
  const addCameraForm = document.getElementById("addCameraForm");
  const previewArea = document.getElementById("camera-preview-area");
  const previewImage = document.getElementById("preview-image");
  const tracklineIndicator = document.getElementById("trackline-indicator");
  const tracklineYSlider = document.getElementById("trackline_y_slider");
  const tracklineYValue = document.getElementById("trackline_y_value");
  const tracklineYInput = document.getElementById("trackline_y");
  const imageUpload = document.getElementById("camera-image-upload");

  // Khởi tạo trackline
  initTrackline();

  // Xử lý tải lên hình ảnh
  if (imageUpload) {
    imageUpload.addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function (event) {
          previewImage.src = event.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });
  }

  // Xử lý trackline slider
  if (tracklineYSlider) {
    tracklineYSlider.addEventListener("input", function () {
      updateTracklinePosition(parseInt(this.value));
    });
  }

  // Xử lý click trên hình ảnh
  if (previewArea) {
    previewArea.addEventListener("click", function (e) {
      const rect = previewArea.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percentage = Math.round((y / rect.height) * 100);
      updateTracklinePosition(percentage);
    });
  }

  // Xử lý nút hủy
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      if (
        confirm(
          "Bạn có chắc chắn muốn hủy thêm camera? Mọi thông tin đã nhập sẽ bị mất."
        )
      ) {
        window.location.href = "/views/cameras";
      }
    });
  }

  // Xử lý form submit
  if (addCameraForm) {
    addCameraForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Kiểm tra form hợp lệ
      let isValid = true;
      const cameraName = document.getElementById("camera_name").value.trim();
      const cameraLocation = document
        .getElementById("camera_location")
        .value.trim();
      const tracklineY = tracklineYInput.value.trim();

      if (!cameraName) {
        document.getElementById("camera_name").classList.add("is-invalid");
        isValid = false;
      } else {
        document.getElementById("camera_name").classList.remove("is-invalid");
      }

      if (!cameraLocation) {
        document.getElementById("camera_location").classList.add("is-invalid");
        isValid = false;
      } else {
        document
          .getElementById("camera_location")
          .classList.remove("is-invalid");
      }

      if (
        !tracklineY ||
        isNaN(parseInt(tracklineY)) ||
        parseInt(tracklineY) < 0 ||
        parseInt(tracklineY) > 100
      ) {
        tracklineYInput.parentElement.querySelector(
          ".invalid-feedback"
        ).style.display = "block";
        isValid = false;
      } else {
        tracklineYInput.parentElement.querySelector(
          ".invalid-feedback"
        ).style.display = "none";
      }

      if (!isValid) {
        return false;
      }

      // Thu thập dữ liệu từ form
      const cameraData = {
        camera_name: cameraName,
        camera_location: cameraLocation,
        trackline_y: parseInt(tracklineY),
      };

      console.log("Camera data to save:", cameraData);

      // Gửi dữ liệu lên server API
      fetch("/api/camera/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cameraData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Không thể lưu camera");
          }
          return response.json();
        })
        .then((data) => {
          // Hiển thị thông báo thành công
          const alertContainer = document.getElementById("alert-container");
          alertContainer.innerHTML = `
            <div class="alert alert-success">
              <i class="fas fa-check-circle"></i> Thêm camera thành công!
            </div>
          `;

          // Reset form
          addCameraForm.reset();

          // Chuyển hướng sau 2 giây
          setTimeout(() => {
            window.location.href = "/views/cameras";
          }, 2000);
        })
        .catch((error) => {
          // Hiển thị thông báo lỗi
          const alertContainer = document.getElementById("alert-container");
          alertContainer.innerHTML = `
            <div class="alert alert-danger">
              <i class="fas fa-exclamation-circle"></i> Lỗi: ${error.message}
            </div>
          `;
        });
    });
  }

  // Hàm khởi tạo trackline
  function initTrackline() {
    if (tracklineIndicator && previewArea) {
      // Đặt vị trí mặc định là 50%
      updateTracklinePosition(50);
    }
  }

  // Hàm cập nhật vị trí trackline
  function updateTracklinePosition(percentage) {
    if (
      tracklineIndicator &&
      tracklineYSlider &&
      tracklineYValue &&
      tracklineYInput
    ) {
      // Giới hạn giá trị trong khoảng 0-100
      percentage = Math.max(0, Math.min(100, percentage));

      // Cập nhật vị trí của trackline
      const position = `${percentage}%`;
      tracklineIndicator.style.top = position;

      // Cập nhật giá trị slider
      tracklineYSlider.value = percentage;

      // Cập nhật text hiển thị
      tracklineYValue.textContent = percentage;

      // Cập nhật giá trị input hidden
      tracklineYInput.value = percentage;
    }
  }
});

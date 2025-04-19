document.addEventListener("DOMContentLoaded", function () {
  // Xử lý nút hủy
  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      if (
        confirm(
          "Bạn có chắc chắn muốn hủy thêm camera? Mọi thông tin đã nhập sẽ bị mất."
        )
      ) {
        window.location.href = "/views/dashboard/cameras";
      }
    });
  }

  // Xử lý form submit
  const addCameraForm = document.getElementById("addCameraForm");
  if (addCameraForm) {
    addCameraForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Kiểm tra form hợp lệ
      let isValid = true;
      const cameraName = document.getElementById("camera_name").value.trim();
      const cameraLocation = document
        .getElementById("camera_location")
        .value.trim();

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

      if (!isValid) {
        return false;
      }

      // Thu thập dữ liệu từ form
      const cameraData = {
        camera_name: cameraName,
        camera_location: cameraLocation,
      };

      console.log("Camera data to save:", cameraData);

      // Gửi dữ liệu lên server API mới
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
            window.location.href = "/views/dashboard/cameras";
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
});

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
  const addLanePointBtn = document.getElementById("add-lane-point");
  const clearLanePointsBtn = document.getElementById("clear-lane-points");
  const lanePointsContainer = document.getElementById("lane-points-container");
  const laneVehiclesContainer = document.getElementById(
    "lane-vehicles-container"
  );
  const laneTrackPointsInput = document.getElementById("lane_track_points");
  const laneVehiclesInput = document.getElementById("lane_vehicles");

  // Khởi tạo biến theo dõi
  let lanePoints = []; // Mảng các điểm phân làn (tính theo %)
  let activeLanePoint = null; // Điểm đang được kéo
  let isDragging = false; // Trạng thái kéo thả
  let previewRect = previewArea.getBoundingClientRect(); // Kích thước vùng hiển thị

  // Khởi tạo các loại phương tiện
  const vehicleTypes = {
    car: { name: "Xe ô tô", icon: "fa-car" },
    truck: { name: "Xe tải", icon: "fa-truck" },
    bus: { name: "Xe buýt", icon: "fa-bus" },
    motorcycle: { name: "Xe máy", icon: "fa-motorcycle" },
    bicycle: { name: "Xe đạp", icon: "fa-bicycle" },
    "*": { name: "Tất cả", icon: "fa-road" },
  };

  // Mảng chứa thông tin phương tiện được phép trong từng làn
  let laneVehicles = [];

  // Khởi tạo trackline
  initTrackline();

  // Xử lý tải lên hình ảnh
  if (imageUpload) {
    imageUpload.addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function (event) {
          previewImage.src = event.target.result;

          // Cập nhật lại kích thước vùng hiển thị sau khi tải ảnh mới
          setTimeout(() => {
            previewRect = previewArea.getBoundingClientRect();
            // Vẽ lại các điểm phân làn nếu đã có
            renderLanePoints();
            renderLaneDividers();
          }, 100);
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

  // Xử lý click trên hình ảnh để đặt trackline
  if (previewArea) {
    previewArea.addEventListener("click", function (e) {
      // Chỉ xử lý click khi không ở chế độ kéo thả điểm
      if (!isDragging) {
        const rect = previewArea.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const percentage = Math.round((y / rect.height) * 100);
        updateTracklinePosition(percentage);
      }
    });
  }

  // Xử lý nút thêm điểm phân làn
  if (addLanePointBtn) {
    addLanePointBtn.addEventListener("click", function () {
      addLanePoint();
    });
  }

  // Xử lý nút xóa tất cả điểm phân làn
  if (clearLanePointsBtn) {
    clearLanePointsBtn.addEventListener("click", function () {
      clearLanePoints();
    });
  }

  // Xử lý sự kiện chuột để kéo thả điểm phân làn
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

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
        camera_track_line_y: parseInt(tracklineY),
        camera_lane_track_point: lanePoints,
        camera_lane_vehicles: laneVehicles,
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
    // Đặt vị trí mặc định cho trackline
    updateTracklinePosition(50);
  }

  // Hàm cập nhật vị trí trackline
  function updateTracklinePosition(percentage) {
    if (tracklineIndicator && previewArea) {
      const previewHeight = previewArea.offsetHeight;
      const yPosition = (percentage / 100) * previewHeight;

      tracklineIndicator.style.top = `${yPosition}px`;
      tracklineYValue.textContent = percentage;
      tracklineYSlider.value = percentage;
      tracklineYInput.value = percentage;
    }
  }

  // Hàm thêm điểm phân làn
  function addLanePoint() {
    // Mặc định thêm điểm ở giữa khung hình
    const newPoint = 50; // 50% từ trái sang
    lanePoints.push(newPoint);

    // Sắp xếp lại các điểm theo thứ tự tăng dần
    lanePoints.sort((a, b) => a - b);

    // Cập nhật giao diện
    renderLanePoints();
    renderLaneDividers();
    updateLaneVehiclesConfig();

    // Cập nhật dữ liệu cho form
    updateFormData();
  }

  // Hàm xóa tất cả điểm phân làn
  function clearLanePoints() {
    lanePoints = [];
    laneVehicles = [["*"]]; // Reset về một làn mặc định cho tất cả phương tiện

    // Cập nhật giao diện
    renderLanePoints();
    renderLaneDividers();
    updateLaneVehiclesConfig();

    // Cập nhật dữ liệu cho form
    updateFormData();
  }

  // Hàm cập nhật dữ liệu form
  function updateFormData() {
    laneTrackPointsInput.value = JSON.stringify(lanePoints);
    laneVehiclesInput.value = JSON.stringify(laneVehicles);
  }

  // Hàm vẽ các điểm phân làn
  function renderLanePoints() {
    // Xóa tất cả các điểm cũ
    lanePointsContainer.innerHTML = "";

    // Vẽ lại các điểm mới
    lanePoints.forEach((point, index) => {
      const pointElement = document.createElement("div");
      pointElement.className = "lane-point";
      pointElement.dataset.index = index;

      const label = document.createElement("div");
      label.className = "lane-point-label";
      label.textContent = `Điểm ${index + 1}`;

      pointElement.appendChild(label);
      lanePointsContainer.appendChild(pointElement);

      // Đặt vị trí cho điểm
      const xPos = (point / 100) * previewArea.offsetWidth;
      pointElement.style.left = `${xPos}px`;
      pointElement.style.top = `${tracklineYInput.value}%`;

      // Thêm xử lý sự kiện chuột
      pointElement.addEventListener("mousedown", function (e) {
        activeLanePoint = {
          element: pointElement,
          index: index,
          offsetX: e.clientX - pointElement.getBoundingClientRect().left,
        };
        isDragging = true;

        // Thêm class active cho điểm đang kéo
        pointElement.classList.add("active");

        e.preventDefault();
      });
    });
  }

  // Hàm vẽ các đường phân làn
  function renderLaneDividers() {
    // Xóa tất cả các đường phân làn cũ
    const oldDividers = document.querySelectorAll(".lane-divider");
    oldDividers.forEach((divider) => divider.remove());

    // Vẽ đường phân làn mới
    lanePoints.forEach((point) => {
      const divider = document.createElement("div");
      divider.className = "lane-divider";

      const xPos = (point / 100) * previewArea.offsetWidth;
      divider.style.left = `${xPos}px`;

      previewArea.appendChild(divider);
    });
  }

  // Hàm xử lý di chuyển chuột khi kéo điểm
  function handleMouseMove(e) {
    if (!isDragging || !activeLanePoint) return;

    const rect = previewArea.getBoundingClientRect();
    let xPos = e.clientX - rect.left - activeLanePoint.offsetX;

    // Giới hạn trong phạm vi khung hình
    if (xPos < 0) xPos = 0;
    if (xPos > rect.width) xPos = rect.width;

    // Cập nhật vị trí điểm
    const percentage = Math.round((xPos / rect.width) * 100);
    lanePoints[activeLanePoint.index] = percentage;

    // Cập nhật giao diện
    renderLanePoints();
    renderLaneDividers();
    updateFormData();
  }

  // Hàm xử lý thả chuột
  function handleMouseUp() {
    if (!isDragging) return;

    isDragging = false;

    if (activeLanePoint) {
      // Sắp xếp lại mảng điểm
      lanePoints.sort((a, b) => a - b);

      // Cập nhật lại giao diện
      renderLanePoints();
      renderLaneDividers();
      updateLaneVehiclesConfig();
      updateFormData();

      activeLanePoint = null;
    }
  }

  // Hàm cập nhật cấu hình phương tiện cho từng làn
  function updateLaneVehiclesConfig() {
    // Số lượng làn = số điểm phân làn + 1
    const laneCount = lanePoints.length + 1;

    // Cập nhật mảng laneVehicles cho đúng số làn
    while (laneVehicles.length < laneCount) {
      laneVehicles.push(["*"]); // Thêm làn mới với giá trị mặc định cho phép tất cả phương tiện
    }

    if (laneVehicles.length > laneCount) {
      laneVehicles = laneVehicles.slice(0, laneCount);
    }

    // Render lại giao diện cấu hình phương tiện
    renderVehicleConfig();

    // Cập nhật dữ liệu form
    updateFormData();
  }

  // Hàm hiển thị giao diện cấu hình phương tiện
  function renderVehicleConfig() {
    laneVehiclesContainer.innerHTML = "";

    if (lanePoints.length === 0) {
      // Nếu không có điểm phân làn, hiển thị thông báo
      laneVehiclesContainer.innerHTML = `
        <div class="text-muted mb-2">
          <i class="fas fa-info-circle"></i> Hãy thêm các điểm phân làn để cấu hình phương tiện cho từng làn
        </div>
      `;
      return;
    }

    // Hiển thị cấu hình cho từng làn
    for (let i = 0; i < laneVehicles.length; i++) {
      const laneConfig = document.createElement("div");
      laneConfig.className = "lane-config";

      // Tiêu đề làn
      const laneHeader = document.createElement("div");
      laneHeader.className = "lane-config-header";

      const laneTitle = document.createElement("div");
      laneTitle.className = "lane-title";

      // Đặt tên cho làn
      if (i === 0) {
        laneTitle.innerHTML = `<i class="fas fa-road"></i> Làn 1 (trái)`;
      } else if (i === laneVehicles.length - 1) {
        laneTitle.innerHTML = `<i class="fas fa-road"></i> Làn ${i + 1} (phải)`;
      } else {
        laneTitle.innerHTML = `<i class="fas fa-road"></i> Làn ${i + 1}`;
      }

      laneHeader.appendChild(laneTitle);
      laneConfig.appendChild(laneHeader);

      // Phần chọn phương tiện
      const vehicleSelection = document.createElement("div");
      vehicleSelection.className = "vehicle-selection";

      // Render các checkbox cho từng loại phương tiện
      Object.entries(vehicleTypes).forEach(([type, info]) => {
        const vehicleLabel = document.createElement("label");
        const isChecked = laneVehicles[i].includes(type);
        vehicleLabel.className = `vehicle-checkbox${
          isChecked ? " active" : ""
        }`;
        vehicleLabel.dataset.lane = i;
        vehicleLabel.dataset.type = type;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isChecked;

        vehicleLabel.innerHTML = `<i class="fas ${info.icon} vehicle-icon"></i> ${info.name}`;
        vehicleLabel.prepend(checkbox);

        // Xử lý sự kiện khi người dùng chọn/bỏ chọn phương tiện
        vehicleLabel.addEventListener("click", function (event) {
          // Ngăn chặn sự kiện lan truyền để không kích hoạt lại khi nhấp vào checkbox
          event.preventDefault();

          const lane = parseInt(this.dataset.lane);
          const type = this.dataset.type;
          const currentCheckbox = this.querySelector('input[type="checkbox"]');
          const isCurrentlyChecked = currentCheckbox.checked;

          // Đảo ngược trạng thái checkbox
          currentCheckbox.checked = !isCurrentlyChecked;

          // Cập nhật class cho label
          if (currentCheckbox.checked) {
            this.classList.add("active");
          } else {
            this.classList.remove("active");
          }

          // Nếu là wildcard "*" (tất cả phương tiện)
          if (type === "*") {
            // Nếu đang được chọn mới, chọn *
            if (currentCheckbox.checked) {
              // Chỉ giữ "*" và bỏ tất cả loại khác
              laneVehicles[lane] = ["*"];

              // Cập nhật UI: bỏ chọn tất cả các loại khác
              const otherLabels = vehicleSelection.querySelectorAll(
                `.vehicle-checkbox:not([data-type="*"])`
              );
              otherLabels.forEach((label) => {
                label.classList.remove("active");
                label.querySelector('input[type="checkbox"]').checked = false;
              });
            } else {
              // Nếu bỏ chọn "*", chọn tất cả các loại khác
              laneVehicles[lane] = Object.keys(vehicleTypes).filter(
                (t) => t !== "*"
              );

              // Cập nhật UI: chọn tất cả các loại khác
              const otherLabels = vehicleSelection.querySelectorAll(
                `.vehicle-checkbox:not([data-type="*"])`
              );
              otherLabels.forEach((label) => {
                label.classList.add("active");
                label.querySelector('input[type="checkbox"]').checked = true;
              });
            }
          } else {
            // Đang xử lý một loại phương tiện cụ thể
            if (currentCheckbox.checked) {
              // Thêm vào mảng phương tiện được phép
              if (laneVehicles[lane].includes("*")) {
                // Nếu đang bật tất cả, thì chuyển sang chế độ chọn từng loại
                laneVehicles[lane] = Object.keys(vehicleTypes).filter(
                  (t) => t !== "*"
                );

                // Cập nhật UI: chọn tất cả các loại ngoại trừ "*"
                const allLabels =
                  vehicleSelection.querySelectorAll(".vehicle-checkbox");
                allLabels.forEach((label) => {
                  if (label.dataset.type === "*") {
                    label.classList.remove("active");
                    label.querySelector(
                      'input[type="checkbox"]'
                    ).checked = false;
                  } else {
                    label.classList.add("active");
                    label.querySelector(
                      'input[type="checkbox"]'
                    ).checked = true;
                  }
                });
              } else {
                // Thêm loại phương tiện này vào danh sách cho phép
                if (!laneVehicles[lane].includes(type)) {
                  laneVehicles[lane].push(type);
                }
              }
            } else {
              // Bỏ loại phương tiện này khỏi danh sách cho phép
              laneVehicles[lane] = laneVehicles[lane].filter((t) => t !== type);

              // Nếu không còn loại phương tiện nào được chọn, mặc định cho phép tất cả
              if (laneVehicles[lane].length === 0) {
                laneVehicles[lane] = ["*"];

                // Cập nhật UI: chỉ chọn "*"
                const allLabels =
                  vehicleSelection.querySelectorAll(".vehicle-checkbox");
                allLabels.forEach((label) => {
                  if (label.dataset.type === "*") {
                    label.classList.add("active");
                    label.querySelector(
                      'input[type="checkbox"]'
                    ).checked = true;
                  } else {
                    label.classList.remove("active");
                    label.querySelector(
                      'input[type="checkbox"]'
                    ).checked = false;
                  }
                });
              }
            }
          }

          // Cập nhật dữ liệu form (không cần render lại UI)
          updateFormData();
        });

        vehicleSelection.appendChild(vehicleLabel);
      });

      laneConfig.appendChild(vehicleSelection);
      laneVehiclesContainer.appendChild(laneConfig);
    }
  }
});

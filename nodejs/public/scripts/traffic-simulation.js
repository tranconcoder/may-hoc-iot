/**
 * Traffic Simulation JavaScript
 * Mô phỏng tuyến đường với đèn giao thông và phương tiện
 */
document.addEventListener("DOMContentLoaded", function () {
  // Canvas và Context
  const canvas = document.getElementById("trafficCanvas");
  const ctx = canvas.getContext("2d");

  // Các thông số cấu hình - Khai báo trước khi sử dụng
  const config = {
    laneWidth: 80, // Chiều rộng của mỗi làn (sẽ được điều chỉnh tự động sau)
    laneLength: 0,
    roadColor: "#333",
    laneMarkingColor: "#fff",
    trafficLightWidth: 40,
    trafficLightHeight: 100,
    vehicleDefaultWidth: 60, // Kích thước mặc định cho xe
    vehicleDefaultHeight: 30,
    vehicleSizePercent: 100, // Phần trăm kích thước so với mặc định
    isVertical: true, // Thêm cấu hình để vẽ làn đường theo chiều dọc
    bottomToTop: true, // Thêm cấu hình cho hướng di chuyển từ dưới lên trên
    keepAspectRatio: false, // Giữ tỷ lệ khi thay đổi kích thước
    originalImageRatio: 2.0, // Tỷ lệ mặc định (sẽ được cập nhật khi tải ảnh)
  };

  // Các elements DOM
  const laneCountInput = document.getElementById("laneCount");
  const applyLaneBtn = document.getElementById("applyLaneBtn");
  const vehicleImageInput = document.getElementById("vehicleImage");
  const addVehicleBtn = document.getElementById("addVehicleBtn");
  const addTrafficLightBtn = document.getElementById("addTrafficLightBtn");
  const trafficLightCountInput = document.getElementById("trafficLightCount");
  const resetBtn = document.getElementById("resetBtn");
  const saveBtn = document.getElementById("saveBtn");
  const startSimulationBtn = document.getElementById("startSimulationBtn");
  const stopSimulationBtn = document.getElementById("stopSimulationBtn");
  const simulationSpeedInput = document.getElementById("simulationSpeed");
  const presetVehicles = document.querySelectorAll(".preset-vehicle");
  const eventsContainer = document.getElementById("eventsContainer");

  // Thanh trượt kích thước phần trăm và nút preset
  const vehicleSizePercentInput = document.getElementById("vehicleSizePercent");
  const vehicleSizeValue = document.getElementById("vehicleSizeValue");
  const sizePresetButtons = document.querySelectorAll(".size-preset");

  // Các biến trạng thái của ứng dụng
  let laneCount = parseInt(laneCountInput.value) || 2; // Đảm bảo laneCount có giá trị mặc định
  let lanes = [];
  let trafficLights = [];
  let vehicles = [];
  let selectedVehicleImage = null;
  let selectedVehicleOriginalWidth = 0;
  let selectedVehicleOriginalHeight = 0;
  let simulationRunning = false;
  let simulationSpeed = parseInt(simulationSpeedInput.value);
  let animationId = null;
  let isDragging = false;
  let draggedItem = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Khởi tạo canvas trước
  initCanvas();

  // Sau đó khởi tạo các thành phần khác
  initLanes();

  // Cập nhật kích thước phần trăm ban đầu
  updateVehicleSizePercent();

  // Tạo hình ảnh xe mẫu
  createVehiclePreviewImages();

  // Tài nguyên hình ảnh
  const trafficLightImages = {
    red: createTrafficLightImage("red"),
    yellow: createTrafficLightImage("yellow"),
    green: createTrafficLightImage("green"),
  };

  // Thiết lập sự kiện
  setupEventListeners();

  // Vẽ cảnh sau khi mọi thứ đã được khởi tạo
  drawScene();

  addLogEvent("Hệ thống mô phỏng tuyến đường đã sẵn sàng");

  /**
   * Khởi tạo canvas với kích thước phù hợp
   */
  function initCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    // Cập nhật kích thước dựa trên hướng của làn đường
    if (config.isVertical) {
      config.laneLength = canvas.height;
    } else {
      config.laneLength = canvas.width;
    }

    // Xử lý khi resize
    window.addEventListener("resize", function () {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      if (config.isVertical) {
        config.laneLength = canvas.height;
      } else {
        config.laneLength = canvas.width;
      }

      // Tính toán lại chiều rộng làn khi resize để làn full width
      calculateLaneWidth();
      drawScene();
    });

    // Tính toán chiều rộng làn ban đầu
    calculateLaneWidth();
  }

  /**
   * Tính toán chiều rộng làn tự động để full width
   */
  function calculateLaneWidth() {
    if (config.isVertical) {
      // Nếu theo chiều dọc, toàn bộ chiều rộng chia cho số làn
      config.laneWidth = canvas.width / laneCount;
    } else {
      // Nếu theo chiều ngang, giữ nguyên chiều rộng mặc định
      config.laneWidth = 80;
    }
  }

  /**
   * Khởi tạo các làn đường dựa trên laneCount
   */
  function initLanes() {
    lanes = [];

    // Tính toán lại chiều rộng làn để full width
    calculateLaneWidth();

    if (config.isVertical) {
      // Theo chiều dọc: các làn song song theo chiều dọc, mỗi làn có chiều rộng bằng nhau
      for (let i = 0; i < laneCount; i++) {
        lanes.push({
          x: i * config.laneWidth, // Vị trí x của làn
          vehicles: [],
        });
      }
    } else {
      // Theo chiều ngang (cách cũ)
      const totalRoadHeight = laneCount * config.laneWidth;
      const startY = (canvas.height - totalRoadHeight) / 2;

      for (let i = 0; i < laneCount; i++) {
        lanes.push({
          y: startY + i * config.laneWidth,
          vehicles: [],
        });
      }
    }

    addLogEvent(`Đã tạo ${laneCount} làn đường`);
  }

  /**
   * Thiết lập sự kiện cho các elements tương tác
   */
  function setupEventListeners() {
    // Sự kiện nút áp dụng số làn đường
    applyLaneBtn.addEventListener("click", function () {
      const newLaneCount = parseInt(laneCountInput.value);
      if (
        newLaneCount !== laneCount &&
        newLaneCount >= 1 &&
        newLaneCount <= 6
      ) {
        laneCount = newLaneCount;
        initLanes();
        drawScene();
        addLogEvent(`Đã thay đổi số làn đường thành ${laneCount}`);
      }
    });

    // Sự kiện nút thêm đèn giao thông
    addTrafficLightBtn.addEventListener("click", function () {
      const count = parseInt(trafficLightCountInput.value) || 1;
      for (let i = 0; i < count; i++) {
        addTrafficLight();
      }
    });

    // Sự kiện khi chọn tập tin hình ảnh xe
    vehicleImageInput.addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          const img = new Image();
          img.src = e.target.result;
          img.onload = function () {
            selectedVehicleImage = img;

            // Lưu kích thước gốc của ảnh
            selectedVehicleOriginalWidth = img.width;
            selectedVehicleOriginalHeight = img.height;

            // Bỏ chọn các xe có sẵn
            presetVehicles.forEach((el) => el.classList.remove("selected"));
            addLogEvent("Đã tải lên hình ảnh xe tùy chỉnh");
          };
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });

    // Sự kiện khi chọn xe có sẵn
    presetVehicles.forEach((el) => {
      el.addEventListener("click", function () {
        presetVehicles.forEach((el) => el.classList.remove("selected"));
        this.classList.add("selected");

        // Tạo đối tượng Image từ preset
        const img = new Image();
        img.src = this.src;
        selectedVehicleImage = img;

        // Reset file input
        vehicleImageInput.value = "";

        addLogEvent(`Đã chọn phương tiện: ${this.dataset.vehicle}`);
      });
    });

    // Sự kiện nút thêm xe
    addVehicleBtn.addEventListener("click", function () {
      if (selectedVehicleImage) {
        addVehicle();
      } else {
        addLogEvent("Vui lòng chọn hoặc tải lên hình ảnh xe trước", "warning");
      }
    });

    // Sự kiện nút đặt lại
    resetBtn.addEventListener("click", function () {
      if (confirm("Bạn có chắc muốn đặt lại toàn bộ mô phỏng?")) {
        resetSimulation();
      }
    });

    // Sự kiện nút lưu cấu hình
    saveBtn.addEventListener("click", function () {
      saveSimulationConfig();
    });

    // Sự kiện nút bắt đầu mô phỏng
    startSimulationBtn.addEventListener("click", function () {
      startSimulation();
    });

    // Sự kiện nút dừng mô phỏng
    stopSimulationBtn.addEventListener("click", function () {
      stopSimulation();
    });

    // Sự kiện thay đổi tốc độ mô phỏng
    simulationSpeedInput.addEventListener("change", function () {
      simulationSpeed = parseInt(this.value);
      addLogEvent(`Tốc độ mô phỏng: ${simulationSpeed}`);
    });

    // Sự kiện kéo thả và click trên canvas
    canvas.addEventListener("mousedown", handleCanvasMouseDown);
    canvas.addEventListener("mousemove", handleCanvasMouseMove);
    canvas.addEventListener("mouseup", handleCanvasMouseUp);
    canvas.addEventListener("click", handleCanvasClick);

    // Chặn hành vi kéo thả mặc định của trình duyệt
    canvas.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });

    // Sự kiện khi thay đổi kích thước phần trăm
    vehicleSizePercentInput.addEventListener("input", function () {
      const percent = parseInt(this.value);
      config.vehicleSizePercent = percent;
      vehicleSizeValue.textContent = percent;

      // Cập nhật lại ảnh mẫu và vẽ lại cảnh
      createVehiclePreviewImages();
      drawScene();

      // Cập nhật trạng thái active của các nút preset
      updateActivePresetButton(percent);
    });

    // Sự kiện khi nhấn nút preset kích thước
    sizePresetButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const percent = parseInt(this.dataset.size);

        // Cập nhật giá trị thanh trượt và cấu hình
        config.vehicleSizePercent = percent;
        vehicleSizePercentInput.value = percent;
        vehicleSizeValue.textContent = percent;

        // Cập nhật trạng thái active của các nút
        updateActivePresetButton(percent);

        // Cập nhật lại ảnh mẫu và vẽ lại cảnh
        createVehiclePreviewImages();
        drawScene();
      });
    });

    // Thêm sự kiện cho điều chỉnh kích thước phương tiện
    vehicleWidthInput.addEventListener("input", function () {
      const width = parseInt(this.value);
      config.vehicleWidth = width;
      vehicleWidthValue.textContent = width;

      if (config.keepAspectRatio && selectedVehicleImage) {
        // Tự động điều chỉnh chiều cao để giữ tỷ lệ
        const newHeight = Math.round(width / config.originalImageRatio);
        config.vehicleHeight = newHeight;
        vehicleHeightInput.value = newHeight;
        vehicleHeightValue.textContent = newHeight;
      }

      createVehiclePreviewImages(); // Tạo lại hình ảnh mẫu với kích thước mới
      drawScene(); // Cập nhật lại giao diện
    });

    vehicleHeightInput.addEventListener("input", function () {
      const height = parseInt(this.value);
      config.vehicleHeight = height;
      vehicleHeightValue.textContent = height;

      if (config.keepAspectRatio && selectedVehicleImage) {
        // Tự động điều chỉnh chiều rộng để giữ tỷ lệ
        const newWidth = Math.round(height * config.originalImageRatio);
        config.vehicleWidth = newWidth;
        vehicleWidthInput.value = newWidth;
        vehicleWidthValue.textContent = newWidth;
      }

      createVehiclePreviewImages(); // Tạo lại hình ảnh mẫu với kích thước mới
      drawScene(); // Cập nhật lại giao diện
    });

    // Xử lý sự kiện khi thay đổi chế độ tỷ lệ
    fixedSizeRadio.addEventListener("change", function () {
      if (this.checked) {
        config.keepAspectRatio = false;
      }
    });

    keepRatioRadio.addEventListener("change", function () {
      if (this.checked) {
        config.keepAspectRatio = true;
        if (selectedVehicleImage) {
          // Cập nhật chiều cao dựa trên tỷ lệ hiện tại và chiều rộng
          const newHeight = Math.round(
            config.vehicleWidth / config.originalImageRatio
          );
          config.vehicleHeight = newHeight;
          vehicleHeightInput.value = newHeight;
          vehicleHeightValue.textContent = newHeight;
          createVehiclePreviewImages();
          drawScene();
        }
      }
    });
  }

  /**
   * Cập nhật trạng thái active của nút preset kích thước
   */
  function updateActivePresetButton(percent) {
    sizePresetButtons.forEach((button) => {
      const btnSize = parseInt(button.dataset.size);
      if (btnSize === percent) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  }

  /**
   * Cập nhật cấu hình kích thước phần trăm
   */
  function updateVehicleSizePercent() {
    config.vehicleSizePercent = parseInt(vehicleSizePercentInput.value);
    vehicleSizeValue.textContent = vehicleSizePercentInput.value;

    // Cập nhật trạng thái active của các nút preset
    updateActivePresetButton(config.vehicleSizePercent);
  }

  /**
   * Xử lý sự kiện mousedown trên canvas
   */
  function handleCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Kiểm tra xem có phần tử nào được chọn để kéo
    for (let i = 0; i < trafficLights.length; i++) {
      const light = trafficLights[i];
      if (
        isPointInRect(
          x,
          y,
          light.x,
          light.y,
          config.trafficLightWidth,
          config.trafficLightHeight
        )
      ) {
        isDragging = true;
        draggedItem = {
          type: "trafficLight",
          index: i,
        };
        dragOffsetX = x - light.x;
        dragOffsetY = y - light.y;
        return;
      }
    }

    // Kiểm tra xem có phương tiện nào được chọn để kéo
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      if (
        isPointInRect(
          x,
          y,
          vehicle.x,
          vehicle.y,
          config.vehicleWidth,
          config.vehicleHeight
        )
      ) {
        isDragging = true;
        draggedItem = {
          type: "vehicle",
          index: i,
        };
        dragOffsetX = x - vehicle.x;
        dragOffsetY = y - vehicle.y;
        return;
      }
    }
  }

  /**
   * Xử lý sự kiện mousemove trên canvas
   */
  function handleCanvasMouseMove(e) {
    if (!isDragging || !draggedItem) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggedItem.type === "trafficLight") {
      const light = trafficLights[draggedItem.index];
      light.x = x - dragOffsetX;
      light.y = y - dragOffsetY;

      // Giữ đèn trong ranh giới canvas
      light.x = Math.max(
        0,
        Math.min(canvas.width - config.trafficLightWidth, light.x)
      );
      light.y = Math.max(
        0,
        Math.min(canvas.height - config.trafficLightHeight, light.y)
      );
    } else if (draggedItem.type === "vehicle") {
      const vehicle = vehicles[draggedItem.index];
      vehicle.x = x - dragOffsetX;
      vehicle.y = y - dragOffsetY;

      // Giữ xe trong ranh giới canvas
      vehicle.x = Math.max(
        0,
        Math.min(canvas.width - config.vehicleWidth, vehicle.x)
      );
      vehicle.y = Math.max(
        0,
        Math.min(canvas.height - config.vehicleHeight, vehicle.y)
      );

      // Tìm làn xe gần nhất
      let closestLane = 0;
      let minDistance = Infinity;

      if (config.isVertical) {
        // Với làn dọc, tìm làn gần nhất dựa trên tọa độ x
        for (let i = 0; i < lanes.length; i++) {
          const laneX = lanes[i].x + config.laneWidth / 2;
          const distance = Math.abs(
            vehicle.x + config.vehicleWidth / 2 - laneX
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestLane = i;
          }
        }

        // Đặt xe vào giữa làn theo chiều ngang
        vehicle.x =
          lanes[closestLane].x + (config.laneWidth - config.vehicleWidth) / 2;
        vehicle.lane = closestLane;
      } else {
        // Với làn ngang, tìm làn gần nhất dựa trên tọa độ y (cách cũ)
        for (let i = 0; i < lanes.length; i++) {
          const laneY = lanes[i].y + config.laneWidth / 2;
          const distance = Math.abs(
            vehicle.y + config.vehicleHeight / 2 - laneY
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestLane = i;
          }
        }

        // Gán xe vào làn gần nhất
        vehicle.lane = closestLane;
        vehicle.y =
          lanes[closestLane].y + (config.laneWidth - config.vehicleHeight) / 2;
      }
    }

    drawScene();
  }

  /**
   * Xử lý sự kiện mouseup trên canvas
   */
  function handleCanvasMouseUp() {
    if (isDragging && draggedItem) {
      if (draggedItem.type === "trafficLight") {
        addLogEvent(`Đã di chuyển đèn giao thông đến vị trí mới`);
      } else if (draggedItem.type === "vehicle") {
        const vehicle = vehicles[draggedItem.index];
        addLogEvent(`Đã di chuyển phương tiện đến làn ${vehicle.lane + 1}`);
      }
    }

    isDragging = false;
    draggedItem = null;
  }

  /**
   * Xử lý sự kiện click trên canvas
   */
  function handleCanvasClick(e) {
    if (isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Kiểm tra xem có click vào đèn giao thông nào
    for (let i = 0; i < trafficLights.length; i++) {
      const light = trafficLights[i];
      if (
        isPointInRect(
          x,
          y,
          light.x,
          light.y,
          config.trafficLightWidth,
          config.trafficLightHeight
        )
      ) {
        cycleTrafficLightState(light);
        drawScene();
        return;
      }
    }
  }

  /**
   * Chuyển trạng thái đèn giao thông (đỏ -> vàng -> xanh -> đỏ)
   */
  function cycleTrafficLightState(light) {
    if (light.state === "red") {
      light.state = "yellow";
    } else if (light.state === "yellow") {
      light.state = "green";
    } else {
      light.state = "red";
    }

    addLogEvent(
      `Đèn giao thông chuyển sang trạng thái: ${translateLightState(
        light.state
      )}`
    );

    // Cập nhật hiển thị đèn trong panel
    updateTrafficLightPreview(light.state);
  }

  /**
   * Cập nhật hiển thị đèn giao thông trong panel
   */
  function updateTrafficLightPreview(state) {
    const lights = document.querySelectorAll(".traffic-light-preview .light");
    lights.forEach((light) => light.classList.remove("active"));

    document
      .querySelector(`.traffic-light-preview .${state}`)
      .classList.add("active");
  }

  /**
   * Kiểm tra xem một điểm có nằm trong hình chữ nhật hay không
   */
  function isPointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }

  /**
   * Tạo hình ảnh đèn giao thông
   */
  function createTrafficLightImage(state) {
    const canvas = document.createElement("canvas");
    canvas.width = config.trafficLightWidth;
    canvas.height = config.trafficLightHeight;
    const ctx = canvas.getContext("2d");

    // Vẽ thân đèn
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, config.trafficLightWidth, config.trafficLightHeight);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, config.trafficLightWidth, config.trafficLightHeight);

    // Vẽ các bóng đèn
    const lightRadius = config.trafficLightWidth * 0.35;
    const lightSpacing = config.trafficLightHeight * 0.22;
    const centerX = config.trafficLightWidth / 2;

    // Đèn đỏ
    ctx.beginPath();
    ctx.arc(centerX, lightSpacing, lightRadius, 0, Math.PI * 2);
    ctx.fillStyle = state === "red" ? "#ff0000" : "#850000";
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Đèn vàng
    ctx.beginPath();
    ctx.arc(
      centerX,
      lightSpacing * 2 + lightRadius,
      lightRadius,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = state === "yellow" ? "#ffaa00" : "#855900";
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Đèn xanh
    ctx.beginPath();
    ctx.arc(
      centerX,
      lightSpacing * 3 + lightRadius * 2,
      lightRadius,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = state === "green" ? "#00ff00" : "#005500";
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Tạo hiệu ứng chiếu sáng nếu đèn đang hoạt động
    if (state === "red" || state === "yellow" || state === "green") {
      const lightY =
        state === "red"
          ? lightSpacing
          : state === "yellow"
          ? lightSpacing * 2 + lightRadius
          : lightSpacing * 3 + lightRadius * 2;

      const gradient = ctx.createRadialGradient(
        centerX,
        lightY,
        0,
        centerX,
        lightY,
        lightRadius * 2
      );

      const color =
        state === "red"
          ? "#ff0000"
          : state === "yellow"
          ? "#ffaa00"
          : "#00ff00";

      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.globalAlpha = 0.5;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, lightY, lightRadius * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
  }

  /**
   * Thêm một đèn giao thông mới
   */
  function addTrafficLight() {
    const lightWidth = config.trafficLightWidth;
    const lightHeight = config.trafficLightHeight;

    // Đặt đèn ở vị trí ngẫu nhiên
    const x = Math.random() * (canvas.width - lightWidth * 2) + lightWidth / 2;
    const y =
      Math.random() * (canvas.height / 2 - lightHeight) + lightHeight / 2;

    const light = {
      x: x,
      y: y,
      state: "red",
      timeInState: 0,
    };

    trafficLights.push(light);
    drawScene();

    addLogEvent("Đã thêm đèn giao thông mới");

    // Cập nhật hình ảnh đèn
    trafficLightImages.red = createTrafficLightImage("red");
    trafficLightImages.yellow = createTrafficLightImage("yellow");
    trafficLightImages.green = createTrafficLightImage("green");

    // Cập nhật hiển thị đèn trong panel
    updateTrafficLightPreview("red");
  }

  /**
   * Tính toán kích thước thực tế dựa trên phần trăm
   */
  function calculateVehicleSize(originalWidth, originalHeight) {
    if (selectedVehicleImage && selectedVehicleOriginalWidth > 0) {
      // Nếu có ảnh đã tải lên, sử dụng kích thước gốc của ảnh
      const scaleFactor = config.vehicleSizePercent / 100;
      return {
        width: Math.round(originalWidth * scaleFactor),
        height: Math.round(originalHeight * scaleFactor),
      };
    } else {
      // Sử dụng kích thước mặc định cho xe mẫu
      const scaleFactor = config.vehicleSizePercent / 100;
      return {
        width: Math.round(config.vehicleDefaultWidth * scaleFactor),
        height: Math.round(config.vehicleDefaultHeight * scaleFactor),
      };
    }
  }

  /**
   * Thêm một phương tiện mới
   */
  function addVehicle() {
    if (!selectedVehicleImage) return;

    // Chọn làn ngẫu nhiên
    const laneIndex = Math.floor(Math.random() * lanes.length);

    // Tính toán kích thước dựa trên phần trăm
    const vehicleSize = calculateVehicleSize(
      selectedVehicleOriginalWidth || config.vehicleDefaultWidth,
      selectedVehicleOriginalHeight || config.vehicleDefaultHeight
    );

    let vehicle;

    if (config.isVertical) {
      // Với làn dọc
      const laneX = lanes[laneIndex].x;

      if (config.bottomToTop) {
        // Xe bắt đầu từ dưới lên trên
        vehicle = {
          x: laneX + (config.laneWidth - vehicleSize.width) / 2, // Căn giữa xe theo chiều ngang của làn
          y: canvas.height - vehicleSize.height - 50, // Bắt đầu từ phía dưới
          image: selectedVehicleImage,
          speed: Math.random() * 2 + 1,
          lane: laneIndex,
          stopped: false,
          rotated: false, // Không xoay ảnh
          width: vehicleSize.width,
          height: vehicleSize.height,
          originalWidth:
            selectedVehicleOriginalWidth || config.vehicleDefaultWidth,
          originalHeight:
            selectedVehicleOriginalHeight || config.vehicleDefaultHeight,
          sizePercent: config.vehicleSizePercent,
        };
      } else {
        // Xe bắt đầu từ trên xuống dưới
        vehicle = {
          x: laneX + (config.laneWidth - vehicleSize.width) / 2,
          y: 50, // Bắt đầu từ phía trên
          image: selectedVehicleImage,
          speed: Math.random() * 2 + 1,
          lane: laneIndex,
          stopped: false,
          rotated: false,
          width: vehicleSize.width,
          height: vehicleSize.height,
          originalWidth:
            selectedVehicleOriginalWidth || config.vehicleDefaultWidth,
          originalHeight:
            selectedVehicleOriginalHeight || config.vehicleDefaultHeight,
          sizePercent: config.vehicleSizePercent,
        };
      }
    } else {
      // Với làn ngang
      const laneY = lanes[laneIndex].y;
      vehicle = {
        x: 50, // Bắt đầu từ bên trái
        y: laneY + (config.laneWidth - vehicleSize.height) / 2,
        image: selectedVehicleImage,
        speed: Math.random() * 2 + 1,
        lane: laneIndex,
        stopped: false,
        rotated: false,
        width: vehicleSize.width,
        height: vehicleSize.height,
        originalWidth:
          selectedVehicleOriginalWidth || config.vehicleDefaultWidth,
        originalHeight:
          selectedVehicleOriginalHeight || config.vehicleDefaultHeight,
        sizePercent: config.vehicleSizePercent,
      };
    }

    vehicles.push(vehicle);
    drawScene();

    addLogEvent(
      `Đã thêm phương tiện mới vào làn ${laneIndex + 1} (kích thước: ${
        config.vehicleSizePercent
      }%)`
    );
  }

  /**
   * Vẽ toàn bộ cảnh
   */
  function drawScene() {
    // Xóa canvas
    ctx.fillStyle = "#f0f2f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vẽ làn đường
    drawLanes();

    // Vẽ đèn giao thông
    drawTrafficLights();

    // Vẽ phương tiện
    drawVehicles();
  }

  /**
   * Vẽ các làn đường
   */
  function drawLanes() {
    if (config.isVertical) {
      // Vẽ làn đường theo chiều dọc
      const totalRoadWidth = laneCount * config.laneWidth;

      // Vẽ nền đường
      ctx.fillStyle = config.roadColor;
      ctx.fillRect(0, 0, totalRoadWidth, canvas.height);

      // Vẽ vạch kẻ làn
      for (let i = 1; i < laneCount; i++) {
        const x = i * config.laneWidth;
        ctx.strokeStyle = config.laneMarkingColor;
        ctx.setLineDash([20, 10]);
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Reset lineDash
      ctx.setLineDash([]);

      // Vẽ biên đường
      ctx.strokeStyle = config.laneMarkingColor;
      ctx.lineWidth = 4;

      // Biên trái
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, canvas.height);
      ctx.stroke();

      // Biên phải
      ctx.beginPath();
      ctx.moveTo(totalRoadWidth, 0);
      ctx.lineTo(totalRoadWidth, canvas.height);
      ctx.stroke();
    } else {
      // Vẽ làn đường theo chiều ngang (cách cũ)
      const totalRoadHeight = laneCount * config.laneWidth;
      const startY = (canvas.height - totalRoadHeight) / 2;

      // Vẽ nền đường
      ctx.fillStyle = config.roadColor;
      ctx.fillRect(0, startY, canvas.width, totalRoadHeight);

      // Vẽ vạch kẻ làn
      for (let i = 1; i < laneCount; i++) {
        const y = startY + i * config.laneWidth;
        ctx.strokeStyle = config.laneMarkingColor;
        ctx.setLineDash([20, 10]);
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Reset lineDash
      ctx.setLineDash([]);

      // Vẽ biên đường
      ctx.strokeStyle = config.laneMarkingColor;
      ctx.lineWidth = 4;

      // Biên trên
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.lineTo(canvas.width, startY);
      ctx.stroke();

      // Biên dưới
      ctx.beginPath();
      ctx.moveTo(0, startY + totalRoadHeight);
      ctx.lineTo(canvas.width, startY + totalRoadHeight);
      ctx.stroke();
    }
  }

  /**
   * Vẽ các đèn giao thông
   */
  function drawTrafficLights() {
    trafficLights.forEach((light) => {
      // Vẽ đèn chính
      const img = trafficLightImages[light.state];
      ctx.drawImage(
        img,
        light.x,
        light.y,
        config.trafficLightWidth,
        config.trafficLightHeight
      );

      // Vẽ đường ngang đại diện cho đường dừng khi đèn đỏ hoặc vàng
      if (light.state === "red" || light.state === "yellow") {
        ctx.strokeStyle = light.state === "red" ? "#ff0000" : "#ffaa00";
        ctx.lineWidth = 5; // Tăng độ đậm của đường dừng
        ctx.beginPath();
        // Tăng khoảng cách xuống 10px để không bị khuất
        ctx.moveTo(light.x - 30, light.y + config.trafficLightHeight + 10);
        ctx.lineTo(
          light.x + config.trafficLightWidth + 30,
          light.y + config.trafficLightHeight + 10
        );
        ctx.stroke();

        // Thêm hiệu ứng bóng đổ cho đường dừng
        ctx.shadowColor =
          light.state === "red"
            ? "rgba(255, 0, 0, 0.5)"
            : "rgba(255, 170, 0, 0.5)";
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    });
  }

  /**
   * Vẽ các phương tiện
   */
  function drawVehicles() {
    vehicles.forEach((vehicle) => {
      // Vẽ xe bình thường (không xoay)
      ctx.drawImage(
        vehicle.image,
        vehicle.x,
        vehicle.y,
        vehicle.width,
        vehicle.height
      );
    });
  }

  /**
   * Bắt đầu mô phỏng
   */
  function startSimulation() {
    if (simulationRunning) return;

    simulationRunning = true;
    startSimulationBtn.disabled = true;
    stopSimulationBtn.disabled = false;

    addLogEvent("Bắt đầu mô phỏng");

    // Bắt đầu vòng lặp animation
    animationId = requestAnimationFrame(simulationLoop);
  }

  /**
   * Vòng lặp mô phỏng
   */
  function simulationLoop() {
    updateSimulation();
    drawScene();

    if (simulationRunning) {
      animationId = requestAnimationFrame(simulationLoop);
    }
  }

  /**
   * Cập nhật trạng thái mô phỏng
   */
  function updateSimulation() {
    // Di chuyển và cập nhật các phương tiện
    vehicles.forEach((vehicle) => {
      if (vehicle.stopped) return;

      // Kiểm tra va chạm với xe khác
      const hasCollision = checkVehicleCollision(vehicle);

      // Kiểm tra đèn đỏ
      const hasRedLight = checkRedLight(vehicle);

      if (!hasCollision && !hasRedLight) {
        if (config.isVertical) {
          if (config.bottomToTop) {
            // Di chuyển xe từ dưới lên trên
            vehicle.y -= vehicle.speed * (simulationSpeed / 5);

            // Nếu xe đi ra khỏi màn hình phía trên, đặt lại vị trí về phía dưới
            if (vehicle.y < -config.vehicleHeight) {
              vehicle.y = canvas.height;
            }
          } else {
            // Di chuyển xe xuống dưới (cách cũ)
            vehicle.y += vehicle.speed * (simulationSpeed / 5);

            // Nếu xe đi ra khỏi màn hình, đặt lại vị trí về phía trên
            if (vehicle.y > canvas.height) {
              vehicle.y = -config.vehicleHeight;
            }
          }
        } else {
          // Di chuyển xe sang phải với làn ngang
          vehicle.x += vehicle.speed * (simulationSpeed / 5);

          // Nếu xe đi ra khỏi màn hình, đặt lại vị trí về bên trái
          if (vehicle.x > canvas.width) {
            vehicle.x = -config.vehicleWidth;
          }
        }
      }
    });

    // Cập nhật thời gian trạng thái đèn
    trafficLights.forEach((light) => {
      light.timeInState += 1;

      // Tự động chuyển đèn sau một khoảng thời gian
      const autoChange = false; // Đặt thành true nếu muốn đèn tự động chuyển

      if (autoChange) {
        const redTime = 200;
        const yellowTime = 50;
        const greenTime = 150;

        if (light.state === "red" && light.timeInState >= redTime) {
          light.state = "green";
          light.timeInState = 0;
          addLogEvent("Đèn tự động chuyển sang xanh");
        } else if (
          light.state === "yellow" &&
          light.timeInState >= yellowTime
        ) {
          light.state = "red";
          light.timeInState = 0;
          addLogEvent("Đèn tự động chuyển sang đỏ");
        } else if (light.state === "green" && light.timeInState >= greenTime) {
          light.state = "yellow";
          light.timeInState = 0;
          addLogEvent("Đèn tự động chuyển sang vàng");
        }

        // Cập nhật hình ảnh đèn
        trafficLightImages.red = createTrafficLightImage("red");
        trafficLightImages.yellow = createTrafficLightImage("yellow");
        trafficLightImages.green = createTrafficLightImage("green");
      }
    });
  }

  /**
   * Kiểm tra va chạm giữa các phương tiện
   */
  function checkVehicleCollision(vehicle) {
    for (const otherVehicle of vehicles) {
      // Bỏ qua chính nó
      if (otherVehicle === vehicle) continue;

      // Chỉ kiểm tra xe cùng làn
      if (otherVehicle.lane !== vehicle.lane) continue;

      if (config.isVertical) {
        if (config.bottomToTop) {
          // Kiểm tra nếu xe phía trên và đủ gần (khi di chuyển từ dưới lên trên)
          if (
            otherVehicle.y < vehicle.y &&
            vehicle.y - (otherVehicle.y + otherVehicle.height) < 20
          ) {
            return true;
          }
        } else {
          // Kiểm tra nếu xe phía dưới và đủ gần (khi di chuyển từ trên xuống dưới - cách cũ)
          if (
            otherVehicle.y > vehicle.y &&
            otherVehicle.y - (vehicle.y + vehicle.height) < 20
          ) {
            return true;
          }
        }
      } else {
        // Kiểm tra nếu xe phía trước và đủ gần (làn ngang - cách cũ)
        if (
          otherVehicle.x > vehicle.x &&
          otherVehicle.x - (vehicle.x + vehicle.width) < 20
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Kiểm tra xem xe có đang đi qua đèn đỏ không
   */
  function checkRedLight(vehicle) {
    for (const light of trafficLights) {
      // Chỉ kiểm tra đèn đỏ hoặc vàng
      if (light.state !== "red" && light.state !== "yellow") continue;

      if (config.isVertical) {
        if (config.bottomToTop) {
          // Với làn dọc đi từ dưới lên, kiểm tra vị trí y của xe và đèn
          const lightY = light.y; // Phần trên của đèn
          const vehicleTop = vehicle.y;
          const distanceToLight = Math.abs(vehicleTop - lightY);

          if (distanceToLight < 20) {
            return true;
          }
        } else {
          // Với làn dọc đi từ trên xuống (cách cũ)
          const lightY = light.y + config.trafficLightHeight;
          const vehicleBottom = vehicle.y + vehicle.height;
          const distanceToLight = Math.abs(vehicleBottom - lightY);

          if (distanceToLight < 20) {
            return true;
          }
        }
      } else {
        // Với làn ngang (cách cũ)
        const lightX = light.x + config.trafficLightWidth / 2;
        const distanceToLight = Math.abs(vehicle.x + vehicle.width - lightX);

        if (distanceToLight < 20) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Dừng mô phỏng
   */
  function stopSimulation() {
    simulationRunning = false;
    startSimulationBtn.disabled = false;
    stopSimulationBtn.disabled = true;

    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    addLogEvent("Đã dừng mô phỏng");
  }

  /**
   * Đặt lại toàn bộ mô phỏng
   */
  function resetSimulation() {
    // Dừng mô phỏng nếu đang chạy
    if (simulationRunning) {
      stopSimulation();
    }

    // Đặt lại các biến trạng thái
    trafficLights = [];
    vehicles = [];

    // Khởi tạo lại làn đường
    initLanes();

    // Vẽ lại cảnh
    drawScene();

    addLogEvent("Đã đặt lại mô phỏng");
  }

  /**
   * Lưu cấu hình mô phỏng
   */
  function saveSimulationConfig() {
    const config = {
      laneCount: laneCount,
      trafficLights: trafficLights,
      vehicles: vehicles.map((v) => ({
        lane: v.lane,
        speed: v.speed,
        x: v.x,
        y: v.y,
      })),
    };

    localStorage.setItem("trafficSimulation", JSON.stringify(config));
    addLogEvent("Đã lưu cấu hình mô phỏng");
  }

  /**
   * Thêm sự kiện vào log
   */
  function addLogEvent(message, type = "info") {
    const entry = document.createElement("div");
    entry.className = `event-entry event-${type}`;

    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = new Date().toLocaleTimeString();

    const content = document.createElement("span");
    content.className = "event-message";
    content.textContent = message;

    entry.appendChild(time);
    entry.appendChild(content);
    eventsContainer.appendChild(entry);

    // Cuộn xuống dưới
    eventsContainer.scrollTop = eventsContainer.scrollHeight;
  }

  /**
   * Chuyển đổi trạng thái đèn sang tiếng Việt
   */
  function translateLightState(state) {
    switch (state) {
      case "red":
        return "Đỏ";
      case "yellow":
        return "Vàng";
      case "green":
        return "Xanh";
      default:
        return state;
    }
  }

  /**
   * Tạo hình ảnh xe mẫu bằng canvas
   */
  function createVehiclePreviewImages() {
    // Tính toán kích thước cho xe mẫu
    const vehicleSize = calculateVehicleSize(
      config.vehicleDefaultWidth,
      config.vehicleDefaultHeight
    );

    // Tạo hình xe 1
    const car1Canvas = document.createElement("canvas");
    car1Canvas.width = vehicleSize.width;
    car1Canvas.height = vehicleSize.height;
    const car1Ctx = car1Canvas.getContext("2d");

    car1Ctx.fillStyle = "#3498db";
    car1Ctx.fillRect(0, 0, vehicleSize.width, vehicleSize.height);
    car1Ctx.fillStyle = "#2980b9";
    car1Ctx.fillRect(
      vehicleSize.width * 0.7,
      0,
      vehicleSize.width * 0.3,
      vehicleSize.height
    );

    // Cửa sổ
    car1Ctx.fillStyle = "#ccc";
    car1Ctx.fillRect(
      vehicleSize.width * 0.4,
      vehicleSize.height * 0.2,
      vehicleSize.width * 0.2,
      vehicleSize.height * 0.3
    );

    // Bánh xe
    car1Ctx.fillStyle = "#333";
    car1Ctx.fillRect(
      vehicleSize.width * 0.1,
      vehicleSize.height * 0.8,
      vehicleSize.width * 0.15,
      vehicleSize.height * 0.2
    );
    car1Ctx.fillRect(
      vehicleSize.width * 0.7,
      vehicleSize.height * 0.8,
      vehicleSize.width * 0.15,
      vehicleSize.height * 0.2
    );

    const car1Image = new Image();
    car1Image.src = car1Canvas.toDataURL();

    // Thay thế src của ảnh mẫu
    const car1Element = document.querySelector('[data-vehicle="car1"]');
    if (car1Element) car1Element.src = car1Image.src;

    // Tạo hình xe 2
    const car2Canvas = document.createElement("canvas");
    car2Canvas.width = vehicleSize.width;
    car2Canvas.height = vehicleSize.height;
    const car2Ctx = car2Canvas.getContext("2d");

    car2Ctx.fillStyle = "#e74c3c";
    car2Ctx.fillRect(0, 0, vehicleSize.width, vehicleSize.height);
    car2Ctx.fillStyle = "#c0392b";
    car2Ctx.fillRect(0, 0, vehicleSize.width * 0.2, vehicleSize.height);

    // Cửa sổ
    car2Ctx.fillStyle = "#ccc";
    car2Ctx.fillRect(
      vehicleSize.width * 0.3,
      vehicleSize.height * 0.2,
      vehicleSize.width * 0.3,
      vehicleSize.height * 0.3
    );

    // Bánh xe
    car2Ctx.fillStyle = "#333";
    car2Ctx.fillRect(
      vehicleSize.width * 0.15,
      vehicleSize.height * 0.8,
      vehicleSize.width * 0.15,
      vehicleSize.height * 0.2
    );
    car2Ctx.fillRect(
      vehicleSize.width * 0.7,
      vehicleSize.height * 0.8,
      vehicleSize.width * 0.15,
      vehicleSize.height * 0.2
    );

    const car2Image = new Image();
    car2Image.src = car2Canvas.toDataURL();

    // Thay thế src của ảnh mẫu
    const car2Element = document.querySelector('[data-vehicle="car2"]');
    if (car2Element) car2Element.src = car2Image.src;

    // Tạo hình xe tải
    const truckCanvas = document.createElement("canvas");
    truckCanvas.width = vehicleSize.width;
    truckCanvas.height = vehicleSize.height;
    const truckCtx = truckCanvas.getContext("2d");

    truckCtx.fillStyle = "#27ae60";
    truckCtx.fillRect(0, 0, vehicleSize.width * 0.3, vehicleSize.height);
    truckCtx.fillStyle = "#2ecc71";
    truckCtx.fillRect(
      vehicleSize.width * 0.3,
      vehicleSize.height * 0.2,
      vehicleSize.width * 0.7,
      vehicleSize.height * 0.8
    );

    // Cửa sổ
    truckCtx.fillStyle = "#ccc";
    truckCtx.fillRect(
      vehicleSize.width * 0.05,
      vehicleSize.height * 0.2,
      vehicleSize.width * 0.2,
      vehicleSize.height * 0.3
    );

    // Bánh xe
    truckCtx.fillStyle = "#333";
    truckCtx.fillRect(
      vehicleSize.width * 0.1,
      vehicleSize.height * 0.8,
      vehicleSize.width * 0.15,
      vehicleSize.height * 0.2
    );
    truckCtx.fillRect(
      vehicleSize.width * 0.5,
      vehicleSize.height * 0.8,
      vehicleSize.width * 0.15,
      vehicleSize.height * 0.2
    );
    truckCtx.fillRect(
      vehicleSize.width * 0.7,
      vehicleSize.height * 0.8,
      vehicleSize.width * 0.15,
      vehicleSize.height * 0.2
    );

    const truckImage = new Image();
    truckImage.src = truckCanvas.toDataURL();

    // Thay thế src của ảnh mẫu
    const truckElement = document.querySelector('[data-vehicle="truck"]');
    if (truckElement) truckElement.src = truckImage.src;
  }

  /**
   * Cập nhật kích thước phương tiện từ giá trị thanh trượt
   */
  function updateVehicleSizes() {
    // Cập nhật giá trị config từ input
    config.vehicleWidth = parseInt(vehicleWidthInput.value);
    config.vehicleHeight = parseInt(vehicleHeightInput.value);

    // Hiển thị giá trị
    vehicleWidthValue.textContent = vehicleWidthInput.value;
    vehicleHeightValue.textContent = vehicleHeightInput.value;

    // Cập nhật trạng thái giữ tỷ lệ
    config.keepAspectRatio = keepRatioRadio.checked;

    if (selectedVehicleImage && config.keepAspectRatio) {
      // Cập nhật tỷ lệ hình ảnh
      config.originalImageRatio =
        selectedVehicleImage.width / selectedVehicleImage.height;
    }
  }
});

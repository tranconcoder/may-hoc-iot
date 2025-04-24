// Car movement functionality
const carContainer = document.getElementById("car-container");
const carImage = document.getElementById("car-image");
const violationIndicator = document.getElementById("violation-indicator");
const positionValue = document.getElementById("position-value");
const positionX = document.getElementById("position-x");
const simulationArea = document.querySelector(".area:first-child");
const carSizeDisplay = document.getElementById("car-size");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");

// Initial car position and size
let carPosition = 0;
let carPositionX = 50; // 50% is the center
let carSize = 100; // 100% is the default size
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Default car width in pixels
const defaultCarWidth = 400;

// Min and max zoom percentages
const minZoom = 50;
const maxZoom = 200;
const zoomStep = 10;

// Make car draggable
carContainer.addEventListener("mousedown", startDrag);
document.addEventListener("mousemove", function (e) {
  if (isDragging) {
    drag(e);
  }
});
document.addEventListener("mouseup", stopDrag);

function startDrag(e) {
  e.preventDefault();
  isDragging = true;

  // Calculate the offset of the mouse pointer relative to the car
  const rect = carContainer.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;

  // Remove the transform to make calculations easier
  carContainer.style.transform = "none";
}

function drag(e) {
  if (!isDragging) return;
  e.preventDefault();

  const simulationRect = simulationArea.getBoundingClientRect();

  // Calculate new position based on mouse position minus the offset
  const newLeft = e.clientX - simulationRect.left - dragOffsetX;
  const newBottom =
    simulationRect.bottom -
    e.clientY -
    (carContainer.offsetHeight - dragOffsetY);

  // Constrain to simulation area
  const maxLeft = simulationRect.width - carContainer.offsetWidth;
  const maxBottom = simulationRect.height - carContainer.offsetHeight;

  const constrainedLeft = Math.max(0, Math.min(maxLeft, newLeft));
  const constrainedBottom = Math.max(0, Math.min(maxBottom, newBottom));

  // Update position
  carContainer.style.left = constrainedLeft + "px";
  carContainer.style.bottom = constrainedBottom + "px";

  // Calculate percentage positions for indicators
  carPosition = Math.round((constrainedBottom / maxBottom) * 100);
  carPositionX = Math.round((constrainedLeft / maxLeft) * 100);

  // Update indicators
  positionValue.textContent = carPosition;
  positionX.textContent = carPositionX;

  checkViolation();
}

function stopDrag() {
  isDragging = false;
}

// Update car position
function updateCarPosition() {
  const simulationRect = simulationArea.getBoundingClientRect();
  const maxBottom = simulationRect.height - carContainer.offsetHeight;

  // If not being dragged with mouse, maintain horizontal center position
  if (!isDragging) {
    carContainer.style.left = "50%";
    carContainer.style.transform = "translateX(-50%)";
    carContainer.style.bottom = carPosition + "%";
    carPositionX = 50;
    positionX.textContent = carPositionX;
  }

  positionValue.textContent = carPosition;

  checkViolation();
}

function checkViolation() {
  // Check for red light violation
  const isRedActive = document
    .getElementById("red-light")
    .classList.contains("active");

  // Consider it a violation if the car is between 40% and 60% position when red light is on
  if (isRedActive && carPosition > 40 && carPosition < 60) {
    violationIndicator.style.display = "block";
  } else {
    violationIndicator.style.display = "none";
  }
}

// Zoom buttons functionality
zoomInBtn.addEventListener("click", function () {
  if (carSize < maxZoom) {
    carSize += zoomStep;
    updateCarSize();
  }
});

zoomOutBtn.addEventListener("click", function () {
  if (carSize > minZoom) {
    carSize -= zoomStep;
    updateCarSize();
  }
});

// Update car size based on zoom percentage
function updateCarSize() {
  const newWidth = (carSize / 100) * defaultCarWidth;

  // Save current position percentages
  const simulationRect = simulationArea.getBoundingClientRect();
  const maxBottom = simulationRect.height - carContainer.offsetHeight;
  const maxLeft = simulationRect.width - carContainer.offsetWidth;

  // Get current position before resizing
  const currentBottom = parseFloat(carContainer.style.bottom) || 0;
  const currentLeft =
    parseFloat(carContainer.style.left) || simulationRect.width / 2;

  // Calculate position percentages
  const bottomPercent = (currentBottom / maxBottom) * 100;
  const leftPercent = (currentLeft / maxLeft) * 100;

  // Apply new size
  carContainer.style.width = newWidth + "px";

  // Ensure image fills container
  carImage.style.width = "100%";
  carImage.style.height = "auto";

  // Update display
  carSizeDisplay.textContent = carSize;

  // Recalculate constraints after size change
  const newMaxBottom = simulationRect.height - carContainer.offsetHeight;
  const newMaxLeft = simulationRect.width - carContainer.offsetWidth;

  // Reapply position based on percentages
  if (isDragging) {
    // If dragging, maintain the same position in pixels
    // But make sure it's still within bounds
    const constrainedLeft = Math.max(0, Math.min(newMaxLeft, currentLeft));
    const constrainedBottom = Math.max(
      0,
      Math.min(newMaxBottom, currentBottom)
    );

    carContainer.style.left = constrainedLeft + "px";
    carContainer.style.bottom = constrainedBottom + "px";
  } else {
    // If not dragging, use the percentage-based position
    carContainer.style.left = "50%";
    carContainer.style.transform = "translateX(-50%)";
    carContainer.style.bottom = carPosition + "%";
  }

  // Update position indicators
  updatePositionValues();
}

function updatePositionValues() {
  const simulationRect = simulationArea.getBoundingClientRect();
  const carRect = carContainer.getBoundingClientRect();

  // Calculate percentage positions
  const maxLeft = simulationRect.width - carRect.width;
  if (!isDragging) {
    carPositionX = 50; // Center
  } else {
    carPositionX = Math.round(
      ((carRect.left - simulationRect.left) / maxLeft) * 100
    );
    if (isNaN(carPositionX)) carPositionX = 50;
  }

  positionX.textContent = carPositionX;
}

// Keep keyboard controls for zooming
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    if (carPosition < 100) {
      carPosition = Math.min(100, parseInt(carPosition) + 5);
      updateCarPosition();
    }
  } else if (e.key === "ArrowDown") {
    if (carPosition > 0) {
      carPosition = Math.max(0, parseInt(carPosition) - 5);
      updateCarPosition();
    }
  } else if (e.key === "ArrowLeft") {
    isDragging = true;
    carPositionX = Math.max(0, carPositionX - 5);
    const simulationRect = simulationArea.getBoundingClientRect();
    const maxLeft = simulationRect.width - carContainer.offsetWidth;
    carContainer.style.left = (carPositionX / 100) * maxLeft + "px";
    carContainer.style.transform = "none";
    positionX.textContent = carPositionX;
    setTimeout(() => {
      isDragging = false;
    }, 100);
  } else if (e.key === "ArrowRight") {
    isDragging = true;
    carPositionX = Math.min(100, carPositionX + 5);
    const simulationRect = simulationArea.getBoundingClientRect();
    const maxLeft = simulationRect.width - carContainer.offsetWidth;
    carContainer.style.left = (carPositionX / 100) * maxLeft + "px";
    carContainer.style.transform = "none";
    positionX.textContent = carPositionX;
    setTimeout(() => {
      isDragging = false;
    }, 100);
  }
  // Add zoom keyboard shortcuts
  else if (e.key === "+" || e.key === "=") {
    if (carSize < maxZoom) {
      carSize += zoomStep;
      updateCarSize();
    }
  } else if (e.key === "-" || e.key === "_") {
    if (carSize > minZoom) {
      carSize -= zoomStep;
      updateCarSize();
    }
  }
});

// Traffic light functionality
function activateLight(color) {
  // Reset all lights
  document.getElementById("red-light").classList.remove("active");
  document.getElementById("yellow-light").classList.remove("active");
  document.getElementById("green-light").classList.remove("active");

  // Activate the selected light
  document.getElementById(color + "-light").classList.add("active");

  // Check for red light violation after light change
  checkViolation();
}

// Initialize car position and size
updateCarPosition();
updateCarSize();

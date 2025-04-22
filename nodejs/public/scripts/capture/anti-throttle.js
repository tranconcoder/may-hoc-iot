/**
 * Anti-Throttle Module for Capture Page
 * Prevents browser throttling when tab loses focus
 * Displays a Google Meet style popup when tab is hidden
 * Maintains optimal performance for video streaming even when tab is hidden
 */
window.BrowserKeepAlive = (function () {
  // Core components for anti-throttling
  let fakeVideo = null;
  let fakeCanvas = null;
  let fakeVideoStream = null;

  // Additional components for advanced anti-throttling
  let audioContext = null;
  let oscillator = null;
  let mediaStreamDestination = null;
  let audioElement = null;

  // Worker to keep CPU active
  let keepAliveWorker = null;
  let workerInterval = null;

  // Popup elements
  let popupElement = null;
  let popupThumbnail = null;

  // State tracking
  let isPageHidden = false;

  // Create Google Meet style popup
  function createPopup() {
    if (!popupElement) {
      // Create main popup container
      popupElement = document.createElement("div");
      popupElement.className = "meet-popup hidden";

      // Create popup content
      const popupContent = document.createElement("div");
      popupContent.className = "meet-popup-content";

      // Create thumbnail container for video preview
      popupThumbnail = document.createElement("div");
      popupThumbnail.className = "meet-popup-thumbnail";

      // Create info text
      const popupInfo = document.createElement("div");
      popupInfo.className = "meet-popup-info";

      const popupTitle = document.createElement("h3");
      popupTitle.textContent = "Bạn không nhìn thấy trang này";

      const popupMessage = document.createElement("p");
      popupMessage.textContent =
        "Quay lại trang này để tiếp tục xem và ghi hình.";

      // Create button to return to tab
      const returnButton = document.createElement("button");
      returnButton.className = "meet-popup-button";
      returnButton.textContent = "Quay lại ứng dụng";
      returnButton.addEventListener("click", function () {
        window.focus();
      });

      // Assemble popup
      popupInfo.appendChild(popupTitle);
      popupInfo.appendChild(popupMessage);
      popupInfo.appendChild(returnButton);

      popupContent.appendChild(popupThumbnail);
      popupContent.appendChild(popupInfo);

      popupElement.appendChild(popupContent);
      document.body.appendChild(popupElement);

      // Make entire popup clickable to focus window
      popupElement.addEventListener("click", function () {
        window.focus();
      });
    }
  }

  // Show the popup
  function showPopup() {
    if (!popupElement) createPopup();

    // Update thumbnail with current video frame if available
    updatePopupThumbnail();

    // Show popup with animation
    setTimeout(() => {
      popupElement.classList.remove("hidden");
    }, 100);
  }

  // Hide the popup
  function hidePopup() {
    if (popupElement) {
      popupElement.classList.add("hidden");
    }
  }

  // Update thumbnail with current video frame
  function updatePopupThumbnail() {
    if (popupThumbnail) {
      // Try to get current video preview if available
      const previewVideo = document.getElementById("preview");

      if (previewVideo && previewVideo.videoWidth > 0) {
        // Create a snapshot of the video
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 320;
        tempCanvas.height = 180;
        const ctx = tempCanvas.getContext("2d");

        try {
          // Draw the current frame to canvas
          ctx.drawImage(
            previewVideo,
            0,
            0,
            tempCanvas.width,
            tempCanvas.height
          );

          // Set as background of thumbnail
          popupThumbnail.style.backgroundImage = `url(${tempCanvas.toDataURL(
            "image/jpeg"
          )})`;
        } catch (e) {
          // Fallback if can't get frame
          popupThumbnail.style.backgroundColor = "#1a73e8";
          popupThumbnail.innerHTML = '<i class="fas fa-video"></i>';
        }
      } else {
        // Fallback image/color
        popupThumbnail.style.backgroundColor = "#1a73e8";
        popupThumbnail.innerHTML = '<i class="fas fa-video"></i>';
      }
    }
  }

  // Setup fake video element with high frame rate to prevent throttling
  function setupFakeVideo() {
    try {
      // Create hidden video and canvas elements
      fakeVideo = document.createElement("video");
      fakeCanvas = document.createElement("canvas");

      // Hide these elements but keep them in the DOM
      fakeVideo.style.position = "absolute";
      fakeVideo.style.opacity = "0";
      fakeVideo.style.pointerEvents = "none";
      fakeVideo.style.width = "1px";
      fakeVideo.style.height = "1px";
      fakeVideo.setAttribute("muted", "");
      fakeVideo.setAttribute("playsinline", "");
      fakeVideo.setAttribute("autoplay", "");

      fakeCanvas.style.position = "absolute";
      fakeCanvas.style.opacity = "0";
      fakeCanvas.style.pointerEvents = "none";
      fakeCanvas.style.width = "1px";
      fakeCanvas.style.height = "1px";

      document.body.appendChild(fakeVideo);
      document.body.appendChild(fakeCanvas);

      // Set up canvas with higher resolution for better throttling prevention
      fakeCanvas.width = 640;
      fakeCanvas.height = 480;

      // Create fake video stream with high frame rate
      const ctx = fakeCanvas.getContext("2d", { willReadFrequently: true });
      fakeVideoStream = fakeCanvas.captureStream(60); // 60fps to keep browser active
      fakeVideo.srcObject = fakeVideoStream;

      // Setup animation loop to constantly update the canvas
      let frameCount = 0;
      function updateCanvas() {
        frameCount++;
        // Draw something that changes each frame to prevent optimization
        ctx.fillStyle = frameCount % 2 === 0 ? "#111" : "#222";
        ctx.fillRect(0, 0, fakeCanvas.width, fakeCanvas.height);
        ctx.fillStyle = "#" + Math.floor(Math.random() * 16777215).toString(16);
        ctx.fillRect(
          Math.random() * fakeCanvas.width,
          Math.random() * fakeCanvas.height,
          20,
          20
        );

        // Request next frame
        requestAnimationFrame(updateCanvas);
      }

      updateCanvas(); // Start the animation loop

      fakeVideo
        .play()
        .catch((e) => console.log("Fake video play prevented:", e));

      // Create popup for visibility notifications
      createPopup();

      // Set up audio context to prevent throttling further
      setupAudioKeepAlive();

      // Set up background worker for CPU activity
      setupBackgroundWorker();

      // Listen for visibility changes
      setupVisibilityListeners();

      console.log(
        "Enhanced anti-throttle system initialized with Google Meet style popup"
      );
    } catch (err) {
      console.error("Error setting up anti-throttle system:", err);
    }
  }

  // Setup audio context to prevent throttling
  function setupAudioKeepAlive() {
    try {
      // Create audio context and silent oscillator
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      oscillator = audioContext.createOscillator();

      // Create media stream destination
      mediaStreamDestination = audioContext.createMediaStreamDestination();
      oscillator.connect(mediaStreamDestination);

      // Set frequency to be nearly inaudible
      oscillator.frequency.value = 1;
      oscillator.start();

      // Create audio element using oscillator output
      audioElement = document.createElement("audio");
      audioElement.srcObject = mediaStreamDestination.stream;
      audioElement.setAttribute("muted", "");
      audioElement.setAttribute("playsinline", "");
      audioElement.setAttribute("autoplay", "");

      // Ensure audio element is properly hidden
      audioElement.style.position = "absolute";
      audioElement.style.width = "1px";
      audioElement.style.height = "1px";
      audioElement.style.opacity = "0";

      document.body.appendChild(audioElement);
      audioElement
        .play()
        .catch((e) => console.log("Audio keep-alive prevented:", e));
    } catch (err) {
      console.log("Audio keep-alive setup failed:", err);
    }
  }

  // Create background worker to keep CPU active
  function setupBackgroundWorker() {
    try {
      // Create a blob with worker code
      const workerBlob = new Blob(
        [
          `let count = 0;
         self.onmessage = function(e) {
           if (e.data === 'start') {
             setInterval(() => { 
               // Perform some calculations to keep CPU active
               count++;
               let result = 0;
               for (let i = 0; i < 10000; i++) {
                 result += Math.sin(i) * Math.cos(i);
               }
               self.postMessage({count: count, result: result});
             }, 500);
           }
         };`,
        ],
        { type: "application/javascript" }
      );

      // Create worker from blob
      keepAliveWorker = new Worker(URL.createObjectURL(workerBlob));
      keepAliveWorker.onmessage = function (e) {
        // Do nothing with the result, just keep the worker running
      };

      // Start the worker
      keepAliveWorker.postMessage("start");
    } catch (err) {
      console.log("Worker setup failed:", err);
    }
  }

  // Set up visibility change listeners
  function setupVisibilityListeners() {
    // Page visibility API
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Window blur/focus events
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    // Page lifecycle API if available
    if ("onfreeze" in document) {
      document.addEventListener("freeze", handlePageFreeze);
      document.addEventListener("resume", handlePageResume);
    }

    // Set interval to keep processing active
    setUpKeepAliveInterval();
  }

  // Set up interval to prevent deep idle modes
  function setUpKeepAliveInterval() {
    // Create interval that runs every 500ms to keep the browser active
    workerInterval = setInterval(() => {
      if (isPageHidden) {
        // When page is hidden, do more intensive operations to prevent throttling
        intensifyAntiThrottleMeasures();
      }
    }, 500);
  }

  // Intensify the anti-throttle measures when tab is hidden
  function intensifyAntiThrottleMeasures() {
    try {
      // Force layout recalculation
      document.body.style.zoom = "0.99999";
      setTimeout(() => {
        document.body.style.zoom = "1";
      }, 10);

      // Modify canvas to force rendering
      if (fakeCanvas && fakeCanvas.getContext) {
        const ctx = fakeCanvas.getContext("2d");
        ctx.clearRect(0, 0, fakeCanvas.width, fakeCanvas.height);
        ctx.fillStyle = "#" + Math.floor(Math.random() * 16777215).toString(16);
        ctx.fillRect(0, 0, fakeCanvas.width, fakeCanvas.height);
      }

      // Create and remove DOM elements to keep browser busy
      const tempDiv = document.createElement("div");
      document.body.appendChild(tempDiv);
      tempDiv.style.width = "2px";
      tempDiv.style.height = "2px";
      tempDiv.style.position = "absolute";
      tempDiv.style.opacity = "0";

      // Force style recalculation
      getComputedStyle(tempDiv).getPropertyValue("width");

      // Clean up after a tiny delay
      setTimeout(() => {
        document.body.removeChild(tempDiv);
      }, 50);
    } catch (e) {
      // Silently handle any errors
    }
  }

  // Handle document visibility change
  function handleVisibilityChange() {
    if (document.hidden) {
      console.log("Page hidden, activating enhanced anti-throttle measures");
      isPageHidden = true;
      // Show our popup
      showPopup();
      // Increase animation frame rate and processing when hidden
      intensifyAntiThrottleMeasures();
    } else {
      console.log("Page visible, returning to standard operation");
      isPageHidden = false;
      // Hide our popup
      hidePopup();
    }
  }

  // Handle window losing focus
  function handleWindowBlur() {
    console.log("Window lost focus, maintaining full performance");
    isPageHidden = true;
    showPopup();
    intensifyAntiThrottleMeasures();
  }

  // Handle window gaining focus
  function handleWindowFocus() {
    console.log("Window gained focus");
    isPageHidden = false;
    hidePopup();
  }

  // Handle page freeze (if browser supports Page Lifecycle API)
  function handlePageFreeze() {
    console.log("Page frozen, attempting to prevent throttling");
    // Browser lifecycle is trying to freeze the page, resist it
    intensifyAntiThrottleMeasures();
    showPopup();
  }

  // Handle page resume
  function handlePageResume() {
    console.log("Page resumed");
    if (!isPageHidden) {
      hidePopup();
    }
  }

  // Clean up resources
  function cleanup() {
    if (fakeVideo) {
      fakeVideo.pause();
      fakeVideo.srcObject = null;
    }

    if (fakeVideoStream) {
      const tracks = fakeVideoStream.getTracks();
      tracks.forEach((track) => track.stop());
    }

    if (audioContext) {
      if (oscillator) {
        oscillator.stop();
      }
      if (audioContext.state !== "closed") {
        audioContext.close();
      }
    }

    if (audioElement && audioElement.parentNode) {
      audioElement.pause();
      audioElement.srcObject = null;
      audioElement.parentNode.removeChild(audioElement);
    }

    if (keepAliveWorker) {
      keepAliveWorker.terminate();
    }

    if (workerInterval) {
      clearInterval(workerInterval);
    }

    if (popupElement && popupElement.parentNode) {
      popupElement.parentNode.removeChild(popupElement);
    }

    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleWindowBlur);
    window.removeEventListener("focus", handleWindowFocus);

    if ("onfreeze" in document) {
      document.removeEventListener("freeze", handlePageFreeze);
      document.removeEventListener("resume", handlePageResume);
    }
  }

  // Public API
  return {
    setupFakeVideo: setupFakeVideo,
    cleanup: cleanup,
    isHidden: function () {
      return isPageHidden;
    },
    forceKeepAlive: function () {
      // Force anti-throttle measures at any time
      intensifyAntiThrottleMeasures();
    },
  };
})();

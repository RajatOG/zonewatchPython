/**
 * ZoneWatch Video Player and Upload Management
 * Handles video upload, playback, and communication with the backend
 */

// Global variables
let sessionId = null;
let videoInfo = null;
let realTimeDetectionActive = false;
let lastCaptureTime = 0;
let detectionTimestamps = []; // Array to store detection timestamps
const CAPTURE_INTERVAL = 33; // Capture every 33ms (30 frames per second)
let videoPlayer = null;
let detectionTimeline = null;
let zoneDrawingActive = false;

// DOM elements
const uploadForm = document.getElementById("upload-form");
const videoInput = document.getElementById("videoInput");
const uploadBtn = document.getElementById("uploadBtn");
const uploadProgress = document.getElementById("uploadProgress");
const videoContainer = document.getElementById("videoContainer");
const analysisProgress = document.getElementById("analysisProgress");
const resultsContainer = document.getElementById("resultsContainer");
const timelineContainer = document.getElementById("timelineContainer");
const timelineEmpty = document.getElementById("timelineEmpty");
const timelineList = document.getElementById("timelineList");
const resultsStats = document.getElementById("resultsStats");
const resultsFrames = document.getElementById("resultsFrames");
const zoneRequiredMessage = document.getElementById("zoneRequiredMessage");
const externalPlayBtn = document.getElementById("externalPlayBtn");
const externalPauseBtn = document.getElementById("externalPauseBtn");

// Initialize video player
let detectionCanvas = null;
let detectionCanvasCtx = null;

// Event handlers for file upload
uploadForm.addEventListener("submit", function (e) {
  e.preventDefault();
  uploadVideo();
});

// Add event listener for file input change
videoInput.addEventListener("change", function () {
  if (this.files.length > 0) {
    uploadVideo();
  }
});

// Function to handle video upload
function uploadVideo() {
  const file = videoInput.files[0];
  if (!file) {
    alert("Please select a video file first.");
    return;
  }

  // Show progress bar
  uploadProgress.classList.remove("d-none");
  uploadBtn.disabled = true;

  // Create FormData and add the file
  const formData = new FormData();
  formData.append("video", file);

  // Upload the file to the server
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/upload", true);

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable) {
      const percentComplete = (e.loaded / e.total) * 100;
      uploadProgress.querySelector(".progress-bar").style.width =
        percentComplete + "%";
    }
  };

  xhr.onload = function () {
    if (xhr.status === 200) {
      const response = JSON.parse(xhr.responseText);

      if (response.success) {
        // Clear any existing zone
        if (window.zoneDrawer) {
          window.zoneDrawer.deleteZone();
          // Reset zone drawing state
          zoneDrawingActive = false;
        }

        // Update session ID and video info
        sessionId = response.session_id;
        videoInfo = response.video_info;

        // Reset detection timestamps
        detectionTimestamps = [];

        // Clear any existing timeline
        if (timelineList) {
          timelineList.innerHTML = "";
        }

        // Show timeline empty message
        if (timelineEmpty) {
          timelineEmpty.classList.remove("d-none");
        }
        if (timelineContainer) {
          timelineContainer.classList.add("d-none");
        }

        // Dispose of the existing video player if it exists
        if (videoPlayer) {
          videoPlayer.dispose();
          videoPlayer = null;
        }

        // Show the video player
        initializeVideoPlayer(response.filename);

        // Hide upload progress, show video container
        uploadProgress.classList.add("d-none");
        videoContainer.classList.remove("d-none");
      } else {
        alert("Error: " + response.error);
        uploadProgress.classList.add("d-none");
        uploadBtn.disabled = false;
      }
    } else {
      alert("Upload failed. Please try again.");
      uploadProgress.classList.add("d-none");
      uploadBtn.disabled = false;
    }
  };

  xhr.onerror = function () {
    alert("An error occurred during upload. Please try again.");
    uploadProgress.classList.add("d-none");
    uploadBtn.disabled = false;
  };

  xhr.send(formData);
}

// Initialize the video.js player
function initializeVideoPlayer(filename) {
  if (videoPlayer) {
    videoPlayer.dispose();
    videoPlayer = null;
  }

  // Reset detection timestamps array
  detectionTimestamps = [];

  const videoUrl = `/video/${sessionId}/${filename}`;
  console.log("Initializing video player with URL:", videoUrl);

  // Determine the video type from the filename
  let videoType = "video/mp4"; // Default
  const extension = filename.split(".").pop().toLowerCase();

  if (extension === "webm") {
    videoType = "video/webm";
  } else if (extension === "avi") {
    videoType = "video/x-msvideo";
  } else if (extension === "mov") {
    videoType = "video/quicktime";
  } else if (extension === "mkv") {
    videoType = "video/x-matroska";
  }

  // Create a new video element if it doesn't exist
  let videoElement = document.getElementById("videoPlayer");
  if (!videoElement) {
    videoElement = document.createElement("video");
    videoElement.id = "videoPlayer";
    videoElement.className = "video-js vjs-default-skin vjs-big-play-centered";
    videoElement.setAttribute("controls", "");
    videoElement.setAttribute("preload", "auto");
    videoElement.setAttribute("data-setup", "{}");
    document.querySelector(".video-container").appendChild(videoElement);
  }

  // Initialize the video.js player
  videoPlayer = videojs("videoPlayer", {
    controls: false, // Initially disable controls until zone is drawn
    preload: "auto",
    fluid: true,
    playbackRates: [], // Initially disable playback rates
    sources: [
      {
        src: videoUrl,
        type: videoType,
      },
    ],
  });

  // Add error handling
  videoPlayer.on("error", function (e) {
    console.error("Video player error:", e);
    alert("Error loading video. Please try again.");
  });

  // After video loads, enable analyze button and setup detection canvas
  videoPlayer.on("loadedmetadata", function () {
    console.log("Video metadata loaded successfully");

    // Setup detection canvas
    setupDetectionCanvas();

    if (window.zoneDrawer) {
      window.zoneDrawer.initialize();

      if (window.zoneDrawer.hasZone()) {
        enableVideoPlayback();
        hideZoneRequiredMessage();
      } else {
        showZoneRequiredMessage();
      }
    }

    // Initialize detection timeline
    if (window.detectionTimeline) {
      detectionTimeline = window.detectionTimeline;
    }

    // Start real-time detection
    toggleRealTimeDetection(true);
  });

  // Add timeupdate event for real-time detection
  videoPlayer.on("timeupdate", function () {
    if (realTimeDetectionActive && videoPlayer.paused() === false) {
      const currentTime = Date.now();
      // Limit capture rate to avoid overwhelming the server
      if (currentTime - lastCaptureTime >= CAPTURE_INTERVAL) {
        captureAndDetect();
        lastCaptureTime = currentTime;
      }
    }
  });

  // Add play event to ensure detection is active
  videoPlayer.on("play", function () {
    if (!realTimeDetectionActive) {
      toggleRealTimeDetection(true);
    }
    // Update external play/pause buttons
    externalPlayBtn.classList.add("d-none");
    externalPauseBtn.classList.remove("d-none");
  });

  // Add pause event to update external play/pause buttons
  videoPlayer.on("pause", function () {
    externalPlayBtn.classList.remove("d-none");
    externalPauseBtn.classList.add("d-none");
  });

  // Add ended event to show the timeline
  videoPlayer.on("ended", function () {
    showDetectionTimeline();
    // Update external play/pause buttons
    externalPlayBtn.classList.remove("d-none");
    externalPauseBtn.classList.add("d-none");
  });

  // Add zone drawing button to the video controls
  addZoneDrawingButton();

  // Add event listeners for external play/pause buttons
  if (externalPlayBtn) {
    externalPlayBtn.addEventListener("click", function () {
      if (videoPlayer) {
        videoPlayer.play();
      }
    });
  }

  if (externalPauseBtn) {
    externalPauseBtn.addEventListener("click", function () {
      if (videoPlayer) {
        videoPlayer.pause();
      }
    });
  }
}

// Add zone drawing button to the video controls
function addZoneDrawingButton() {
  if (!videoPlayer) return;

  const controlBar = videoPlayer.controlBar.el();

  // Remove existing zone drawing button if it exists
  const existingButton = controlBar.querySelector(".vjs-zone-button");
  if (existingButton) {
    existingButton.remove();
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "vjs-zone-button vjs-button";
  buttonContainer.innerHTML = '<span class="vjs-icon-draw-zone"></span>';
  buttonContainer.title = "Draw Zone";

  // Add click event
  buttonContainer.addEventListener("click", function () {
    toggleZoneDrawing();
  });

  // Add to control bar
  controlBar.appendChild(buttonContainer);
}

// Toggle zone drawing mode
function toggleZoneDrawing() {
  if (!window.zoneDrawer) return;

  // Reset zone drawing state if needed
  if (zoneDrawingActive === undefined) {
    zoneDrawingActive = false;
  }

  // Toggle zone drawing state
  zoneDrawingActive = !zoneDrawingActive;

  // Make sure the zone drawer is initialized
  if (zoneDrawingActive && !window.zoneDrawer.hasZone()) {
    window.zoneDrawer.initialize();
  }

  // Toggle drawing mode in the zone drawer
  window.zoneDrawer.toggleDrawing(zoneDrawingActive);

  // Update button appearance
  const button = document.querySelector(".vjs-zone-button");
  if (button) {
    if (zoneDrawingActive) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  }
}

// Enable video playback
function enableVideoPlayback() {
  if (videoPlayer) {
    videoPlayer.controls(false); // Keep controls disabled
    videoPlayer.playbackRates([0.5, 1, 1.5, 2]);
    // Show external play button
    if (externalPlayBtn) {
      externalPlayBtn.classList.remove("d-none");
    }
    if (externalPauseBtn) {
      externalPauseBtn.classList.add("d-none");
    }
  }
  hideZoneRequiredMessage();
}

// Disable video playback
function disableVideoPlayback() {
  if (videoPlayer) {
    videoPlayer.controls(false);
    videoPlayer.playbackRates([]);
    // Hide external play/pause buttons
    if (externalPlayBtn) {
      externalPlayBtn.classList.add("d-none");
    }
    if (externalPauseBtn) {
      externalPauseBtn.classList.add("d-none");
    }
  }
  showZoneRequiredMessage();
}

// Show zone required message
function showZoneRequiredMessage() {
  if (zoneRequiredMessage) {
    zoneRequiredMessage.style.display = "block";
  }
}

// Hide zone required message
function hideZoneRequiredMessage() {
  if (zoneRequiredMessage) {
    zoneRequiredMessage.style.display = "none";
  }
}

// Load video metadata
function loadVideoMetadata() {
  if (!sessionId) return;

  fetch(`/video-info/${sessionId}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        videoInfo = data.video_info;

        // Load zones if they exist
        if (window.zoneDrawer) {
          window.zoneDrawer.loadZone();
        }
      }
    })
    .catch((error) => console.error("Error loading video metadata:", error));
}

// Handle time update event
function handleTimeUpdate() {
  // Capture frame for detection at regular intervals
  if (videoPlayer && videoInfo) {
    const currentTime = videoPlayer.currentTime();
    const frameInterval = 1; // Capture a frame every second

    if (currentTime % frameInterval < 0.1) {
      captureFrameForDetection();
    }
  }
}

// Handle play event
function handlePlay() {
  // Check if zone exists before allowing playback
  if (window.zoneDrawer && !window.zoneDrawer.hasZone()) {
    videoPlayer.pause();
    showZoneRequiredMessage();
  }
}

// Handle pause event
function handlePause() {
  // Additional pause handling if needed
}

// Handle ended event
function handleEnded() {
  // Additional ended handling if needed
}

// Capture frame for detection
function captureFrameForDetection() {
  if (!videoPlayer || !videoInfo) return;

  // Create canvas to capture video frame
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  // Set canvas dimensions to match video dimensions
  canvas.width = videoPlayer.videoWidth();
  canvas.height = videoPlayer.videoHeight();

  // Draw current video frame to canvas
  context.drawImage(videoPlayer.tech().el(), 0, 0, canvas.width, canvas.height);

  // Convert canvas to base64 image
  const frameData = canvas.toDataURL("image/jpeg", 0.8);

  // Get zone if exists
  let zone = null;
  if (window.zoneDrawer) {
    zone = window.zoneDrawer.getZone();
  }

  // Send frame for detection
  fetch("/detect-frame", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      frame_data: frameData,
      session_id: sessionId,
      timestamp: videoPlayer.currentTime(),
      zone: zone,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update detection timeline
        if (detectionTimeline) {
          detectionTimeline.addDetection(data.timestamp, data.detections);
        }

        // Display detection frame if available
        if (data.result_frame) {
          displayDetectionFrame(
            data.result_frame,
            data.timestamp,
            data.detections
          );
        }
      }
    })
    .catch((error) => console.error("Error detecting frame:", error));
}

// Display detection frame
function displayDetectionFrame(frameData, timestamp, detections) {
  // Implementation for displaying detection frame
  // This would update the UI to show the detection frame with bounding boxes
}

// Setup canvas for displaying real-time detections
function setupDetectionCanvas() {
  // Create detection canvas if needed
  if (!detectionCanvas) {
    const playerContainer = document.querySelector(".video-js");

    detectionCanvas = document.createElement("canvas");
    detectionCanvas.className =
      "detection-canvas position-absolute top-0 start-0";
    detectionCanvas.style.pointerEvents = "none"; // Make it non-interactive

    // Append to player container
    playerContainer.appendChild(detectionCanvas);

    // Get context
    detectionCanvasCtx = detectionCanvas.getContext("2d");
  }

  // Resize canvas to match video dimensions
  const videoElement = videoPlayer.tech().el();
  detectionCanvas.width = videoElement.videoWidth;
  detectionCanvas.height = videoElement.videoHeight;

  // Make canvas responsive
  function updateCanvasSize() {
    const displayElement = videoPlayer.el().querySelector(".vjs-tech");
    const boundingRect = displayElement.getBoundingClientRect();

    detectionCanvas.style.width = boundingRect.width + "px";
    detectionCanvas.style.height = boundingRect.height + "px";
  }

  // Call initially and on resize
  updateCanvasSize();
  window.addEventListener("resize", updateCanvasSize);
}

// Toggle real-time detection
function toggleRealTimeDetection(enable) {
  realTimeDetectionActive = enable;

  // Clear detection canvas when disabled
  if (!realTimeDetectionActive && detectionCanvasCtx) {
    detectionCanvasCtx.clearRect(
      0,
      0,
      detectionCanvas.width,
      detectionCanvas.height
    );
  }
}

// Capture current video frame and send for detection
function captureAndDetect() {
  if (!videoPlayer || !detectionCanvas || !detectionCanvasCtx) return;

  try {
    // Get video element
    const videoElement = videoPlayer.tech().el();

    // Create offscreen canvas for capturing frame
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = videoElement.videoWidth;
    captureCanvas.height = videoElement.videoHeight;

    // Draw current video frame to canvas
    const ctx = captureCanvas.getContext("2d");
    ctx.drawImage(
      videoElement,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height
    );

    // Convert to base64
    const frameData = captureCanvas.toDataURL("image/jpeg", 0.7); // Use lower quality for better performance

    // Get zone if available
    let zone = null;
    if (window.zoneDrawer) {
      zone = window.zoneDrawer.getZone();
    }

    // Send frame for processing
    fetch("/detect-frame", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        frame_data: frameData,
        zone: zone,
        timestamp: videoPlayer.currentTime(),
        session_id: sessionId,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          displayDetectionOverlay(data.result_frame, data.detections);

          // Store detection timestamps if humans are detected
          if (data.detections && data.detections.length > 0) {
            const currentTime = videoPlayer.currentTime();
            // Check if this timestamp is already recorded (within 1 second)
            const isNewDetection = !detectionTimestamps.some(
              (detection) => Math.abs(detection.timestamp - currentTime) < 1
            );

            if (isNewDetection) {
              data.detections.forEach((detection) => {
                detectionTimestamps.push({
                  timestamp: currentTime,
                  confidence: detection.confidence,
                  frame_id: `realtime_${Date.now()}`,
                  box: detection.box,
                  zone_id: detection.zone_id,
                  zone_color: detection.zone_color,
                });
              });
            }
          }
        }
      })
      .catch((error) => {
        console.error("Error sending frame for detection:", error);
      });
  } catch (error) {
    console.error("Error capturing video frame:", error);
  }
}

// Display detection overlay on canvas
function displayDetectionOverlay(resultImageSrc, detections) {
  if (!detectionCanvasCtx || !detectionCanvas) return;

  // Clear previous detections
  detectionCanvasCtx.clearRect(
    0,
    0,
    detectionCanvas.width,
    detectionCanvas.height
  );

  // Draw detection boxes directly
  if (detections && detections.length > 0) {
    detections.forEach((detection) => {
      const [x1, y1, x2, y2] = detection.box;

      // Use zone color if available
      const boxColor = detection.zone_color || "green";

      detectionCanvasCtx.strokeStyle = boxColor;
      detectionCanvasCtx.lineWidth = 2;
      detectionCanvasCtx.font = "12px Arial";
      detectionCanvasCtx.fillStyle = boxColor;

      // Scale coordinates to canvas size
      const canvasWidth = detectionCanvas.width;
      const canvasHeight = detectionCanvas.height;

      // Calculate scaling factors
      const scaleX = canvasWidth / videoPlayer.tech().el().videoWidth;
      const scaleY = canvasHeight / videoPlayer.tech().el().videoHeight;

      // Apply scaling
      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;
      const scaledWidth = (x2 - x1) * scaleX;
      const scaledHeight = (y2 - y1) * scaleY;

      // Draw rectangle
      detectionCanvasCtx.strokeRect(
        scaledX1,
        scaledY1,
        scaledWidth,
        scaledHeight
      );

      // Draw label with confidence and zone info
      let labelText = `Person: ${Math.round(detection.confidence * 100)}%`;
      if (detection.zone_id) {
        labelText += ` (Zone ${detection.zone_id})`;
      }
      detectionCanvasCtx.fillText(labelText, scaledX1, scaledY1 - 5);
    });
  }
}

// Function to show the detection timeline after video ends
function showDetectionTimeline() {
  // Show timeline container
  timelineEmpty.classList.add("d-none");
  timelineContainer.classList.remove("d-none");

  // Sort detections by timestamp
  const sortedDetections = [...detectionTimestamps].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // Clear previous timeline items
  timelineList.innerHTML = "";

  // Check if there are any detections
  if (sortedDetections.length === 0) {
    timelineList.innerHTML = `
            <div class="list-group-item text-center py-3">
                <i class="fas fa-exclamation-circle text-warning fs-4 mb-2"></i>
                <p class="mb-0">No human movement detected in the video.</p>
            </div>
        `;
    return;
  }

  // Process detections to remove duplicates within small time windows (1 second)
  const uniqueDetections = [];
  let lastTimestamp = -2; // Start with a value that will always be different

  for (const detection of sortedDetections) {
    // If this detection is more than 1 second after the last one we added
    if (detection.timestamp - lastTimestamp > 1) {
      uniqueDetections.push(detection);
      lastTimestamp = detection.timestamp;
    }
  }

  // Create timeline items for each unique detection
  uniqueDetections.forEach((detection, index) => {
    const formattedTime = formatTime(detection.timestamp);
    const listItem = document.createElement("a");
    listItem.href = "#";
    listItem.className = "list-group-item list-group-item-action timeline-item";
    listItem.dataset.frameId = detection.frame_id;
    listItem.dataset.timestamp = detection.timestamp;

    // Add zone information if available
    let zoneInfo = "";
    if (detection.zone_id) {
      zoneInfo = `<span class="badge rounded-pill" style="background-color: ${detection.zone_color}">Zone ${detection.zone_id}</span>`;
    }

    listItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1"><i class="fas fa-user me-2"></i>Human Detected ${zoneInfo}</h6>
                <small class="text-muted">${formattedTime}</small>
            </div>
            <p class="mb-1">Confidence: <span class="badge bg-info">${Math.round(
              detection.confidence * 100
            )}%</span></p>
        `;

    // Add click event to seek to this time in the video
    listItem.addEventListener("click", function (e) {
      e.preventDefault();
      videoPlayer.currentTime(detection.timestamp);

      // Highlight the current item
      document.querySelectorAll(".timeline-item").forEach((item) => {
        item.classList.remove("active");
      });
      this.classList.add("active");
    });

    timelineList.appendChild(listItem);
  });

  // Create detection timeline visualization
  createTimelineVisualization(uniqueDetections);
}

// Helper function to format seconds to MM:SS or HH:MM:SS
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  } else {
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
}

// Export functions for use in other modules
window.videoPlayerModule = {
  initializeVideoPlayer: initializeVideoPlayer,
  toggleZoneDrawing: toggleZoneDrawing,
  enableVideoPlayback: enableVideoPlayback,
  disableVideoPlayback: disableVideoPlayback,
  showZoneRequiredMessage: showZoneRequiredMessage,
  hideZoneRequiredMessage: hideZoneRequiredMessage,
};

/**
 * Detection Timeline Visualization
 * Creates a visual timeline of movement detection events
 */

// Function to create timeline visualization from detection data
function createTimelineVisualization(detections) {
  if (!detections || detections.length === 0) {
    return;
  }

  // Get the video duration from the videoInfo global variable
  const videoDuration = videoInfo.duration;

  // Create a container for visualization if it doesn't exist
  let visualContainer = document.getElementById("timelineVisualization");
  if (!visualContainer) {
    visualContainer = document.createElement("div");
    visualContainer.id = "timelineVisualization";
    visualContainer.className = "timeline-visualization mt-3";
    timelineContainer.prepend(visualContainer);
  } else {
    visualContainer.innerHTML = "";
  }

  // Create timeline bar
  const timelineBar = document.createElement("div");
  timelineBar.className = "timeline-bar";
  visualContainer.appendChild(timelineBar);

  // Calculate positions and add markers
  detections.forEach((detection) => {
    const position = (detection.timestamp / videoDuration) * 100;
    const marker = document.createElement("div");
    marker.className = "timeline-marker";

    // Add zone color if available
    if (detection.zone_id && detection.zone_color) {
      marker.style.backgroundColor = detection.zone_color;
      marker.style.borderColor = detection.zone_color;
    }

    marker.style.left = `${position}%`;
    marker.title = `Human detected at ${formatTime(detection.timestamp)}${
      detection.zone_id ? " in Zone " + detection.zone_id : ""
    }`;

    // Add click event to seek to this point in the video
    marker.addEventListener("click", () => {
      videoPlayer.currentTime(detection.timestamp);

      // Highlight the corresponding timeline item
      document.querySelectorAll(".timeline-item").forEach((item) => {
        item.classList.remove("active");
      });
      document
        .querySelector(`.timeline-item[data-frame-id="${detection.frame_id}"]`)
        .classList.add("active");

      // Scroll to the frame in results
      const frameElement = document.querySelector(
        `.detection-frame[data-frame-id="${detection.frame_id}"]`
      );
      if (frameElement) {
        frameElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    timelineBar.appendChild(marker);
  });

  // Add time scale
  const timeScale = document.createElement("div");
  timeScale.className = "time-scale";

  // Add time markers - one every minute, plus end marker
  const minuteMarkers = Math.ceil(videoDuration / 60);
  for (let i = 0; i <= minuteMarkers; i++) {
    const markerPosition = ((i * 60) / videoDuration) * 100;
    if (markerPosition <= 100) {
      const timeMarker = document.createElement("div");
      timeMarker.className = "time-marker";
      timeMarker.style.left = `${markerPosition}%`;

      const timeLabel = document.createElement("span");
      timeLabel.className = "time-label";
      timeLabel.textContent = formatTime(i * 60);
      timeMarker.appendChild(timeLabel);

      timeScale.appendChild(timeMarker);
    }
  }

  // Add end marker if not already covered by minute markers
  if (videoDuration % 60 > 0 && minuteMarkers * 60 < videoDuration) {
    const endMarker = document.createElement("div");
    endMarker.className = "time-marker";
    endMarker.style.left = "100%";

    const endLabel = document.createElement("span");
    endLabel.className = "time-label";
    endLabel.textContent = formatTime(videoDuration);
    endMarker.appendChild(endLabel);

    timeScale.appendChild(endMarker);
  }

  visualContainer.appendChild(timeScale);

  // Add indicator of current playback position
  const playbackIndicator = document.createElement("div");
  playbackIndicator.className = "playback-indicator";
  timelineBar.appendChild(playbackIndicator);

  // Update playback indicator position as video plays
  videoPlayer.on("timeupdate", () => {
    const currentPosition = (videoPlayer.currentTime() / videoDuration) * 100;
    playbackIndicator.style.left = `${currentPosition}%`;
  });

  // Add timeline interactivity - click on timeline to seek
  timelineBar.addEventListener("click", (e) => {
    const rect = timelineBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    videoPlayer.currentTime(clickPosition * videoDuration);
  });
}

// Function to show the detection timeline
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

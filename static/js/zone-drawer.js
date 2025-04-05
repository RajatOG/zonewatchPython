/**
 * ZoneWatch Zone Drawing Functionality
 * Allows users to draw a single rectangular zone on the video for movement detection
 */

// Global variables for zone drawing
let zoneCanvas = null;
let zoneCanvasCtx = null;
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentZone = null;
let zone = null; // Single zone instead of multiple zones
let zoneCounter = 0;
let videoWidth = 0;
let videoHeight = 0;

// DOM elements
const zonesEmpty = document.getElementById("zonesEmpty");
const zonesContainer = document.getElementById("zonesContainer");
const zonesList = document.getElementById("zonesList");

// Initialize zone drawing functionality
function initializeZoneDrawing() {
  // Remove existing canvas if it exists
  if (zoneCanvas) {
    zoneCanvas.remove();
    zoneCanvas = null;
    zoneCanvasCtx = null;
  }

  // Create canvas for zone drawing
  const playerContainer = document.querySelector(".video-js");
  if (!playerContainer) return;

  zoneCanvas = document.createElement("canvas");
  zoneCanvas.id = "zoneCanvas";
  zoneCanvas.className = "position-absolute top-0 start-0";

  // Append to player container
  playerContainer.appendChild(zoneCanvas);

  // Get context
  zoneCanvasCtx = zoneCanvas.getContext("2d");

  // Add event listeners for drawing
  zoneCanvas.addEventListener("mousedown", startDrawing);
  zoneCanvas.addEventListener("mousemove", draw);
  zoneCanvas.addEventListener("mouseup", endDrawing);
  zoneCanvas.addEventListener("mouseleave", endDrawing);

  // Get video dimensions
  if (videoPlayer) {
    videoWidth = videoPlayer.videoWidth();
    videoHeight = videoPlayer.videoHeight();
  }

  // Resize canvas to match video dimensions
  resizeZoneCanvas();

  // Add resize event listener
  window.addEventListener("resize", resizeZoneCanvas);

  // Reset zone drawing state
  isDrawing = false;
  currentZone = null;

  // Clear any existing zone
  zone = null;

  // Update UI to show zone required message
  if (zonesEmpty) {
    zonesEmpty.classList.remove("d-none");
  }
  if (zonesContainer) {
    zonesContainer.classList.add("d-none");
  }

  // Disable video playback until zone is drawn
  disableVideoPlayback();
}

// Resize zone canvas to match video dimensions
function resizeZoneCanvas() {
  if (!zoneCanvas || !videoPlayer) return;

  const videoElement = videoPlayer.tech().el();
  const displayElement = videoPlayer.el().querySelector(".vjs-tech");
  const boundingRect = displayElement.getBoundingClientRect();

  // Set canvas dimensions to match video display size
  zoneCanvas.width = boundingRect.width;
  zoneCanvas.height = boundingRect.height;

  // Update video dimensions if available
  if (videoPlayer.videoWidth() && videoPlayer.videoHeight()) {
    videoWidth = videoPlayer.videoWidth();
    videoHeight = videoPlayer.videoHeight();
  }

  // Redraw zone if exists
  redrawZone();
}

// Convert screen coordinates to video coordinates
function screenToVideoCoords(screenX, screenY) {
  if (!videoPlayer || !zoneCanvas) return { x: 0, y: 0 };

  // Get the current display size of the video
  const displayElement = videoPlayer.el().querySelector(".vjs-tech");
  const boundingRect = displayElement.getBoundingClientRect();
  const displayWidth = boundingRect.width;
  const displayHeight = boundingRect.height;

  // Calculate scaling factors
  const scaleX = videoWidth / displayWidth;
  const scaleY = videoHeight / displayHeight;

  // Convert screen coordinates to video coordinates
  const videoX = Math.round(screenX * scaleX);
  const videoY = Math.round(screenY * scaleY);

  return { x: videoX, y: videoY };
}

// Convert video coordinates to screen coordinates
function videoToScreenCoords(videoX, videoY) {
  if (!videoPlayer || !zoneCanvas) return { x: 0, y: 0 };

  // Get the current display size of the video
  const displayElement = videoPlayer.el().querySelector(".vjs-tech");
  const boundingRect = displayElement.getBoundingClientRect();
  const displayWidth = boundingRect.width;
  const displayHeight = boundingRect.height;

  // Calculate scaling factors
  const scaleX = displayWidth / videoWidth;
  const scaleY = displayHeight / videoHeight;

  // Convert video coordinates to screen coordinates
  const screenX = Math.round(videoX * scaleX);
  const screenY = Math.round(videoY * scaleY);

  return { x: screenX, y: screenY };
}

// Start drawing a new zone
function startDrawing(e) {
  if (!zoneCanvas) return;

  // Get canvas coordinates
  const rect = zoneCanvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  // Convert to video coordinates
  const videoCoords = screenToVideoCoords(canvasX, canvasY);
  startX = videoCoords.x;
  startY = videoCoords.y;

  isDrawing = true;

  // Create a new zone object
  currentZone = {
    id: `zone_${zoneCounter++}`,
    x: startX,
    y: startY,
    width: 0,
    height: 0,
    color: getRandomColor(),
  };

  // Draw the initial point
  zoneCanvasCtx.clearRect(0, 0, zoneCanvas.width, zoneCanvas.height);
  redrawZone();
  drawZone(currentZone);
}

// Draw the current zone as the mouse moves
function draw(e) {
  if (!isDrawing || !currentZone) return;

  // Get canvas coordinates
  const rect = zoneCanvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  // Convert to video coordinates
  const videoCoords = screenToVideoCoords(canvasX, canvasY);
  const currentX = videoCoords.x;
  const currentY = videoCoords.y;

  // Update zone dimensions in video coordinates
  currentZone.width = currentX - startX;
  currentZone.height = currentY - startY;

  // Redraw all zones
  zoneCanvasCtx.clearRect(0, 0, zoneCanvas.width, zoneCanvas.height);
  redrawZone();
  drawZone(currentZone);
}

// End drawing and save the zone
function endDrawing() {
  if (!isDrawing || !currentZone) return;

  // Ensure width and height are positive
  if (currentZone.width < 0) {
    currentZone.x += currentZone.width;
    currentZone.width = Math.abs(currentZone.width);
  }

  if (currentZone.height < 0) {
    currentZone.y += currentZone.height;
    currentZone.height = Math.abs(currentZone.height);
  }

  // Only save zones with meaningful dimensions
  if (currentZone.width > 10 && currentZone.height > 10) {
    // Set the single zone
    zone = currentZone;

    // Update zones list in the UI
    updateZonesList();

    // Save zone to session storage
    saveZone();

    // Enable video playback
    enableVideoPlayback();
  }

  // Reset drawing state
  isDrawing = false;
  currentZone = null;

  // Redraw zone
  redrawZone();
}

// Draw a single zone on the canvas
function drawZone(zoneToDraw) {
  if (!zoneCanvasCtx) return;

  // Convert video coordinates to screen coordinates for display
  const screenCoords = videoToScreenCoords(zoneToDraw.x, zoneToDraw.y);
  const screenWidth = Math.round(
    zoneToDraw.width * (zoneCanvas.width / videoWidth)
  );
  const screenHeight = Math.round(
    zoneToDraw.height * (zoneCanvas.height / videoHeight)
  );

  // Set drawing style
  zoneCanvasCtx.strokeStyle = zoneToDraw.color;
  zoneCanvasCtx.lineWidth = 2;
  zoneCanvasCtx.setLineDash([5, 5]);

  // Draw rectangle
  zoneCanvasCtx.strokeRect(
    screenCoords.x,
    screenCoords.y,
    screenWidth,
    screenHeight
  );

  // Draw semi-transparent fill
  zoneCanvasCtx.fillStyle = `${zoneToDraw.color}33`; // Add transparency
  zoneCanvasCtx.fillRect(
    screenCoords.x,
    screenCoords.y,
    screenWidth,
    screenHeight
  );

  // Reset line dash
  zoneCanvasCtx.setLineDash([]);
}

// Redraw the zone on the canvas
function redrawZone() {
  if (!zoneCanvasCtx) return;

  // Clear canvas
  zoneCanvasCtx.clearRect(0, 0, zoneCanvas.width, zoneCanvas.height);

  // Draw zone if exists
  if (zone) {
    drawZone(zone);
  }
}

// Update the zones list in the UI
function updateZonesList() {
  if (!zone) {
    zonesEmpty.classList.remove("d-none");
    zonesContainer.classList.add("d-none");
    return;
  }

  zonesEmpty.classList.add("d-none");
  zonesContainer.classList.remove("d-none");

  // Clear existing list
  zonesList.innerHTML = "";

  // Calculate zone coordinates in video dimensions
  const absX1 = zone.x;
  const absY1 = zone.y;
  const absX2 = zone.x + zone.width;
  const absY2 = zone.y + zone.height;

  // Store absolute coordinates in the zone object
  zone.absCoords = {
    x1: absX1,
    y1: absY1,
    x2: absX2,
    y2: absY2,
  };

  const li = document.createElement("li");
  li.className =
    "list-group-item d-flex justify-content-between align-items-center";
  li.dataset.zoneId = zone.id;

  li.innerHTML = `
    <div>
      <span class="zone-color-indicator" style="background-color: ${zone.color}"></span>
      <span>Zone</span>
      <small class="text-muted ms-2">(${absX1}, ${absY1}) to (${absX2}, ${absY2})</small>
    </div>
    <button class="btn btn-sm btn-danger delete-zone" data-zone-id="${zone.id}">
      <i class="fas fa-trash"></i>
    </button>
  `;

  zonesList.appendChild(li);

  // Add event listener to delete button
  document.querySelector(".delete-zone").addEventListener("click", function () {
    deleteZone();
  });
}

// Delete the zone
function deleteZone() {
  zone = null;
  updateZonesList();
  redrawZone();
  saveZone();
  disableVideoPlayback();
}

// Save zone to session storage
function saveZone() {
  if (sessionId) {
    sessionStorage.setItem(`zone_${sessionId}`, JSON.stringify(zone));
  }
}

// Load zone from session storage
function loadZone() {
  if (sessionId) {
    const savedZone = sessionStorage.getItem(`zone_${sessionId}`);
    if (savedZone) {
      zone = JSON.parse(savedZone);
      updateZonesList();
      redrawZone();
      enableVideoPlayback();
    } else {
      disableVideoPlayback();
    }
  }
}

// Get a random color for a new zone
function getRandomColor() {
  const colors = [
    "#FF5733", // Red-Orange
    "#33FF57", // Green
    "#3357FF", // Blue
    "#F033FF", // Purple
    "#FF33A8", // Pink
    "#33FFF5", // Cyan
    "#FFD700", // Gold
    "#FF5733", // Orange
    "#33FF57", // Lime
    "#3357FF", // Indigo
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}

// Toggle zone drawing mode
function toggleZoneDrawing(enable) {
  if (!zoneCanvas) return;

  if (enable) {
    zoneCanvas.classList.add("editing");
    zoneCanvas.style.cursor = "crosshair";
  } else {
    zoneCanvas.classList.remove("editing");
    zoneCanvas.style.cursor = "default";
  }
}

// Get the zone with its coordinates
function getZone() {
  if (!zone) return null;

  return {
    id: zone.id,
    coords: zone.absCoords,
    color: zone.color,
  };
}

// Enable video playback
function enableVideoPlayback() {
  if (videoPlayer) {
    videoPlayer.controls(true);
    videoPlayer.playbackRates([0.5, 1, 1.5, 2]);
  }
}

// Disable video playback
function disableVideoPlayback() {
  if (videoPlayer) {
    videoPlayer.controls(false);
    videoPlayer.playbackRates([]);
  }
}

// Export functions for use in other modules
window.zoneDrawer = {
  initialize: initializeZoneDrawing,
  toggleDrawing: toggleZoneDrawing,
  getZone: getZone,
  loadZone: loadZone,
  deleteZone: deleteZone,
  hasZone: function () {
    return zone !== null;
  },
};

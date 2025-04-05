/**
 * ZoneWatch Zone Drawing Tool
 * Allows users to draw polygon zones on the video for movement detection
 */

// Zone drawing variables
let canvas;
let isDrawing = false;
let activeZoneId = null;
let zones = [];
let zoneColors = [
    '#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3', 
    '#33FFF3', '#FF8033', '#8033FF', '#33FF80', '#FF3380'
];

// DOM elements
const zoneCanvas = document.getElementById('zoneCanvas');
const drawZoneBtn = document.getElementById('drawZoneBtn');
const clearZonesBtn = document.getElementById('clearZonesBtn');
const zonesContainer = document.getElementById('zonesContainer');
const zonesEmpty = document.getElementById('zonesEmpty');
const zonesList = document.getElementById('zonesList');

// Initialize the zone drawer with video dimensions
function initializeZoneDrawer(videoWidth, videoHeight) {
    // Create a new Fabric.js canvas
    canvas = new fabric.Canvas('zoneCanvas', {
        width: videoWidth,
        height: videoHeight,
        selection: false
    });
    
    // Resize canvas to match video player dimensions
    resizeCanvas();
    
    // Add resize event listener
    window.addEventListener('resize', resizeCanvas);
    
    // Initialize drawing button event listeners
    drawZoneBtn.addEventListener('click', startDrawingMode);
    clearZonesBtn.addEventListener('click', clearAllZones);
    
    // Reset zones
    zones = [];
    updateZonesList();
}

// Resize canvas to match video player dimensions
function resizeCanvas() {
    if (!canvas) return;
    
    const videoElement = document.querySelector('#videoPlayer');
    if (!videoElement) return;
    
    const videoRect = videoElement.getBoundingClientRect();
    const scaleFactor = videoRect.width / canvas.getWidth();
    
    canvas.setDimensions({
        width: videoRect.width,
        height: videoRect.height
    });
    
    canvas.setZoom(scaleFactor);
    canvas.renderAll();
}

// Start drawing mode
function startDrawingMode() {
    if (isDrawing) {
        stopDrawingMode();
        return;
    }
    
    isDrawing = true;
    activeZoneId = zones.length;
    
    // Update button text
    drawZoneBtn.innerHTML = '<i class="fas fa-check me-1"></i> Finish Zone';
    drawZoneBtn.classList.remove('btn-outline-warning');
    drawZoneBtn.classList.add('btn-warning');
    
    // Make canvas editable
    zoneCanvas.classList.add('editing');
    
    // Create a new polygon
    const polygon = new fabric.Polygon([], {
        fill: hexToRgba(zoneColors[activeZoneId % zoneColors.length], 0.3),
        stroke: zoneColors[activeZoneId % zoneColors.length],
        strokeWidth: 2,
        selectable: false,
        objectCaching: false
    });
    
    canvas.add(polygon);
    
    // Add click event for adding points
    canvas.on('mouse:down', addPoint);
}

// Stop drawing mode
function stopDrawingMode() {
    if (!isDrawing) return;
    
    isDrawing = false;
    
    // Update button text
    drawZoneBtn.innerHTML = '<i class="fas fa-draw-polygon me-1"></i> Draw Zone';
    drawZoneBtn.classList.remove('btn-warning');
    drawZoneBtn.classList.add('btn-outline-warning');
    
    // Remove canvas editing class
    zoneCanvas.classList.remove('editing');
    
    // Remove click event
    canvas.off('mouse:down', addPoint);
    
    // Get the active polygon
    const polygon = canvas.getObjects('polygon')[activeZoneId];
    
    // Check if polygon has enough points
    if (polygon && polygon.points.length < 3) {
        canvas.remove(polygon);
    } else if (polygon) {
        // Save the zone
        zones.push({
            id: activeZoneId,
            color: zoneColors[activeZoneId % zoneColors.length],
            points: polygon.points.map(p => ({ x: p.x, y: p.y }))
        });
        
        // Make polygon non-editable
        polygon.set({
            selectable: false,
            hoverCursor: 'default'
        });
        
        // Update zones list
        updateZonesList();
    }
    
    activeZoneId = null;
}

// Add a point to the active polygon
function addPoint(options) {
    if (!isDrawing || activeZoneId === null) return;
    
    const pointer = canvas.getPointer(options.e);
    const polygon = canvas.getObjects('polygon')[activeZoneId];
    
    if (!polygon) return;
    
    const points = polygon.get('points');
    points.push({ x: pointer.x, y: pointer.y });
    
    polygon.set({ points: points });
    canvas.renderAll();
}

// Clear all zones
function clearAllZones() {
    if (isDrawing) {
        stopDrawingMode();
    }
    
    // Clear the canvas
    canvas.clear();
    
    // Reset zones array
    zones = [];
    
    // Update zones list
    updateZonesList();
}

// Update the zones list UI
function updateZonesList() {
    if (zones.length === 0) {
        zonesContainer.classList.add('d-none');
        zonesEmpty.classList.remove('d-none');
        return;
    }
    
    zonesContainer.classList.remove('d-none');
    zonesEmpty.classList.add('d-none');
    
    // Clear the list
    zonesList.innerHTML = '';
    
    // Add each zone to the list
    zones.forEach(zone => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        listItem.innerHTML = `
            <div>
                <span class="zone-color-indicator" style="background-color: ${zone.color}"></span>
                Zone ${zone.id + 1} (${zone.points.length} points)
            </div>
            <button class="btn btn-sm btn-outline-danger delete-zone-btn" data-zone-id="${zone.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        zonesList.appendChild(listItem);
    });
    
    // Add delete event listeners
    document.querySelectorAll('.delete-zone-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const zoneId = parseInt(this.dataset.zoneId);
            deleteZone(zoneId);
        });
    });
}

// Delete a specific zone
function deleteZone(zoneId) {
    // Find the polygon on the canvas
    const objects = canvas.getObjects('polygon');
    const polygonIndex = objects.findIndex((obj, index) => {
        return zones.find(zone => zone.id === zoneId);
    });
    
    if (polygonIndex !== -1) {
        canvas.remove(objects[polygonIndex]);
    }
    
    // Remove from zones array
    zones = zones.filter(zone => zone.id !== zoneId);
    
    // Update zones list
    updateZonesList();
}

// Get the current zones for analysis
function getZones() {
    // Return a normalized version of the zones with coordinates relative to video dimensions
    return zones.map(zone => {
        // Get the original video dimensions
        const videoWidth = canvas.getWidth() / canvas.getZoom();
        const videoHeight = canvas.getHeight() / canvas.getZoom();
        
        // Normalize points to 0-1 range
        const normalizedPoints = zone.points.map(point => ({
            x: point.x / videoWidth,
            y: point.y / videoHeight
        }));
        
        return {
            id: zone.id,
            color: zone.color,
            points: normalizedPoints
        };
    });
}

// Helper function to convert hex color to rgba
function hexToRgba(hex, alpha) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Return rgba string
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

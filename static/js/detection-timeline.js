/**
 * ZoneWatch Detection Timeline Visualization
 * Creates visual timeline of detected movement events
 */

// Function to create a visual timeline of detections
function createTimelineVisualization(detections) {
    if (!detections || detections.length === 0) return;
    
    // Make sure we have video info
    if (!videoInfo || !videoInfo.duration) return;
    
    // Create a timeline container if it doesn't exist
    const timelineVisContainer = document.getElementById('timelineVisContainer');
    if (!timelineVisContainer) {
        const container = document.createElement('div');
        container.id = 'timelineVisContainer';
        container.className = 'mt-4';
        container.innerHTML = `
            <h6 class="mb-2">Detection Timeline</h6>
            <div class="timeline-vis-wrapper position-relative mb-2" style="height: 50px;">
                <div class="timeline-vis-bar position-absolute w-100 bg-dark" style="height: 20px; top: 15px; border-radius: 10px;"></div>
                <div id="timelineMarkers" class="position-absolute w-100" style="height: 50px; top: 0;"></div>
            </div>
            <div class="d-flex justify-content-between">
                <small class="text-muted">00:00</small>
                <small class="text-muted">${formatTime(videoInfo.duration)}</small>
            </div>
        `;
        
        // Add the container to the DOM
        const timelineContainer = document.getElementById('timelineContainer');
        timelineContainer.appendChild(container);
    }
    
    // Clear existing markers
    const markersContainer = document.getElementById('timelineMarkers');
    markersContainer.innerHTML = '';
    
    // Add markers for each detection
    detections.forEach((detection, index) => {
        const percent = (detection.timestamp / videoInfo.duration) * 100;
        const marker = document.createElement('div');
        marker.className = 'timeline-marker position-absolute';
        marker.style.left = `${percent}%`;
        marker.style.top = '5px';
        marker.style.width = '10px';
        marker.style.height = '40px';
        marker.style.cursor = 'pointer';
        
        // Color the marker based on the zone
        const zoneIndex = detection.zone_id % zoneColors.length;
        const zoneColor = zoneColors[zoneIndex];
        
        marker.innerHTML = `
            <div class="marker-dot rounded-circle" style="width: 10px; height: 10px; background-color: ${zoneColor};"></div>
            <div class="marker-line" style="width: 2px; height: 30px; margin-left: 4px; background-color: ${zoneColor};"></div>
        `;
        
        // Add tooltip with detection info
        marker.setAttribute('data-bs-toggle', 'tooltip');
        marker.setAttribute('data-bs-placement', 'top');
        marker.setAttribute('title', `${formatTime(detection.timestamp)} - Zone ${detection.zone_id + 1}`);
        
        // Add click event to seek to this time in the video
        marker.addEventListener('click', function() {
            videoPlayer.currentTime(detection.timestamp);
            
            // Highlight the corresponding timeline item
            document.querySelectorAll('.timeline-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`.timeline-item[data-frame-id="${detection.frame_id}"]`).classList.add('active');
            
            // Scroll to the corresponding detection frame
            const frameElement = document.querySelector(`.detection-frame[data-frame-id="${detection.frame_id}"]`);
            if (frameElement) {
                frameElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        
        markersContainer.appendChild(marker);
    });
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Create clusters for markers that are too close together
    createMarkerClusters();
}

// Function to create clusters for timeline markers that are too close together
function createMarkerClusters() {
    const markers = document.querySelectorAll('.timeline-marker');
    const positions = [];
    
    // Get all marker positions
    markers.forEach(marker => {
        positions.push({
            element: marker,
            position: parseFloat(marker.style.left)
        });
    });
    
    // Sort by position
    positions.sort((a, b) => a.position - b.position);
    
    // Create clusters for markers that are closer than 3%
    const clusters = [];
    let currentCluster = [positions[0]];
    
    for (let i = 1; i < positions.length; i++) {
        const prevPosition = positions[i - 1].position;
        const currentPosition = positions[i].position;
        
        if (currentPosition - prevPosition < 3) {
            // Add to current cluster
            currentCluster.push(positions[i]);
        } else {
            // Start a new cluster
            if (currentCluster.length > 0) {
                clusters.push(currentCluster);
            }
            currentCluster = [positions[i]];
        }
    }
    
    // Add the last cluster
    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }
    
    // Process clusters with more than one marker
    clusters.forEach(cluster => {
        if (cluster.length > 1) {
            // Create a cluster marker
            const avgPosition = cluster.reduce((sum, item) => sum + item.position, 0) / cluster.length;
            const firstMarker = cluster[0].element;
            
            // Update the first marker to be a cluster marker
            firstMarker.classList.add('cluster-marker');
            firstMarker.style.left = `${avgPosition}%`;
            firstMarker.innerHTML = `
                <div class="cluster-dot rounded-circle d-flex justify-content-center align-items-center" 
                     style="width: 16px; height: 16px; background-color: var(--bs-primary); color: white; font-size: 10px;">
                    ${cluster.length}
                </div>
                <div class="marker-line" style="width: 2px; height: 30px; margin-left: 7px; background-color: var(--bs-primary);"></div>
            `;
            
            firstMarker.setAttribute('title', `${cluster.length} detections around ${formatTime(avgPosition * videoInfo.duration / 100)}`);
            
            // Hide other markers in the cluster
            for (let i = 1; i < cluster.length; i++) {
                cluster[i].element.style.display = 'none';
            }
        }
    });
}

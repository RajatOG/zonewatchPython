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
    let visualContainer = document.getElementById('timelineVisualization');
    if (!visualContainer) {
        visualContainer = document.createElement('div');
        visualContainer.id = 'timelineVisualization';
        visualContainer.className = 'timeline-visualization mt-3';
        timelineContainer.prepend(visualContainer);
    } else {
        visualContainer.innerHTML = '';
    }
    
    // Create timeline bar
    const timelineBar = document.createElement('div');
    timelineBar.className = 'timeline-bar';
    visualContainer.appendChild(timelineBar);
    
    // Calculate positions and add markers
    detections.forEach(detection => {
        const position = (detection.timestamp / videoDuration) * 100;
        const marker = document.createElement('div');
        marker.className = 'timeline-marker';
        marker.style.left = `${position}%`;
        marker.title = `Human detected at ${formatTime(detection.timestamp)}`;
        
        // Add click event to seek to this point in the video
        marker.addEventListener('click', () => {
            videoPlayer.currentTime(detection.timestamp);
            
            // Highlight the corresponding timeline item
            document.querySelectorAll('.timeline-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`.timeline-item[data-frame-id="${detection.frame_id}"]`).classList.add('active');
            
            // Scroll to the frame in results
            const frameElement = document.querySelector(`.detection-frame[data-frame-id="${detection.frame_id}"]`);
            if (frameElement) {
                frameElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        
        timelineBar.appendChild(marker);
    });
    
    // Add time scale
    const timeScale = document.createElement('div');
    timeScale.className = 'time-scale';
    
    // Add time markers - one every minute, plus end marker
    const minuteMarkers = Math.ceil(videoDuration / 60);
    for (let i = 0; i <= minuteMarkers; i++) {
        const markerPosition = (i * 60 / videoDuration) * 100;
        if (markerPosition <= 100) {
            const timeMarker = document.createElement('div');
            timeMarker.className = 'time-marker';
            timeMarker.style.left = `${markerPosition}%`;
            
            const timeLabel = document.createElement('span');
            timeLabel.className = 'time-label';
            timeLabel.textContent = formatTime(i * 60);
            timeMarker.appendChild(timeLabel);
            
            timeScale.appendChild(timeMarker);
        }
    }
    
    // Add end marker if not already covered by minute markers
    if (videoDuration % 60 > 0 && minuteMarkers * 60 < videoDuration) {
        const endMarker = document.createElement('div');
        endMarker.className = 'time-marker';
        endMarker.style.left = '100%';
        
        const endLabel = document.createElement('span');
        endLabel.className = 'time-label';
        endLabel.textContent = formatTime(videoDuration);
        endMarker.appendChild(endLabel);
        
        timeScale.appendChild(endMarker);
    }
    
    visualContainer.appendChild(timeScale);
    
    // Add indicator of current playback position
    const playbackIndicator = document.createElement('div');
    playbackIndicator.className = 'playback-indicator';
    timelineBar.appendChild(playbackIndicator);
    
    // Update playback indicator position as video plays
    videoPlayer.on('timeupdate', () => {
        const currentPosition = (videoPlayer.currentTime() / videoDuration) * 100;
        playbackIndicator.style.left = `${currentPosition}%`;
    });
    
    // Add timeline interactivity - click on timeline to seek
    timelineBar.addEventListener('click', (e) => {
        const rect = timelineBar.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        videoPlayer.currentTime(clickPosition * videoDuration);
    });
}

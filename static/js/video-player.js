/**
 * ZoneWatch Video Player and Upload Management
 * Handles video upload, playback, and communication with the backend
 */

// Global variables
let sessionId = null;
let videoInfo = null;

// DOM elements
const uploadForm = document.getElementById('upload-form');
const videoInput = document.getElementById('videoInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const videoContainer = document.getElementById('videoContainer');
const analyzeBtn = document.getElementById('analyzeBtn');
const analysisProgress = document.getElementById('analysisProgress');
const resultsContainer = document.getElementById('resultsContainer');
const timelineContainer = document.getElementById('timelineContainer');
const timelineEmpty = document.getElementById('timelineEmpty');
const timelineList = document.getElementById('timelineList');
const resultsStats = document.getElementById('resultsStats');
const resultsFrames = document.getElementById('resultsFrames');

// Initialize video player
let videoPlayer = null;

// Event handlers for file upload
uploadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const file = videoInput.files[0];
    if (!file) {
        alert('Please select a video file first.');
        return;
    }
    
    // Show progress bar
    uploadProgress.classList.remove('d-none');
    uploadBtn.disabled = true;
    
    // Create FormData and add the file
    const formData = new FormData();
    formData.append('video', file);
    
    // Upload the file to the server
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    
    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            uploadProgress.querySelector('.progress-bar').style.width = percentComplete + '%';
        }
    };
    
    xhr.onload = function() {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            
            if (response.success) {
                sessionId = response.session_id;
                videoInfo = response.video_info;
                
                // Show the video player
                initializeVideoPlayer(sessionId, response.filename);
                
                // Hide upload progress, show video container
                uploadProgress.classList.add('d-none');
                videoContainer.classList.remove('d-none');
            } else {
                alert('Error: ' + response.error);
                uploadProgress.classList.add('d-none');
                uploadBtn.disabled = false;
            }
        } else {
            alert('Upload failed. Please try again.');
            uploadProgress.classList.add('d-none');
            uploadBtn.disabled = false;
        }
    };
    
    xhr.onerror = function() {
        alert('An error occurred during upload. Please try again.');
        uploadProgress.classList.add('d-none');
        uploadBtn.disabled = false;
    };
    
    xhr.send(formData);
});

// Initialize the video.js player
function initializeVideoPlayer(sessionId, filename) {
    if (videoPlayer) {
        videoPlayer.dispose();
    }
    
    const videoUrl = `/video/${sessionId}/${filename}`;
    
    // Determine the video type from the filename
    let videoType = 'video/mp4'; // Default
    const extension = filename.split('.').pop().toLowerCase();
    
    if (extension === 'webm') {
        videoType = 'video/webm';
    } else if (extension === 'avi') {
        videoType = 'video/x-msvideo';
    } else if (extension === 'mov') {
        videoType = 'video/quicktime';
    } else if (extension === 'mkv') {
        videoType = 'video/x-matroska';
    }
    
    videoPlayer = videojs('videoPlayer', {
        controls: true,
        preload: 'auto',
        fluid: true,
        playbackRates: [0.5, 1, 1.5, 2],
        sources: [{
            src: videoUrl,
            type: videoType
        }]
    });
    
    // After video loads, initialize the zone drawer
    videoPlayer.on('loadedmetadata', function() {
        // Initialize zone drawer with video dimensions
        initializeZoneDrawer(videoPlayer.videoWidth(), videoPlayer.videoHeight());
        
        // Enable analyze button once video is loaded
        analyzeBtn.disabled = false;
    });
    
    // Add event handler for analyze button
    analyzeBtn.addEventListener('click', analyzeVideo);
}

// Function to send the zones to the server for analysis
function analyzeVideo() {
    // Get zones from the zone drawer
    const zones = getZones();
    
    if (zones.length === 0) {
        alert('Please draw at least one zone before analyzing.');
        return;
    }
    
    // Disable analyze button and show progress
    analyzeBtn.disabled = true;
    analysisProgress.classList.remove('d-none');
    
    // Send zones to the server for analysis
    fetch('/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zones: zones })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Process results
            displayResults(data.results);
        } else {
            alert('Analysis failed: ' + data.error);
        }
        
        // Hide progress and re-enable analyze button
        analysisProgress.classList.add('d-none');
        analyzeBtn.disabled = false;
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred during analysis. Please try again.');
        
        // Hide progress and re-enable analyze button
        analysisProgress.classList.add('d-none');
        analyzeBtn.disabled = false;
    });
}

// Function to display the analysis results
function displayResults(results) {
    // Show timeline and results containers
    timelineEmpty.classList.add('d-none');
    timelineContainer.classList.remove('d-none');
    resultsContainer.classList.remove('d-none');
    
    // Display result statistics
    const totalDetections = results.detections.length;
    resultsStats.innerHTML = `
        <h5><i class="fas fa-chart-bar me-2"></i>Detection Statistics</h5>
        <p>Total Movement Detections: <strong>${totalDetections}</strong></p>
        <p>Video Duration: <strong>${formatTime(videoInfo.duration)}</strong></p>
        <p>Frames Analyzed: <strong>${results.frames_analyzed}</strong></p>
    `;
    
    // Clear previous results
    timelineList.innerHTML = '';
    resultsFrames.innerHTML = '';
    
    // Sort detections by timestamp
    const sortedDetections = results.detections.sort((a, b) => a.timestamp - b.timestamp);
    
    // Populate timeline
    sortedDetections.forEach((detection, index) => {
        const formattedTime = formatTime(detection.timestamp);
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action timeline-item';
        listItem.dataset.frameId = detection.frame_id;
        listItem.dataset.timestamp = detection.timestamp;
        
        listItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1"><i class="fas fa-user me-2"></i>Human Detected</h6>
                <small class="text-muted">${formattedTime}</small>
            </div>
            <p class="mb-1">Zone: <span class="badge bg-secondary">${detection.zone_id}</span> Confidence: <span class="badge bg-info">${Math.round(detection.confidence * 100)}%</span></p>
        `;
        
        // Add click event to seek to this time in the video
        listItem.addEventListener('click', function(e) {
            e.preventDefault();
            videoPlayer.currentTime(detection.timestamp);
            
            // Highlight the current item
            document.querySelectorAll('.timeline-item').forEach(item => {
                item.classList.remove('active');
            });
            this.classList.add('active');
            
            // Scroll to the corresponding detection frame
            const frameElement = document.querySelector(`.detection-frame[data-frame-id="${detection.frame_id}"]`);
            if (frameElement) {
                frameElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        
        timelineList.appendChild(listItem);
        
        // Add detection frame to gallery
        const frameElement = document.createElement('div');
        frameElement.className = 'col detection-frame';
        frameElement.dataset.frameId = detection.frame_id;
        frameElement.dataset.timestamp = detection.timestamp;
        
        frameElement.innerHTML = `
            <div class="card h-100">
                <img src="/frame/${sessionId}/${detection.frame_id}" class="card-img-top" alt="Detection Frame">
                <div class="card-body">
                    <h6 class="card-title">Detection at ${formattedTime}</h6>
                    <p class="card-text">Zone: ${detection.zone_id} | Confidence: ${Math.round(detection.confidence * 100)}%</p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-sm btn-primary view-detection-btn">View in Video</button>
                </div>
            </div>
        `;
        
        // Add click event to view detection button
        frameElement.querySelector('.view-detection-btn').addEventListener('click', function() {
            videoPlayer.currentTime(detection.timestamp);
            
            // Highlight the corresponding timeline item
            document.querySelectorAll('.timeline-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`.timeline-item[data-frame-id="${detection.frame_id}"]`).classList.add('active');
        });
        
        resultsFrames.appendChild(frameElement);
    });
    
    // If no detections found
    if (sortedDetections.length === 0) {
        timelineList.innerHTML = `
            <div class="list-group-item text-center py-3">
                <i class="fas fa-exclamation-circle text-warning fs-4 mb-2"></i>
                <p class="mb-0">No human movement detected in the defined zones.</p>
            </div>
        `;
        
        resultsFrames.innerHTML = `
            <div class="col-12 text-center py-4">
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No human movement detected in any of the defined zones.
                </div>
                <p>Try adjusting your zones or using a different video.</p>
            </div>
        `;
    }
    
    // Create detection timeline visualization
    createTimelineVisualization(sortedDetections);
}

// Helper function to format seconds to MM:SS or HH:MM:SS
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

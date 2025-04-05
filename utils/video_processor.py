import os
import cv2
import numpy as np
import time
import logging
from .yolo_detector import initialize_model, detect_humans, draw_detection_overlay

logger = logging.getLogger(__name__)

def get_video_info(video_path):
    """
    Extract basic information from a video file.
    
    Args:
        video_path (str): Path to the video file
        
    Returns:
        dict: Video information including width, height, fps, duration, etc.
    """
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Could not open video: {video_path}")
            return None
            
        # Get video properties
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Calculate duration in seconds
        duration = frame_count / fps if fps > 0 else 0
        
        cap.release()
        
        return {
            'width': int(width),
            'height': int(height),
            'fps': float(fps),
            'frame_count': int(frame_count),
            'duration': float(duration)
        }
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        return None

def normalize_polygon(polygon, width, height):
    """
    Convert normalized polygon coordinates (0-1) to pixel coordinates.
    
    Args:
        polygon (list): List of points with normalized coordinates
        width (int): Video width
        height (int): Video height
        
    Returns:
        list: List of points with pixel coordinates
    """
    return [
        (int(point['x'] * width), int(point['y'] * height))
        for point in polygon
    ]

def point_in_polygon(point, polygon):
    """
    Check if a point is inside a polygon using ray casting algorithm.
    
    Args:
        point (tuple): Point to check (x, y)
        polygon (list): List of points defining the polygon [(x1, y1), (x2, y2), ...]
        
    Returns:
        bool: True if point is inside polygon, False otherwise
    """
    x, y = point
    n = len(polygon)
    inside = False
    
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    x_intersect = p1x  # Default value
                    if p1y != p2y:
                        x_intersect = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= x_intersect:
                        inside = not inside
        p1x, p1y = p2x, p2y
    
    return inside

def process_video(video_path, output_dir):
    """
    Process a video file for human detection across the entire frame.
    
    Args:
        video_path (str): Path to the video file
        output_dir (str): Directory to save detection frames
        
    Returns:
        dict: Detection results including timestamps, etc.
    """
    # Initialize model
    model = initialize_model()
    
    # Open the video file
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"Could not open video: {video_path}")
        return {
            'error': 'Could not open video file',
            'detections': [],
            'frames_analyzed': 0
        }
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Initialize variables
    detections = []
    frame_idx = 0
    frames_processed = 0
    
    # Calculate frame sampling rate based on video length
    video_duration = frame_count / fps if fps > 0 else 0
    
    # Fixed 10 frames per second sampling rate
    if fps > 10:
        sampling_rate = max(1, int(fps / 10))  # Process 10 frames per second 
    else:
        sampling_rate = 1  # If video is already less than 10 fps, process every frame
        
    sampling_rate = max(1, sampling_rate)  # Ensure at least 1
    
    logger.info(f"Video duration: {format_timestamp(video_duration)}, sampling rate: 1 frame every {sampling_rate} frames")
    
    # Process the video
    start_time = time.time()
    last_progress_print = 0
    
    try:
        while cap.isOpened():
            # Read a frame
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_idx += 1
            
            # Skip frames based on sampling rate
            if frame_idx % sampling_rate != 0:
                continue
            
            # Progress update
            if time.time() - last_progress_print >= 5:  # Update every 5 seconds
                progress = (frame_idx / frame_count) * 100
                logger.info(f"Processing: {progress:.1f}% complete ({frame_idx}/{frame_count} frames)")
                last_progress_print = time.time()
            
            frames_processed += 1
            
            # Detect humans in the frame
            detection_results = detect_humans(model, frame)
            
            # Process each detection
            for detection in detection_results:
                # Calculate timestamp
                timestamp = frame_idx / fps
                
                # Create a unique frame ID
                frame_id = f"{int(timestamp)}_{len(detections)}"
                
                # Draw the detection on the frame
                frame_copy = frame.copy()
                
                # Draw detection box
                x1, y1, x2, y2 = detection['box']
                cv2.rectangle(frame_copy, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                # Add label with confidence
                confidence_text = f"Person: {detection['confidence']:.2f}"
                cv2.putText(frame_copy, confidence_text, (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                # Add timestamp
                timestamp_text = f"Time: {format_timestamp(timestamp)}"
                cv2.putText(frame_copy, timestamp_text, (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                
                # Save the detection frame
                cv2.imwrite(os.path.join(output_dir, f"frame_{frame_id}.jpg"), 
                            frame_copy)
                
                # Add to detections list - convert numpy types to native Python types for JSON serialization
                detections.append({
                    'frame_id': str(frame_id),
                    'timestamp': float(timestamp),
                    'confidence': float(detection['confidence']),
                    'box': [int(b) for b in detection['box']]
                })
            
        # Release the video capture
        cap.release()
        
        # Processing complete
        processing_time = time.time() - start_time
        logger.info(f"Video processing complete. Processed {frames_processed} frames in {processing_time:.2f} seconds")
        logger.info(f"Found {len(detections)} human movement detections in the zones")
        
        return {
            'detections': detections,
            'frames_analyzed': int(frames_processed),
            'processing_time': float(processing_time)
        }
        
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        cap.release()
        return {
            'error': f"Error processing video: {str(e)}",
            'detections': [],
            'frames_analyzed': int(frames_processed)
        }

def format_timestamp(seconds):
    """Format seconds to HH:MM:SS format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes:02d}:{seconds:02d}"

def hex_to_rgb(hex_color, alpha=1.0):
    """Convert hex color string to RGB tuple"""
    # Remove # if present
    hex_color = hex_color.lstrip('#')
    
    # Convert to RGB
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    
    if alpha < 1.0:
        return (r, g, b, int(alpha * 255))
    else:
        return (r, g, b)

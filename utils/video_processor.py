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
            'width': width,
            'height': height,
            'fps': fps,
            'frame_count': frame_count,
            'duration': duration
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

def process_video(video_path, zones, output_dir):
    """
    Process a video file for human detection within specific zones.
    
    Args:
        video_path (str): Path to the video file
        zones (list): List of zones, each with a list of points defining a polygon
        output_dir (str): Directory to save detection frames
        
    Returns:
        dict: Detection results including timestamps, zones, etc.
    """
    # Initialize YOLO model
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
    
    # Convert normalized zone coordinates to pixel coordinates
    pixel_zones = []
    for zone in zones:
        pixel_zones.append({
            'id': zone['id'],
            'color': zone['color'],
            'points': normalize_polygon(zone['points'], width, height)
        })
    
    # Calculate frame sampling rate based on video length
    # Process more frames for shorter videos, fewer for longer videos
    sampling_rate = max(1, int(fps / 2))  # Process at most 2 frames per second
    
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
            
            # Check if any detections are inside the defined zones
            for detection in detection_results:
                # Get the center point of the detection box
                cx = int((detection['box'][0] + detection['box'][2]) / 2)
                cy = int((detection['box'][1] + detection['box'][3]) / 2)
                
                # Check each zone
                for zone in pixel_zones:
                    if point_in_polygon((cx, cy), zone['points']):
                        # Calculate timestamp
                        timestamp = frame_idx / fps
                        
                        # Create a unique frame ID
                        frame_id = f"{int(timestamp)}_{len(detections)}"
                        
                        # Draw the detection and zone on the frame
                        frame_copy = frame.copy()
                        
                        # Draw zone
                        zone_points = np.array(zone['points'], np.int32)
                        cv2.polylines(frame_copy, [zone_points], True, 
                                    hex_to_rgb(zone['color']), 2)
                        
                        # Fill zone with semi-transparent color
                        overlay = frame_copy.copy()
                        cv2.fillPoly(overlay, [zone_points], 
                                    hex_to_rgb(zone['color'], alpha=0.3))
                        cv2.addWeighted(overlay, 0.3, frame_copy, 0.7, 0, frame_copy)
                        
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
                        
                        # Add to detections list
                        detections.append({
                            'frame_id': frame_id,
                            'timestamp': timestamp,
                            'zone_id': zone['id'],
                            'confidence': detection['confidence'],
                            'box': detection['box']
                        })
                        
                        # Only count each detection in one zone (the first it matches)
                        break
            
        # Release the video capture
        cap.release()
        
        # Processing complete
        processing_time = time.time() - start_time
        logger.info(f"Video processing complete. Processed {frames_processed} frames in {processing_time:.2f} seconds")
        logger.info(f"Found {len(detections)} human movement detections in the zones")
        
        return {
            'detections': detections,
            'frames_analyzed': frames_processed,
            'processing_time': processing_time
        }
        
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        cap.release()
        return {
            'error': f"Error processing video: {str(e)}",
            'detections': [],
            'frames_analyzed': frames_processed
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

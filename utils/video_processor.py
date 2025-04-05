import os
import cv2
import numpy as np
import time
import logging
from utils.yolo_detector import initialize_model, detect_humans, draw_detection_overlay

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

import os
import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

def initialize_model():
    """
    Initialize and return the OpenCV-based HOG+SVM model for person detection.
    
    Returns:
        HOGDescriptor: The initialized model
    """
    try:
        # Initialize HOG Descriptor with SVM model for people detection
        hog = cv2.HOGDescriptor()
        hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        logger.info("HOG+SVM person detector initialized successfully")
        return hog
    except Exception as e:
        logger.error(f"Error initializing HOG+SVM detector: {str(e)}")
        raise

def detect_humans(model, frame, conf_threshold=0.40):
    """
    Detect humans in a frame using the HOG+SVM model.
    
    Args:
        model: The HOG detector model
        frame (numpy.ndarray): The image frame to process
        conf_threshold (float): Confidence threshold for detections
        
    Returns:
        list: List of human detections with bounding boxes and confidence scores
    """
    try:
        # Resize the frame for better detection and performance
        height, width = frame.shape[:2]
        
        # If the frame is too large, resize it (max width of 800px)
        if width > 800:
            scale = 800 / width
            frame = cv2.resize(frame, (int(width * scale), int(height * scale)))
            height, width = frame.shape[:2]
        
        # Run HOG detection
        boxes, weights = model.detectMultiScale(
            frame, 
            winStride=(8, 8),
            padding=(16, 16),
            scale=1.05,
            finalThreshold=conf_threshold * 2
        )
        
        # Process results
        detections = []
        
        for i, (x, y, w, h) in enumerate(boxes):
            confidence = float(weights[i])
            
            # Filter by confidence threshold
            if confidence >= conf_threshold:
                # Convert to x1, y1, x2, y2 format
                x1, y1, x2, y2 = x, y, x + w, y + h
                
                # If we resized the frame, scale the coordinates back
                if width != 800 and width > 800:
                    scale = width / 800
                    x1, y1, x2, y2 = int(x1 * scale), int(y1 * scale), int(x2 * scale), int(y2 * scale)
                
                # Add to detections
                detections.append({
                    'box': [x1, y1, x2, y2],
                    'confidence': confidence
                })
        
        return detections
    
    except Exception as e:
        logger.error(f"Error detecting humans with HOG+SVM: {str(e)}")
        return []

def draw_detection_overlay(frame, detections, color=(0, 255, 0)):
    """
    Draw detection boxes and labels on a frame.
    
    Args:
        frame (numpy.ndarray): The image frame to draw on
        detections (list): List of detection dictionaries
        color (tuple): BGR color for the boxes
        
    Returns:
        numpy.ndarray: Frame with detections drawn
    """
    result = frame.copy()
    
    for detection in detections:
        x1, y1, x2, y2 = detection['box']
        conf = detection['confidence']
        
        # Draw bounding box
        cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)
        
        # Draw label with confidence
        label = f"Person: {conf:.2f}"
        cv2.putText(result, label, (x1, y1 - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    
    return result

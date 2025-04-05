import os
import cv2
import numpy as np
import logging
import torch

logger = logging.getLogger(__name__)

def initialize_model():
    """
    Initialize and return the YOLOv8 model for object detection.
    
    Returns:
        torch.nn.Module: The initialized YOLOv8 model
    """
    try:
        # Load YOLOv8 model from torch hub
        model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
        
        # Set model to evaluation mode and move to CPU/GPU as appropriate
        model.eval()
        if torch.cuda.is_available():
            model = model.cuda()
        else:
            model = model.cpu()
            
        logger.info("YOLOv8 model initialized successfully")
        return model
    except Exception as e:
        logger.error(f"Error initializing YOLOv8 detector: {str(e)}")
        raise

def detect_humans(model, frame, conf_threshold=0.25):
    """
    Detect humans in a frame using the YOLOv8 model.
    
    Args:
        model: The YOLOv8 model
        frame (numpy.ndarray): The image frame to process
        conf_threshold (float): Confidence threshold for detections
        
    Returns:
        list: List of human detections with bounding boxes and confidence scores
    """
    try:
        # YOLOv5 expects RGB images, convert from BGR if needed
        if frame.shape[2] == 3:  # Check if it's a color image
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        else:
            rgb_frame = frame
            
        # Perform inference
        results = model(rgb_frame)
        
        # Extract person detections (class 0 in COCO dataset)
        person_detections = []
        predictions = results.xyxy[0]  # Predictions in xyxy format
        
        for pred in predictions:
            x1, y1, x2, y2, conf, cls = pred.tolist()
            class_id = int(cls)
            
            # Filter for person class (0) and confidence threshold
            if class_id == 0 and conf >= conf_threshold:
                # Add detection to results
                person_detections.append({
                    'box': [int(x1), int(y1), int(x2), int(y2)],
                    'confidence': float(conf)
                })
        
        return person_detections
    
    except Exception as e:
        logger.error(f"Error detecting humans with YOLOv8: {str(e)}")
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

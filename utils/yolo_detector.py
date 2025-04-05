import cv2
from ultralytics import YOLO

# Load YOLOv8 model once
_model = YOLO("yolov8n.pt")  # Or use a path to a custom trained model if needed


def initialize_model():
    return _model


def detect_humans(model, frame, polygon=None, conf_threshold=0.50):
    """
    Detect humans in the frame using YOLOv8.

    Args:
        model: YOLOv8 model object.
        frame: Frame from the video (np.ndarray).
        polygon: Optional list of (x, y) tuples defining ROI.
        conf_threshold: Confidence threshold for detection.

    Returns:
        List of detection dicts with 'box' and 'confidence'.
    """
    results = model(frame, classes=[0], verbose=False)  # Class 0 is 'person'
    detections = []

    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            confidence = float(box.conf[0])

            if confidence < conf_threshold:
                continue

            # Check ROI polygon inclusion if provided
            if polygon:
                # Use center point of box for ROI check
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                if not point_in_polygon((cx, cy), polygon):
                    continue

            detections.append({
                'box': [x1, y1, x2, y2],
                'confidence': confidence
            })

    return detections


def point_in_polygon(point, polygon):
    x, y = point
    n = len(polygon)
    inside = False

    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    x_intersect = p1x
                    if p1y != p2y:
                        x_intersect = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= x_intersect:
                        inside = not inside
        p1x, p1y = p2x, p2y

    return inside


def draw_detection_overlay(frame, detections, color=(0, 255, 0)):
    """
    Draw bounding boxes and confidence scores for detections on the frame.

    Args:
        frame (np.ndarray): The image frame to annotate.
        detections (list): List of detection dicts, each with 'box' and 'confidence'.
        color (tuple): BGR color for drawing boxes.

    Returns:
        np.ndarray: Annotated frame with overlays.
    """
    result = frame.copy()

    for detection in detections:
        x1, y1, x2, y2 = detection['box']
        conf = detection['confidence']

        # Draw bounding box
        cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)

        # Label with confidence
        label = f"Person: {conf:.2f}"
        cv2.putText(result, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    return result

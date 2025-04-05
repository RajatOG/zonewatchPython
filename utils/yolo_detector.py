import cv2
from ultralytics import YOLO

# Load YOLOv8 model once
_model = YOLO("yolov8n.pt")  # Or use a path to a custom trained model if needed


def initialize_model():
    return _model


def detect_humans(model, frame, roi_box=None, conf_threshold=0.50):
    """
    Detect humans in the frame using YOLOv8 and filter by ROI box if provided.

    Args:
        model: YOLOv8 model.
        frame: Frame from the video.
        roi_box: Optional static ROI (x1, y1, x2, y2) in pixels.
        conf_threshold: Minimum confidence score.

    Returns:
        List of detections (box + confidence).
    """
    results = model(frame, classes=[0], verbose=False)  # 0 = person
    detections = []

    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            confidence = float(box.conf[0])

            if confidence < conf_threshold:
                continue

            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2  # center of box

            # Filter by rectangular ROI if given
            if roi_box:
                rx1, ry1, rx2, ry2 = roi_box
                if not (rx1 <= cx <= rx2 and ry1 <= cy <= ry2):
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

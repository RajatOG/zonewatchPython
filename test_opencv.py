import cv2
import numpy as np

print("OpenCV version:", cv2.__version__)

# Test if HOG descriptor works
try:
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    print("HOG+SVM detector initialized successfully")
    
    # Create a simple test image
    test_img = np.zeros((300, 300, 3), dtype=np.uint8)
    
    # Try detection on empty image (should return empty results, but not error)
    boxes, weights = hog.detectMultiScale(test_img)
    print(f"Detection test: Found {len(boxes)} people (expected 0)")
    
    print("All OpenCV tests passed successfully")
except Exception as e:
    print(f"Error during OpenCV test: {str(e)}")
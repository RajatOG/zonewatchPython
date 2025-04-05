import os
import logging
import base64
import numpy as np
import cv2
from flask import Flask, render_template, request, jsonify, session, send_from_directory
import uuid
import time
from werkzeug.utils import secure_filename
import tempfile
import shutil
from utils.video_processor import process_video, get_video_info

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "zonewatchsecretkey")

# Configure upload folder
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'zonewatch_uploads')
RESULTS_FOLDER = os.path.join(tempfile.gettempdir(), 'zonewatch_results')
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}

# Create required directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# Helper functions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file in request'}), 400
    
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({'error': 'No video selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    # Generate a unique ID for the session
    session_id = str(uuid.uuid4())
    session['session_id'] = session_id
    
    # Create directory for this session
    session_dir = os.path.join(UPLOAD_FOLDER, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Save the file
    filename = secure_filename(file.filename)
    file_path = os.path.join(session_dir, filename)
    file.save(file_path)
    
    # Get video info
    video_info = get_video_info(file_path)
    session['video_path'] = file_path
    session['video_info'] = video_info
    
    return jsonify({
        'success': True,
        'session_id': session_id,
        'filename': filename,
        'video_info': video_info
    })

@app.route('/video/<session_id>/<filename>')
def serve_video(session_id, filename):
    session_dir = os.path.join(UPLOAD_FOLDER, session_id)
    secure_name = secure_filename(filename)
    response = send_from_directory(session_dir, secure_name)
    
    # Set the correct content type based on the file extension
    ext = os.path.splitext(secure_name)[1].lower()
    if ext == '.mp4':
        response.headers['Content-Type'] = 'video/mp4'
    elif ext == '.webm':
        response.headers['Content-Type'] = 'video/webm'
    elif ext == '.avi':
        response.headers['Content-Type'] = 'video/x-msvideo'
    elif ext == '.mov':
        response.headers['Content-Type'] = 'video/quicktime'
    elif ext == '.mkv':
        response.headers['Content-Type'] = 'video/x-matroska'
    
    return response

@app.route('/analyze', methods=['POST'])
def analyze_video():
    if 'session_id' not in session:
        return jsonify({'error': 'No active session. Please upload a video first.'}), 400
    
    video_path = session.get('video_path')
    if not video_path or not os.path.exists(video_path):
        return jsonify({'error': 'Video not found'}), 404
    
    session_id = session.get('session_id')
    results_dir = os.path.join(RESULTS_FOLDER, session_id)
    os.makedirs(results_dir, exist_ok=True)
    
    try:
        # Process the video for full frame analysis
        # This is a long-running task, in a production app you might want to use a task queue
        results = process_video(video_path, results_dir)
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        logging.error(f"Error processing video: {str(e)}")
        return jsonify({'error': f'Error processing video: {str(e)}'}), 500

@app.route('/frame/<session_id>/<frame_id>')
def serve_frame(session_id, frame_id):
    results_dir = os.path.join(RESULTS_FOLDER, session_id)
    return send_from_directory(results_dir, f"frame_{frame_id}.jpg")

@app.route('/detect-frame', methods=['POST'])
def detect_frame():
    """Process a single video frame for real-time detection."""
    if not request.json or 'frame_data' not in request.json:
        return jsonify({'error': 'No frame data provided'}), 400
    
    try:
        # Decode base64 image
        frame_data = request.json['frame_data'].split(',')[1]
        frame_bytes = base64.b64decode(frame_data)
        
        # Convert to numpy array
        frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
        frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Could not decode frame'}), 400
        
        # Initialize model if needed
        from utils.yolo_detector import initialize_model, detect_humans, draw_detection_overlay
        model = initialize_model()
        
        # Detect humans in the frame
        detections = detect_humans(model, frame)
        
        # Draw detections on frame
        result_frame = draw_detection_overlay(frame, detections)
        
        # Convert result back to base64
        _, buffer = cv2.imencode('.jpg', result_frame)
        result_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'result_frame': f"data:image/jpeg;base64,{result_base64}",
            'detections': detections
        })
    
    except Exception as e:
        logging.error(f"Error processing frame: {str(e)}")
        return jsonify({'error': f'Error processing frame: {str(e)}'}), 500

# Handle cleanup when the server starts
# Using @app.before_first_request is deprecated in Flask 2.x+
def cleanup_temp_files():
    # Clean up old temporary files
    try:
        for folder in [UPLOAD_FOLDER, RESULTS_FOLDER]:
            if os.path.exists(folder):
                for item in os.listdir(folder):
                    item_path = os.path.join(folder, item)
                    if os.path.isdir(item_path):
                        # Delete folders older than 24 hours
                        if time.time() - os.path.getmtime(item_path) > 86400:
                            shutil.rmtree(item_path, ignore_errors=True)
    except Exception as e:
        logging.error(f"Error cleaning up temp files: {str(e)}")

# Register cleanup as a before-app-serving function
with app.app_context():
    cleanup_temp_files()

# Error handlers
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large'}), 413

@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({'error': 'Internal server error'}), 500

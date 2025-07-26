from flask import Flask, render_template, request, jsonify, send_file
import os
import datetime
from werkzeug.utils import secure_filename
import io
import base64

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = '/tmp/recordings'  # Use /tmp for Vercel
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure recordings directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if file:
            filename = secure_filename(file.filename)
            timestamp = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
            new_filename = f"uploaded_{timestamp}_{filename}"
            
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
            file.save(file_path)
            
            return jsonify({
                'success': True,
                'filename': new_filename,
                'message': f'File uploaded successfully as {new_filename}'
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save-recording', methods=['POST'])
def save_recording():
    try:
        data = request.get_json()
        if not data or 'audio_data' not in data:
            return jsonify({'error': 'No audio data received'}), 400
        
        # Decode base64 audio data
        audio_data = base64.b64decode(data['audio_data'].split(',')[1])
        
        timestamp = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"recorded_{timestamp}.wav"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        with open(file_path, 'wb') as f:
            f.write(audio_data)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'message': f'Recording saved as {filename}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/recordings')
def list_recordings():
    try:
        recordings = []
        if os.path.exists(app.config['UPLOAD_FOLDER']):
            for filename in os.listdir(app.config['UPLOAD_FOLDER']):
                if filename.endswith(('.wav', '.mp3')):
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    recordings.append({
                        'filename': filename,
                        'size': os.path.getsize(file_path),
                        'created': datetime.datetime.fromtimestamp(os.path.getctime(file_path)).strftime('%Y-%m-%d %H:%M:%S'),
                        'type': 'recorded' if filename.startswith('recorded_') else 'uploaded'
                    })
        return jsonify(recordings)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True, download_name=filename)
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

# For Vercel deployment
if __name__ == '__main__':
    app.run(debug=True) 
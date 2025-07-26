from flask import Flask, render_template, request, jsonify, send_file
import os
import datetime
from werkzeug.utils import secure_filename
import io

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'recordings'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure recordings directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
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

@app.route('/recordings')
def list_recordings():
    recordings = []
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            if filename.endswith(('.wav', '.mp3')):
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                recordings.append({
                    'filename': filename,
                    'size': os.path.getsize(file_path),
                    'created': datetime.datetime.fromtimestamp(os.path.getctime(file_path)).strftime('%Y-%m-%d %H:%M:%S')
                })
    return jsonify(recordings)

if __name__ == '__main__':
    app.run(debug=True) 
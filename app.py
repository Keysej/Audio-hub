from flask import Flask, request, jsonify, render_template_string
import datetime
import base64
import os

app = Flask(__name__)

# HTML template for the voice journaling interface
JOURNAL_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reflective Voice Journaling - Audio Hub</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            color: #2c3e50;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 10px;
        }
        .subtitle {
            text-align: center;
            color: #7f8c8d;
            margin-bottom: 40px;
        }
        .section {
            margin-bottom: 40px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 15px;
            border-left: 4px solid #3498db;
        }
        .upload-area {
            border: 2px dashed #3498db;
            border-radius: 10px;
            padding: 40px;
            text-align: center;
            margin: 20px 0;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .upload-area:hover {
            background: #e8f4fd;
            border-color: #2980b9;
        }
        .btn {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
        }
        .record-btn {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 20px auto;
            font-size: 1.5em;
        }
        .status {
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            border-radius: 10px;
        }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎙️ Reflective Voice Journaling</h1>
        <p class="subtitle">Record or upload your voice and reflect on your day</p>
        
        <div class="section">
            <h2>🎤 Record Your Voice</h2>
            <div style="text-align: center;">
                <button class="record-btn" id="recordBtn" onclick="toggleRecording()">
                    <span id="recordIcon">🎤</span>
                </button>
                <div id="recordingStatus"></div>
                <audio id="audioPlayback" controls style="display: none; margin-top: 20px;"></audio>
            </div>
        </div>
        
        <div class="section">
            <h2>📁 Upload Audio File</h2>
            <div class="upload-area" onclick="document.getElementById('audioFile').click()">
                <input type="file" id="audioFile" accept="audio/*" style="display: none;" onchange="handleFileUpload(this)">
                <p>Click to select an audio file (.wav, .mp3, .m4a)</p>
                <p style="color: #7f8c8d; font-size: 0.9em;">Or drag and drop your audio file here</p>
            </div>
            <div id="uploadStatus"></div>
        </div>
    </div>

    <script>
        let mediaRecorder;
        let audioChunks = [];
        let isRecording = false;

        async function toggleRecording() {
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    
                    mediaRecorder.ondataavailable = event => {
                        audioChunks.push(event.data);
                    };
                    
                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        
                        const audioPlayback = document.getElementById('audioPlayback');
                        audioPlayback.src = audioUrl;
                        audioPlayback.style.display = 'block';
                        
                        // Upload the recording
                        await uploadAudio(audioBlob, 'recorded');
                    };
                    
                    mediaRecorder.start();
                    isRecording = true;
                    document.getElementById('recordIcon').textContent = '⏹️';
                    document.getElementById('recordingStatus').innerHTML = '<div class="status">🔴 Recording... Click to stop</div>';
                    
                } catch (error) {
                    document.getElementById('recordingStatus').innerHTML = '<div class="status error">❌ Could not access microphone</div>';
                }
            } else {
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                isRecording = false;
                document.getElementById('recordIcon').textContent = '🎤';
                document.getElementById('recordingStatus').innerHTML = '<div class="status">⏸️ Recording stopped</div>';
            }
        }

        async function handleFileUpload(input) {
            const file = input.files[0];
            if (file) {
                await uploadAudio(file, 'uploaded');
            }
        }

        async function uploadAudio(audioData, type) {
            const formData = new FormData();
            formData.append('audio', audioData);
            formData.append('type', type);
            
            try {
                const response = await fetch('/api/upload-audio', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    const statusElement = type === 'recorded' ? 'recordingStatus' : 'uploadStatus';
                    document.getElementById(statusElement).innerHTML = 
                        `<div class="status success">✅ ${result.message}</div>`;
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                const statusElement = type === 'recorded' ? 'recordingStatus' : 'uploadStatus';
                document.getElementById(statusElement).innerHTML = 
                    `<div class="status error">❌ Error: ${error.message}</div>`;
            }
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(JOURNAL_TEMPLATE)

@app.route('/api/upload-audio', methods=['POST'])
def upload_audio():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        audio_type = request.form.get('type', 'uploaded')
        
        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Generate filename
        timestamp = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"{audio_type}_{timestamp}_{audio_file.filename}"
        
        # In a serverless environment, we can't save files permanently
        # So we'll just acknowledge receipt
        file_size = len(audio_file.read())
        
        return jsonify({
            'message': f'Audio {audio_type} successfully! ({file_size} bytes)',
            'filename': filename,
            'type': audio_type,
            'timestamp': timestamp
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# For Vercel
def handler(request):
    return app(request.environ, lambda status, headers: None)

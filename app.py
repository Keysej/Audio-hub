from flask import Flask, request, jsonify, render_template_string
import datetime
import base64
import os
import json
import tempfile
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

app = Flask(__name__)

# File-based storage for Vercel serverless environment
STORAGE_FILE = '/tmp/sound_drops.json'

# MongoDB Configuration for Research Data Archive
# Replace with your actual MongoDB password
MONGODB_URI = "mongodb+srv://jimalekeyse:Singaboor12%40@sounddrop.5dkflfy.mongodb.net/"
MONGODB_DATABASE = "sounddrop_research"

# MongoDB client (will be initialized when needed)
mongo_client = None
research_db = None

def init_mongodb():
    """Initialize MongoDB connection for research data archiving"""
    global mongo_client, research_db
    try:
        if mongo_client is None:
            # You need to replace <db_password> with your actual password
            mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            # Test the connection
            mongo_client.admin.command('ping')
            research_db = mongo_client[MONGODB_DATABASE]
            print("MongoDB connection established for research archiving")
        return True
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return False

def archive_to_research_db(drop_data):
    """Archive sound drop to MongoDB for research purposes"""
    try:
        if init_mongodb():
            # Add research metadata
            research_record = {
                **drop_data,
                'archived_at': datetime.datetime.now().isoformat(),
                'research_status': 'active',
                'study_phase': 'diary_study_2024'
            }
            
            # Insert into research archive
            result = research_db.sound_drops_archive.insert_one(research_record)
            print(f"Archived drop {drop_data['id']} to research database: {result.inserted_id}")
            return True
    except Exception as e:
        print(f"Failed to archive to research database: {e}")
    return False

def load_sound_drops():
    """Load sound drops from file storage"""
    try:
        if os.path.exists(STORAGE_FILE):
            with open(STORAGE_FILE, 'r') as f:
                data = json.load(f)
                
                # Archive old drops to research database before filtering
                now = datetime.datetime.now().timestamp() * 1000
                expired_drops = [drop for drop in data if (now - drop['timestamp']) >= 24 * 60 * 60 * 1000]
                
                # Archive expired drops for research
                for drop in expired_drops:
                    archive_to_research_db(drop)
                
                # Return only valid (non-expired) drops for user interface
                valid_drops = [drop for drop in data if (now - drop['timestamp']) < 24 * 60 * 60 * 1000]
                return valid_drops
        return []
    except Exception as e:
        print(f"Error loading sound drops: {e}")
        return []

def save_sound_drops(drops):
    """Save sound drops to file storage"""
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(STORAGE_FILE), exist_ok=True)
        with open(STORAGE_FILE, 'w') as f:
            json.dump(drops, f)
        return True
    except Exception as e:
        print(f"Error saving sound drops: {e}")
        return False

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

@app.route('/api/status')
def api_status():
    """Simple status endpoint to check API health and data"""
    try:
        drops = load_sound_drops()
        return jsonify({
            'status': 'healthy',
            'drops_count': len(drops),
            'storage_file': STORAGE_FILE,
            'timestamp': datetime.datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.datetime.now().isoformat()
        }), 500

@app.route('/api/research/status')
def research_status():
    """Research endpoint to check archived data status"""
    try:
        if init_mongodb():
            # Count archived drops
            archived_count = research_db.sound_drops_archive.count_documents({})
            
            # Get recent archive activity
            recent_archives = list(research_db.sound_drops_archive.find(
                {}, 
                {'id': 1, 'archived_at': 1, 'theme': 1, 'type': 1}
            ).sort('archived_at', -1).limit(5))
            
            return jsonify({
                'status': 'connected',
                'archived_drops_count': archived_count,
                'recent_archives': recent_archives,
                'database': MONGODB_DATABASE,
                'timestamp': datetime.datetime.now().isoformat()
            })
        else:
            return jsonify({
                'status': 'mongodb_connection_failed',
                'message': 'Could not connect to research database',
                'timestamp': datetime.datetime.now().isoformat()
            }), 500
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.datetime.now().isoformat()
        }), 500

@app.route('/api/research/export')
def export_research_data():
    """Export archived research data (for analysis)"""
    try:
        if init_mongodb():
            # Get all archived data
            archived_data = list(research_db.sound_drops_archive.find(
                {},
                {'audioData': 0}  # Exclude large audio data from export, keep metadata
            ).sort('archived_at', -1))
            
            # Convert ObjectId to string for JSON serialization
            for item in archived_data:
                item['_id'] = str(item['_id'])
            
            return jsonify({
                'status': 'success',
                'data_count': len(archived_data),
                'archived_drops': archived_data,
                'export_timestamp': datetime.datetime.now().isoformat()
            })
        else:
            return jsonify({
                'status': 'mongodb_connection_failed',
                'message': 'Could not connect to research database'
            }), 500
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

# Helper function to get current theme
def get_current_theme():
    themes = [
        {
            "title": "Urban Soundscapes",
            "description": "Capture the sounds that define our urban environment. Street noise, construction, conversations, traffic, music bleeding from windows - what audio defines city life for you?"
        },
        {
            "title": "Emotional Sounds",
            "description": "What sounds trigger specific emotions? Record or share audio that makes you feel joy, sadness, comfort, anxiety, or nostalgia."
        },
        {
            "title": "Memory Triggers",
            "description": "Sounds that transport you to another time or place. Childhood memories, significant moments, or familiar environments."
        },
        {
            "title": "Workplace Audio",
            "description": "The soundtrack of productivity. Keyboard clicks, coffee machines, meeting room chatter, or the sounds that help you focus."
        },
        {
            "title": "Nature & Silence",
            "description": "Natural soundscapes and the spaces between sounds. Birds, water, wind, or the quality of different silences."
        },
        {
            "title": "Cultural Audio Markers",
            "description": "Sounds that represent culture, tradition, or community. Music, languages, celebrations, or rituals."
        },
        {
            "title": "Technological Sounds",
            "description": "The audio of our digital age. Notifications, startup sounds, dial tones, or the hum of devices."
        }
    ]
    
    today = datetime.datetime.now()
    day_of_year = today.timetuple().tm_yday
    return themes[day_of_year % len(themes)]

@app.route('/api/sound-drops', methods=['GET'])
def get_sound_drops():
    drops = load_sound_drops()
    return jsonify(drops)

@app.route('/api/sound-drops', methods=['POST'])
def create_sound_drop():
    try:
        data = request.get_json()
        
        if not data or 'audioData' not in data:
            return jsonify({'error': 'No audio data provided'}), 400
        
        # Create new sound drop
        current_theme = get_current_theme()
        drop = {
            'id': int(datetime.datetime.now().timestamp() * 1000),
            'timestamp': int(datetime.datetime.now().timestamp() * 1000),
            'theme': current_theme['title'],
            'audioData': data['audioData'],
            'context': data.get('context', ''),
            'type': data.get('type', 'recorded'),
            'filename': data.get('filename', f"recording_{int(datetime.datetime.now().timestamp())}"),
            'discussions': []
        }
        
        # Load existing drops and add new one
        drops = load_sound_drops()
        drops.insert(0, drop)
        
        # Save back to storage
        if save_sound_drops(drops):
            return jsonify({
                'message': 'Sound drop saved successfully!',
                'drop': drop
            })
        else:
            return jsonify({'error': 'Failed to save sound drop'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sound-drops/<int:drop_id>/discussion', methods=['POST'])
def add_discussion(drop_id):
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'No comment text provided'}), 400
        
        # Load drops and find the specific one
        drops = load_sound_drops()
        drop_index = next((i for i, d in enumerate(drops) if d['id'] == drop_id), None)
        
        if drop_index is None:
            return jsonify({'error': 'Sound drop not found'}), 404
        
        # Add comment
        comment = {
            'id': int(datetime.datetime.now().timestamp() * 1000),
            'timestamp': int(datetime.datetime.now().timestamp() * 1000),
            'text': data['text'],
            'author': data.get('author', 'Researcher')
        }
        
        drops[drop_index]['discussions'].append(comment)
        
        # Save back to storage
        if save_sound_drops(drops):
            return jsonify({
                'message': 'Comment added successfully!',
                'comment': comment
            })
        else:
            return jsonify({'error': 'Failed to save comment'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sound-drops/<int:drop_id>/discussion/<int:comment_id>', methods=['PUT'])
def edit_comment(drop_id, comment_id):
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'No comment text provided'}), 400
        
        drops = load_sound_drops()
        drop_index = next((i for i, d in enumerate(drops) if d['id'] == drop_id), None)
        if drop_index is None:
            return jsonify({'error': 'Sound drop not found'}), 404
        
        comment_index = next((i for i, c in enumerate(drops[drop_index]['discussions']) if c['id'] == comment_id), None)
        if comment_index is None:
            return jsonify({'error': 'Comment not found'}), 404
        
        # Update comment
        drops[drop_index]['discussions'][comment_index]['text'] = data['text']
        drops[drop_index]['discussions'][comment_index]['edited'] = True
        drops[drop_index]['discussions'][comment_index]['editedAt'] = int(datetime.datetime.now().timestamp() * 1000)
        
        if save_sound_drops(drops):
            return jsonify({
                'message': 'Comment updated successfully!',
                'comment': drops[drop_index]['discussions'][comment_index]
            })
        else:
            return jsonify({'error': 'Failed to update comment'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sound-drops/<int:drop_id>/discussion/<int:comment_id>', methods=['DELETE'])
def delete_comment(drop_id, comment_id):
    try:
        drops = load_sound_drops()
        drop_index = next((i for i, d in enumerate(drops) if d['id'] == drop_id), None)
        if drop_index is None:
            return jsonify({'error': 'Sound drop not found'}), 404
        
        comment_index = next((i for i, c in enumerate(drops[drop_index]['discussions']) if c['id'] == comment_id), None)
        if comment_index is None:
            return jsonify({'error': 'Comment not found'}), 404
        
        # Remove comment
        drops[drop_index]['discussions'].pop(comment_index)
        
        if save_sound_drops(drops):
            return jsonify({'message': 'Comment deleted successfully!'})
        else:
            return jsonify({'error': 'Failed to delete comment'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload-audio', methods=['POST'])
def upload_audio():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        audio_type = request.form.get('type', 'uploaded')
        
        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Convert audio file to base64 for storage
        audio_data = base64.b64encode(audio_file.read()).decode('utf-8')
        data_url = f"data:audio/wav;base64,{audio_data}"
        
        # Create sound drop
        current_theme = get_current_theme()
        drop = {
            'id': int(datetime.datetime.now().timestamp() * 1000),
            'timestamp': int(datetime.datetime.now().timestamp() * 1000),
            'theme': current_theme['title'],
            'audioData': data_url,
            'context': request.form.get('context', ''),
            'type': audio_type,
            'filename': audio_file.filename,
            'discussions': []
        }
        
        # Load existing drops and add new one
        drops = load_sound_drops()
        drops.insert(0, drop)
        
        # Save back to storage
        if save_sound_drops(drops):
            return jsonify({
                'message': f'Audio {audio_type} successfully!',
                'drop': drop
            })
        else:
            return jsonify({'error': 'Failed to save audio drop'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# For Vercel deployment
if __name__ == '__main__':
    app.run(debug=True)

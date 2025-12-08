from flask import Flask, jsonify
import datetime

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({'message': 'SoundDrop API', 'status': 'running', 'time': datetime.datetime.now().isoformat()})

@app.route('/api/test')
def test():
    return jsonify({'test': 'success', 'time': datetime.datetime.now().isoformat()})

if __name__ == '__main__':
    app.run()








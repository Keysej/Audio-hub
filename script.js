// SoundDrop - Ephemeral Sound Research Platform

// Daily themes rotation
const themes = [
  {
    title: "Urban Soundscapes",
    description: "Capture the sounds that define our urban environment. Street noise, construction, conversations, traffic, music bleeding from windows - what audio defines city life for you?"
  },
  {
    title: "Emotional Sounds",
    description: "What sounds trigger specific emotions? Record or share audio that makes you feel joy, sadness, comfort, anxiety, or nostalgia."
  },
  {
    title: "Memory Triggers",
    description: "Sounds that transport you to another time or place. Childhood memories, significant moments, or familiar environments."
  },
  {
    title: "Workplace Audio",
    description: "The soundtrack of productivity. Keyboard clicks, coffee machines, meeting room chatter, or the sounds that help you focus."
  },
  {
    title: "Nature & Silence",
    description: "Natural soundscapes and the spaces between sounds. Birds, water, wind, or the quality of different silences."
  },
  {
    title: "Cultural Audio Markers",
    description: "Sounds that represent culture, tradition, or community. Music, languages, celebrations, or rituals."
  },
  {
    title: "Technological Sounds",
    description: "The audio of our digital age. Notifications, startup sounds, dial tones, or the hum of devices."
  }
];

let mediaRecorder;
let audioChunks = [];
let recordingStartTime;
let recordingInterval;

// Get today's theme
function getTodaysTheme() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  return themes[dayOfYear % themes.length];
}

// Get sound drops from shared API with localStorage fallback
async function getSoundDrops() {
  try {
    console.log('Fetching sound drops from API...');
    const response = await fetch('/api/sound-drops');
    console.log('API response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Fetched sound drops:', data.length, 'drops');
      
      // Get local backup to merge with API data
      const localBackup = getLocalBackup();
      
      // Merge API data with local backup (API data takes precedence, but keep local-only items)
      const mergedData = mergeDrops(data, localBackup);
      
      // Store merged data as backup
      localStorage.setItem('soundDropsBackup', JSON.stringify(mergedData));
      return mergedData;
    } else {
      const errorText = await response.text();
      console.error('Failed to fetch sound drops:', response.status, errorText);
      return getLocalBackup();
    }
  } catch (error) {
    console.error('Error fetching sound drops:', error);
    return getLocalBackup();
  }
}

// Merge API drops with local backup drops
function mergeDrops(apiDrops, localDrops) {
  const merged = [...apiDrops];
  
  // Add local drops that aren't in API data
  localDrops.forEach(localDrop => {
    const existsInApi = apiDrops.some(apiDrop => apiDrop.id === localDrop.id);
    if (!existsInApi) {
      merged.push(localDrop);
    }
  });
  
  // Sort by timestamp (newest first)
  return merged.sort((a, b) => b.timestamp - a.timestamp);
}

// Get sound drops from localStorage backup
function getLocalBackup() {
  try {
    const stored = localStorage.getItem('soundDropsBackup');
  const drops = stored ? JSON.parse(stored) : [];
  
  // Filter out drops older than 24 hours
  const now = Date.now();
  const validDrops = drops.filter(drop => (now - drop.timestamp) < 24 * 60 * 60 * 1000);
  
    console.log('Using localStorage backup:', validDrops.length, 'drops');
  return validDrops;
  } catch (error) {
    console.error('Error reading localStorage backup:', error);
    return [];
  }
}

// Save sound drop to shared API
async function saveSoundDrop(audioBlob, context, type, filename) {
  console.log('Saving sound drop:', { type, filename, context });
  const reader = new FileReader();
  
  reader.onload = async function() {
    try {
      const dropData = {
        audioData: reader.result,
        context: context || '',
        type: type, // 'recorded' or 'uploaded'
        filename: filename || `recording_${Date.now()}`
      };
      
      console.log('Sending to API:', dropData);
      
      const response = await fetch('/api/sound-drops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dropData)
      });
      
      console.log('API response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Sound drop saved successfully:', result);
        
        // Add to localStorage backup immediately
        const backup = getLocalBackup();
        backup.unshift(result.drop);
        localStorage.setItem('soundDropsBackup', JSON.stringify(backup));
        
        const freshData = await getSoundDrops();
        renderSoundDropsFromData(freshData);
        updateStatsFromData(freshData);
      } else {
        const errorText = await response.text();
        console.error('Failed to save sound drop:', response.status, errorText);
        
        // Fallback: save to localStorage only
        console.log('Saving to localStorage as fallback');
    const drop = {
      id: Date.now(),
      timestamp: Date.now(),
      theme: getTodaysTheme().title,
      audioData: reader.result,
      context: context || '',
          type: type,
      filename: filename || `recording_${Date.now()}`,
      discussions: []
    };
    
        const backup = getLocalBackup();
        backup.unshift(drop);
        localStorage.setItem('soundDropsBackup', JSON.stringify(backup));
        
        const freshData = getLocalBackup();
        renderSoundDropsFromData(freshData);
        updateStatsFromData(freshData);
      }
    } catch (error) {
      console.error('Error saving sound drop:', error);
      
      // Network error fallback: save to localStorage only
      console.log('Network error - saving to localStorage as fallback');
    const drop = {
      id: Date.now(),
      timestamp: Date.now(),
      theme: getTodaysTheme().title,
      audioData: reader.result,
      context: context || '',
        type: type,
      filename: filename || `recording_${Date.now()}`,
      discussions: []
    };
    
      const backup = getLocalBackup();
      backup.unshift(drop);
      localStorage.setItem('soundDropsBackup', JSON.stringify(backup));
      
      await renderSoundDrops();
      await updateStats();
    }
  };
  
  reader.readAsDataURL(audioBlob);
}

// Render sound drops
async function renderSoundDrops(filter = 'all') {
  const container = document.getElementById('sound-drops');
  const drops = await getSoundDrops();
  renderSoundDropsFromData(drops, filter);
}

// Render sound drops from provided data
function renderSoundDropsFromData(drops, filter = 'all') {
  const container = document.getElementById('sound-drops');
  
  let filteredDrops = drops;
  if (filter === 'recorded') filteredDrops = drops.filter(d => d.type === 'recorded');
  if (filter === 'uploaded') filteredDrops = drops.filter(d => d.type === 'uploaded');
  if (filter === 'discussed') filteredDrops = drops.filter(d => d.discussions.length > 0);
  
  container.innerHTML = '';
  
  filteredDrops.forEach(drop => {
    const dropEl = document.createElement('div');
    dropEl.className = 'sound-drop';
    dropEl.innerHTML = `
      <div class="drop-header">
        <div class="drop-time">${formatTime(drop.timestamp)}</div>
        <div class="drop-type">${drop.type}</div>
      </div>
      ${drop.type === 'link' ? 
        `<div class="link-preview">
          <i class="fa-solid fa-external-link"></i>
          <a href="${drop.audioData}" target="_blank" rel="noopener">Open Audio Link</a>
        </div>` : 
        `<div class="waveform">🎵 Audio Waveform</div>
      <div class="drop-controls">
        <button class="play-btn" onclick="playAudio('${drop.id}')">
          <i class="fa-solid fa-play"></i>
        </button>
        <span>Theme: ${drop.theme}</span>
         </div>`
      }
      ${drop.context ? `<div class="drop-context">"${drop.context}"</div>` : ''}
      <div class="drop-actions">
        <button class="discuss-btn" onclick="openDiscussion('${drop.id}')">
          <i class="fa-solid fa-comment"></i> Discuss (${drop.discussions.length})
        </button>
        <button class="download-btn" onclick="downloadAudio('${drop.id}')">
          <i class="fa-solid fa-download"></i> Download
        </button>
      </div>
    `;
    container.appendChild(dropEl);
  });
}

// Format timestamp
function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  return `${minutes}m ago`;
}

// Update countdown timer
function updateCountdown() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const diff = tomorrow - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  document.getElementById('countdown-timer').textContent = 
    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Update stats
async function updateStats() {
  const drops = await getSoundDrops();
  updateStatsFromData(drops);
}

// Update stats from provided data
function updateStatsFromData(drops) {
  const totalDiscussions = drops.reduce((sum, drop) => sum + drop.discussions.length, 0);
  
  document.getElementById('drop-count').textContent = drops.length;
  document.getElementById('discussion-count').textContent = totalDiscussions;
}

// Start recording
async function startRecording() {
  try {
    // Enhanced audio constraints for better mobile compatibility
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Try different approaches for maximum compatibility
    let options = {};
    
    // First, try to force a more compatible format
    if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
      options.mimeType = 'audio/mp4;codecs=mp4a.40.2'; // AAC in MP4 - very compatible
    } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
      options.mimeType = 'audio/mpeg'; // MP3 if supported
    } else if (MediaRecorder.isTypeSupported('audio/wav')) {
      options.mimeType = 'audio/wav';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options.mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
      options.mimeType = 'audio/webm;codecs=pcm'; // PCM in WebM
    } else {
      // Last resort - use default (usually WebM/Opus)
      console.log('Using default MediaRecorder format - may need conversion');
    }
    
    console.log('Using MediaRecorder with MIME type:', options.mimeType || 'default');
    
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = event => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      // Use the same MIME type as the recorder for the blob
      const recordedMimeType = mediaRecorder.mimeType || 'audio/wav';
      const audioBlob = new Blob(audioChunks, { type: recordedMimeType });
      
      console.log('Recording completed with MIME type:', recordedMimeType);
      
      // Show save interface
      document.getElementById('share-drop-btn').style.display = 'block';
      document.getElementById('retake-btn').style.display = 'block';
      document.getElementById('audio-preview').style.display = 'block';
      
      // Set up audio preview
      const audioUrl = URL.createObjectURL(audioBlob);
      document.getElementById('preview-audio').src = audioUrl;
      
      document.getElementById('share-drop-btn').onclick = async () => {
        const context = document.getElementById('sound-context').value;
        await saveSoundDrop(audioBlob, context, 'recorded');
        hideRecordingSection();
      };
      
      document.getElementById('retake-btn').onclick = () => {
        // Reset for new recording
        document.getElementById('share-drop-btn').style.display = 'none';
        document.getElementById('retake-btn').style.display = 'none';
        document.getElementById('audio-preview').style.display = 'none';
        document.getElementById('record-btn').style.display = 'block';
        document.getElementById('recording-time').textContent = '00:00';
      };
    };
    
    mediaRecorder.start();
    recordingStartTime = Date.now();
    
    // Update UI
    document.getElementById('record-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'block';
    
    // Start timer
    recordingInterval = setInterval(updateRecordingTime, 1000);
    
  } catch (error) {
    console.error('Error accessing microphone:', error);
    
    // Provide more specific error messages for different scenarios
    let errorMessage = 'Could not access microphone. ';
    if (error.name === 'NotAllowedError') {
      errorMessage += 'Please allow microphone permissions and try again.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += 'No microphone found on this device.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage += 'Audio recording is not supported on this browser.';
    } else {
      errorMessage += 'Please check your microphone settings and try again.';
    }
    
    alert(errorMessage);
    
    // Reset UI on error
    document.getElementById('record-btn').style.display = 'block';
    document.getElementById('stop-btn').style.display = 'none';
    document.getElementById('recording-time').textContent = '00:00';
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    clearInterval(recordingInterval);
    
    // Update UI
    document.getElementById('record-btn').style.display = 'block';
    document.getElementById('stop-btn').style.display = 'none';
  }
}

// Update recording time display
function updateRecordingTime() {
  if (recordingStartTime) {
    const elapsed = Date.now() - recordingStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    document.getElementById('recording-time').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

// Show recording section
function showRecordingSection() {
  document.getElementById('recording-section').style.display = 'block';
  document.getElementById('recording-theme').textContent = getTodaysTheme().title;
}

// Hide recording section
function hideRecordingSection() {
  document.getElementById('recording-section').style.display = 'none';
  document.getElementById('sound-context').value = '';
  document.getElementById('share-drop-btn').style.display = 'none';
  document.getElementById('retake-btn').style.display = 'none';
  document.getElementById('audio-preview').style.display = 'none';
  document.getElementById('record-btn').style.display = 'block';
  document.getElementById('stop-btn').style.display = 'none';
  document.getElementById('recording-time').textContent = '00:00';
}

// Global audio player to control playback
let currentAudio = null;
let currentPlayButton = null;

// Play/pause audio with proper controls
async function playAudio(dropId) {
  const drops = await getSoundDrops();
  const drop = drops.find(d => d.id == dropId);
  const playButton = document.querySelector(`button[onclick="playAudio('${dropId}')"]`);
  
  if (!drop || !playButton) return;
  
  // If there's already audio playing, stop it first
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentPlayButton) {
      currentPlayButton.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
  }
  
  // If clicking the same button that's currently playing, just stop
  if (currentAudio && currentPlayButton === playButton && currentAudio.src === drop.audioData) {
    currentAudio = null;
    currentPlayButton = null;
    return;
  }
  
  // Create new audio and play
  currentAudio = new Audio(drop.audioData);
  currentPlayButton = playButton;
  
  // Update button to show pause icon
  playButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
  
  // Play the audio
  currentAudio.play().catch(error => {
    console.error('Error playing audio:', error);
    playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
  });
  
  // When audio ends, reset button
  currentAudio.addEventListener('ended', () => {
    playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
    currentAudio = null;
    currentPlayButton = null;
  });
  
  // Handle pause event
  currentAudio.addEventListener('pause', () => {
    playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
  });
}

// Convert audio to WAV format for better desktop compatibility
async function convertAudioToWav(audioBlob) {
  return new Promise((resolve, reject) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          const arrayBuffer = fileReader.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Convert to WAV
          const wavBlob = audioBufferToWav(audioBuffer);
          resolve(wavBlob);
        } catch (error) {
          console.log('Audio conversion failed, using original:', error);
          resolve(audioBlob); // Fallback to original
        }
      };
      
      fileReader.onerror = () => {
        console.log('FileReader error, using original audio');
        resolve(audioBlob); // Fallback to original
      };
      
      fileReader.readAsArrayBuffer(audioBlob);
    } catch (error) {
      console.log('Conversion not supported, using original:', error);
      resolve(audioBlob); // Fallback to original
    }
  });
}

// Convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer) {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);
  
  // Convert audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Simple and reliable audio download with better format detection
async function downloadAudio(dropId) {
  const drops = await getSoundDrops();
  const drop = drops.find(d => d.id == dropId);
  if (drop && drop.audioData) {
    try {
      const dataUrl = drop.audioData;
      const mimeMatch = dataUrl.match(/data:([^;]+);base64,/);
      let fileExtension = '.mp3'; // Default to MP3 for best compatibility
      let downloadUrl = dataUrl;
      
      if (mimeMatch) {
        const mimeType = mimeMatch[1];
        console.log('Original audio MIME type:', mimeType);
        
        // Always try to convert to MP3 for maximum desktop compatibility
        if (typeof AudioContext !== 'undefined') {
          try {
            console.log('Converting audio to MP3 for maximum desktop compatibility...');
            
            // Convert data URL back to blob
            const response = await fetch(dataUrl);
            const originalBlob = await response.blob();
            
            // Convert to MP3 using a simple approach
            const mp3Blob = await convertAudioToMp3(originalBlob);
            if (mp3Blob) {
              downloadUrl = URL.createObjectURL(mp3Blob);
              fileExtension = '.mp3';
              console.log('Successfully converted to MP3 format');
            } else {
              // Fallback to WAV
              const wavBlob = await convertAudioToWav(originalBlob);
              downloadUrl = URL.createObjectURL(wavBlob);
              fileExtension = '.wav';
              console.log('Converted to WAV format as fallback');
            }
          } catch (conversionError) {
            console.log('Conversion failed, using original format:', conversionError);
            // Determine original file extension
            if (mimeType.includes('mp4')) fileExtension = '.mp4';
            else if (mimeType.includes('webm')) fileExtension = '.webm';
            else if (mimeType.includes('wav')) fileExtension = '.wav';
            else if (mimeType.includes('ogg')) fileExtension = '.ogg';
          }
        }
      }
      
      // Create download link
    const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${drop.filename || 'recording'}${fileExtension}`;
      
      // Add to DOM, click, and remove
      document.body.appendChild(a);
    a.click();
      document.body.removeChild(a);
      
      // Clean up object URL if we created one
      if (downloadUrl !== dataUrl) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
      
      console.log(`Downloaded audio as: ${drop.filename}${fileExtension}`);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download audio file. Please try again.');
    }
  } else {
    alert('Audio file not found or corrupted.');
  }
}

// MP3 conversion using LAME encoder
async function convertAudioToMp3(audioBlob) {
  return new Promise(async (resolve) => {
    try {
      // Check if LAME library is available
      if (typeof lamejs === 'undefined') {
        console.log('LAME library not available, skipping MP3 conversion');
        resolve(null);
        return;
      }
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          const arrayBuffer = fileReader.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Convert to mono for simplicity (MP3 encoding is complex for stereo)
          const channels = audioBuffer.numberOfChannels;
          const sampleRate = audioBuffer.sampleRate;
          const length = audioBuffer.length;
          
          // Get audio data (convert to mono if stereo)
          let samples;
          if (channels === 1) {
            samples = audioBuffer.getChannelData(0);
          } else {
            // Mix stereo to mono
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            samples = new Float32Array(length);
            for (let i = 0; i < length; i++) {
              samples[i] = (left[i] + right[i]) / 2;
            }
          }
          
          // Convert float samples to 16-bit PCM
          const pcmSamples = new Int16Array(length);
          for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            pcmSamples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          }
          
          // Initialize LAME encoder
          const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128); // Mono, sampleRate, 128kbps
          const mp3Data = [];
          
          // Encode in chunks
          const chunkSize = 1152; // LAME chunk size
          for (let i = 0; i < pcmSamples.length; i += chunkSize) {
            const chunk = pcmSamples.subarray(i, i + chunkSize);
            const mp3buf = mp3encoder.encodeBuffer(chunk);
            if (mp3buf.length > 0) {
              mp3Data.push(mp3buf);
            }
          }
          
          // Finalize encoding
          const mp3buf = mp3encoder.flush();
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
          
          // Create MP3 blob
          const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
          console.log('Successfully encoded MP3:', mp3Blob.size, 'bytes');
          resolve(mp3Blob);
          
        } catch (error) {
          console.log('MP3 encoding failed:', error);
          resolve(null);
        }
      };
      
      fileReader.onerror = () => {
        console.log('FileReader error during MP3 conversion');
        resolve(null);
      };
      
      fileReader.readAsArrayBuffer(audioBlob);
      
    } catch (error) {
      console.log('MP3 conversion setup failed:', error);
      resolve(null);
    }
  });
}

// Open discussion modal
async function openDiscussion(dropId) {
  const drops = await getSoundDrops();
  const drop = drops.find(d => d.id == dropId);
  if (!drop) return;
  
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'discussion-modal';
  modal.innerHTML = `
    <div class="modal-content discussion-modal-content">
      <span class="close" onclick="closeDiscussion()">&times;</span>
      <h3>Discussion: ${drop.theme}</h3>
      <div class="sound-preview">
        <div class="drop-controls">
          <button class="play-btn" onclick="playAudio('${drop.id}')">
            <i class="fa-solid fa-play"></i>
          </button>
          <span>Uploaded ${formatTime(drop.timestamp)}</span>
        </div>
        ${drop.context ? `<div class="drop-context">"${drop.context}"</div>` : ''}
      </div>
      
      <div class="comments-section">
        <h4>Comments (${drop.discussions.length})</h4>
        <div class="comments-list" id="comments-list-${dropId}">
          ${renderComments(drop.discussions)}
        </div>
        
        <div class="add-comment">
          <textarea id="new-comment-${dropId}" placeholder="Share your thoughts about this sound..." rows="3"></textarea>
          <button onclick="addComment('${dropId}')" class="add-comment-btn">
            <i class="fa-solid fa-comment"></i> Add Comment
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Close discussion modal
function closeDiscussion() {
  const modal = document.getElementById('discussion-modal');
  if (modal) {
    modal.remove();
  }
}

// Render comments HTML
function renderComments(comments) {
  if (comments.length === 0) {
    return '<div class="no-comments">No comments yet. Be the first to share your thoughts!</div>';
  }
  
  return comments.map(comment => `
    <div class="comment" id="comment-${comment.id}">
      <div class="comment-header">
        <span class="comment-author">A Group Member</span>
        <span class="comment-time">${formatTime(comment.timestamp)}</span>
        <div class="comment-actions">
          <button class="edit-comment-btn" onclick="editComment('${comment.id}')" title="Edit comment">
            <i class="fa-solid fa-edit"></i>
          </button>
          <button class="delete-comment-btn" onclick="deleteComment('${comment.id}')" title="Delete comment">
            <i class="fa-solid fa-trash"></i>
          </button>
      </div>
      </div>
      <div class="comment-text" id="comment-text-${comment.id}">${comment.text}</div>
      <div class="comment-edit" id="comment-edit-${comment.id}" style="display: none;">
        <textarea id="edit-textarea-${comment.id}">${comment.text}</textarea>
        <div class="edit-actions">
          <button onclick="saveCommentEdit('${comment.id}')" class="save-edit-btn">
            <i class="fa-solid fa-check"></i> Save
          </button>
          <button onclick="cancelCommentEdit('${comment.id}')" class="cancel-edit-btn">
            <i class="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Add comment to a sound drop
async function addComment(dropId) {
  const textarea = document.getElementById(`new-comment-${dropId}`);
  const commentText = textarea.value.trim();
  
  if (!commentText) {
    alert('Please enter a comment before submitting.');
    return;
  }
  
  // Create the comment object
  const comment = {
    id: Date.now(),
    timestamp: Date.now(),
    text: commentText,
    author: 'A Group Member'
  };
  
  // First, add the comment locally for immediate feedback
  const localDrops = getLocalBackup();
  const localDropIndex = localDrops.findIndex(d => d.id == dropId);
  
  if (localDropIndex !== -1) {
    localDrops[localDropIndex].discussions.push(comment);
    localStorage.setItem('soundDropsBackup', JSON.stringify(localDrops));
  
    // Update the UI immediately
  const commentsList = document.getElementById(`comments-list-${dropId}`);
  if (commentsList) {
      commentsList.innerHTML = renderComments(localDrops[localDropIndex].discussions);
  }
  
  // Update the discussion count in the modal header
  const modalHeader = document.querySelector('.discussion-modal-content h4');
  if (modalHeader) {
      modalHeader.textContent = `Comments (${localDrops[localDropIndex].discussions.length})`;
  }
  
  // Clear the textarea
  textarea.value = '';
  
    // Show success message
    showNotification('Comment added successfully!', 'success');
    
    // Update the main page display
    renderSoundDropsFromData(localDrops);
    updateStatsFromData(localDrops);
  }
  
  // Try to sync with API in the background (don't block the UI)
  try {
    const apiUrl = `/api/sound-drops/${dropId}/discussion`;
    console.log('Attempting to sync comment with API:', apiUrl);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: commentText,
        author: 'A Group Member'
      })
    });
  
    if (response.ok) {
      console.log('Comment successfully synced with API');
      // Refresh from API to get any other updates
      const freshData = await getSoundDrops();
      renderSoundDropsFromData(freshData);
      updateStatsFromData(freshData);
    } else {
      const errorText = await response.text();
      console.log('API sync failed, but comment saved locally:', response.status, errorText);
    }
  } catch (error) {
    console.log('API sync failed, but comment saved locally:', error.message);
  }
}

// Check device capabilities
function checkDeviceCapabilities() {
  const capabilities = {
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    getUserMedia: navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
    audioContext: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
    localStorage: typeof Storage !== 'undefined'
  };
  
  console.log('Device capabilities:', capabilities);
  
  // Show warning if critical features are missing
  if (!capabilities.mediaRecorder || !capabilities.getUserMedia) {
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
      background: #fff3cd; 
      border: 1px solid #ffeaa7; 
      color: #856404; 
      padding: 15px; 
      margin: 10px 0; 
      border-radius: 8px; 
      text-align: center;
    `;
    warningDiv.innerHTML = `
      <strong>⚠️ Limited Functionality:</strong> 
      Audio recording may not work properly on this device/browser. 
      You can still listen to others' recordings and participate in discussions.
    `;
    document.querySelector('.container').insertBefore(warningDiv, document.querySelector('.theme-section'));
  }
  
  return capabilities;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Check device capabilities first
  const capabilities = checkDeviceCapabilities();
  
  // Set today's theme
  const theme = getTodaysTheme();
  document.getElementById('daily-theme').textContent = `"${theme.title}"`;
  document.getElementById('theme-description').textContent = theme.description;
  
  // Start countdown timer
  updateCountdown();
  setInterval(updateCountdown, 1000);
  
  // Always show local backup first for immediate loading, plus show welcome message for new users
  const localData = getLocalBackup();
  const isFirstVisit = !localStorage.getItem('hasVisitedBefore');
  
  if (localData.length > 0) {
    console.log('Loading', localData.length, 'drops from localStorage for immediate display');
    await renderSoundDropsFromData(localData);
    await updateStatsFromData(localData);
  } else if (isFirstVisit) {
    // Show welcome message for first-time visitors
    showWelcomeMessage();
  }
  
  // Mark that user has visited
  localStorage.setItem('hasVisitedBefore', 'true');
  
  // Check API status first
  try {
    const statusResponse = await fetch('/api/status');
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('API Status:', status);
    }
  } catch (error) {
    console.error('API status check failed:', error);
  }
  
  // Then try to get fresh data from API and merge
  const freshData = await getSoundDrops();
  await renderSoundDropsFromData(freshData);
  await updateStatsFromData(freshData);
  
  // Event listeners
  document.getElementById('drop-sound-btn').addEventListener('click', showRecordingSection);
  document.getElementById('record-btn').addEventListener('click', startRecording);
  document.getElementById('stop-btn').addEventListener('click', stopRecording);
  document.getElementById('link-btn').addEventListener('click', showLinkModal);
  
  // Filter buttons
  document.querySelectorAll('.filter-tag').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const freshData = await getSoundDrops();
      renderSoundDropsFromData(freshData, e.target.dataset.filter);
    });
  });
  
  // File upload
  document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const context = prompt(`How does this sound relate to today's theme: "${theme.title}"?`);
      await saveSoundDrop(file, context, 'uploaded', file.name);
    }
  });
  
  // Link form submission
  document.getElementById('link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const link = document.getElementById('audio-link').value;
    const context = document.getElementById('link-context').value;
    
    if (isValidAudioLink(link)) {
      await saveLinkDrop(link, context);
      closeLinkModal();
    } else {
      alert('Please enter a valid audio link from YouTube, Spotify, SoundCloud, Bandcamp, or Freesound.org');
    }
  });
  
  // Refresh data every 10 seconds to show new drops and comments from other users in real-time
  setInterval(async () => {
    try {
      console.log('Auto-refreshing data for real-time collaboration...');
      const freshData = await getSoundDrops();
      await renderSoundDropsFromData(freshData);
      await updateStatsFromData(freshData);
      
      // If a discussion modal is open, refresh its comments too
      const modal = document.querySelector('.discussion-modal-content');
      if (modal) {
        const dropIdMatch = modal.innerHTML.match(/comments-list-(\d+)/);
        if (dropIdMatch) {
          const dropId = dropIdMatch[1];
          const drop = freshData.find(d => d.id == dropId);
          if (drop) {
            const commentsList = document.getElementById(`comments-list-${dropId}`);
            if (commentsList) {
              commentsList.innerHTML = renderComments(drop.discussions);
            }
            
            // Update comment count in header
            const header = modal.querySelector('h4');
            if (header) {
              header.textContent = `Comments (${drop.discussions.length})`;
            }
          }
        }
      }
    } catch (error) {
      console.log('Auto-refresh failed:', error);
    }
  }, 10 * 1000);
});

// Show link modal
function showLinkModal() {
  document.getElementById('link-modal').style.display = 'flex';
}

// Close link modal
function closeLinkModal() {
  document.getElementById('link-modal').style.display = 'none';
  document.getElementById('audio-link').value = '';
  document.getElementById('link-context').value = '';
}

// Validate audio links
function isValidAudioLink(url) {
  const validDomains = [
    'youtube.com', 'youtu.be', 'music.youtube.com',
    'spotify.com', 'open.spotify.com',
    'soundcloud.com',
    'bandcamp.com',
    'freesound.org'
  ];
  
  try {
    const urlObj = new URL(url);
    return validDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

// Save link drop
async function saveLinkDrop(link, context) {
  try {
    const dropData = {
      audioData: link, // Store the link as audioData
      context: context || '',
      type: 'link',
      filename: `link_${Date.now()}`
    };
    
    const response = await fetch('/api/sound-drops', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dropData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Link drop saved successfully:', result);
      
      // Add to localStorage backup immediately
      const backup = getLocalBackup();
      backup.unshift(result.drop);
      localStorage.setItem('soundDropsBackup', JSON.stringify(backup));
      
      const freshData = await getSoundDrops();
      renderSoundDropsFromData(freshData);
      updateStatsFromData(freshData);
    } else {
      const errorText = await response.text();
      console.error('Failed to save link drop:', response.status, errorText);
      
      // Fallback: save to localStorage only
      console.log('Saving to localStorage as fallback');
      const drop = {
        id: Date.now(),
        timestamp: Date.now(),
        theme: getTodaysTheme().title,
        audioData: link,
        context: context || '',
        type: 'link',
        filename: `link_${Date.now()}`,
        discussions: []
      };
      
      const backup = getLocalBackup();
      backup.unshift(drop);
      localStorage.setItem('soundDropsBackup', JSON.stringify(backup));
      
      const freshData = getLocalBackup();
      renderSoundDropsFromData(freshData);
      updateStatsFromData(freshData);
    }
  } catch (error) {
    console.error('Error saving link drop:', error);
    
    // Network error fallback: save to localStorage only
    console.log('Network error - saving to localStorage as fallback');
    const drop = {
      id: Date.now(),
      timestamp: Date.now(),
      theme: getTodaysTheme().title,
      audioData: link,
      context: context || '',
      type: 'link',
      filename: `link_${Date.now()}`,
      discussions: []
    };
    
    const backup = getLocalBackup();
    backup.unshift(drop);
    localStorage.setItem('soundDropsBackup', JSON.stringify(backup));
    
    const freshData = getLocalBackup();
    renderSoundDropsFromData(freshData);
    updateStatsFromData(freshData);
  }
}

// Edit comment functionality
function editComment(commentId) {
  document.getElementById(`comment-text-${commentId}`).style.display = 'none';
  document.getElementById(`comment-edit-${commentId}`).style.display = 'block';
}

function cancelCommentEdit(commentId) {
  document.getElementById(`comment-text-${commentId}`).style.display = 'block';
  document.getElementById(`comment-edit-${commentId}`).style.display = 'none';
}

async function saveCommentEdit(commentId) {
  const newText = document.getElementById(`edit-textarea-${commentId}`).value.trim();
  
  if (!newText) {
    alert('Comment cannot be empty');
    return;
  }
  
  // Find the comment in localStorage first
  const localDrops = getLocalBackup();
  let targetDrop = null;
  let targetComment = null;
  
  for (let drop of localDrops) {
    const comment = drop.discussions.find(c => c.id == commentId);
    if (comment) {
      targetDrop = drop;
      targetComment = comment;
      break;
    }
  }
  
  if (!targetComment) {
    alert('Comment not found');
    return;
  }
  
  // Update the comment locally first
  targetComment.text = newText;
  targetComment.edited = true;
  targetComment.editedAt = Date.now();
  
  // Save to localStorage
  localStorage.setItem('soundDropsBackup', JSON.stringify(localDrops));
  
  // Update the display immediately
  document.getElementById(`comment-text-${commentId}`).textContent = newText;
  document.getElementById(`comment-text-${commentId}`).style.display = 'block';
  document.getElementById(`comment-edit-${commentId}`).style.display = 'none';
  
  // Add edited indicator
  const commentHeader = document.querySelector(`#comment-${commentId} .comment-time`);
  if (commentHeader && !commentHeader.textContent.includes('(edited)')) {
    commentHeader.textContent += ' (edited)';
  }
  
  // Show success message
  showNotification('Comment updated successfully!', 'success');
  
  // Update main page display
  renderSoundDropsFromData(localDrops);
  updateStatsFromData(localDrops);
  
  // Try to sync with API in background
  try {
    const response = await fetch(`/api/sound-drops/${targetDrop.id}/discussion/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: newText })
    });
    
    if (response.ok) {
      console.log('Comment edit successfully synced with API');
    } else {
      console.log('API edit sync failed, but comment saved locally');
    }
  } catch (error) {
    console.log('API edit sync failed, but comment saved locally:', error.message);
  }
}

async function deleteComment(commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) {
    return;
  }
  
  // Find the comment in localStorage
  const localDrops = getLocalBackup();
  let targetDrop = null;
  let commentIndex = -1;
  
  for (let drop of localDrops) {
    commentIndex = drop.discussions.findIndex(c => c.id == commentId);
    if (commentIndex !== -1) {
      targetDrop = drop;
      break;
    }
  }
  
  if (!targetDrop || commentIndex === -1) {
    alert('Comment not found');
    return;
  }
  
  // Remove the comment locally first
  targetDrop.discussions.splice(commentIndex, 1);
  
  // Save to localStorage
  localStorage.setItem('soundDropsBackup', JSON.stringify(localDrops));
  
  // Remove from display immediately
  const commentElement = document.getElementById(`comment-${commentId}`);
  if (commentElement) {
    commentElement.remove();
  }
  
  // Show success message
  showNotification('Comment deleted successfully!', 'success');
  
  // Update discussion count in modal header
  const modalHeader = document.querySelector('.discussion-modal-content h4');
  if (modalHeader) {
    modalHeader.textContent = `Comments (${targetDrop.discussions.length})`;
  }
  
  // Update the main page display
  renderSoundDropsFromData(localDrops);
  updateStatsFromData(localDrops);
  
  // Try to sync with API in background
  try {
    const response = await fetch(`/api/sound-drops/${targetDrop.id}/discussion/${commentId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      console.log('Comment deletion successfully synced with API');
    } else {
      console.log('API delete sync failed, but comment deleted locally');
    }
  } catch (error) {
    console.log('API delete sync failed, but comment deleted locally:', error.message);
  }
}

// Helper function to update comment storage
async function updateCommentInStorage(drop) {
  // Update localStorage as primary storage for comments
  const backup = getLocalBackup();
  const dropIndex = backup.findIndex(d => d.id === drop.id);
  if (dropIndex !== -1) {
    backup[dropIndex] = drop;
    localStorage.setItem('soundDropsBackup', JSON.stringify(backup));
  }
}

// Show welcome message for new users
function showWelcomeMessage() {
  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'welcome-message';
  welcomeDiv.innerHTML = `
    <div class="welcome-content">
      <h3>🎵 Welcome to SoundDrop!</h3>
      <p>This is where you'll see all the sounds shared in the last 24 hours. When people record, upload, or share audio links, they'll appear here for everyone to discover and discuss.</p>
      <p><strong>Be the first to share something!</strong> Use the buttons above to record your sound, upload an audio file, or share a link to audio from YouTube, Spotify, or other platforms.</p>
      <button onclick="this.parentElement.parentElement.remove()" class="dismiss-welcome">
        <i class="fa-solid fa-times"></i> Got it!
      </button>
    </div>
  `;
  
  // Insert before the sound drops container
  const soundDropsContainer = document.getElementById('sound-drops');
  soundDropsContainer.parentNode.insertBefore(welcomeDiv, soundDropsContainer);
}

// Show notification message
function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
  `;
  
  // Add to the top of the page
  document.body.insertBefore(notification, document.body.firstChild);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

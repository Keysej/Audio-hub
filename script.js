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
    
    // Check for MediaRecorder support and use best available format
    let options = {};
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options.mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options.mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/wav')) {
      options.mimeType = 'audio/wav';
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = event => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
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

// Download audio
async function downloadAudio(dropId) {
  const drops = await getSoundDrops();
  const drop = drops.find(d => d.id == dropId);
  if (drop) {
    const a = document.createElement('a');
    a.href = drop.audioData;
    a.download = `${drop.filename}.wav`;
    a.click();
  }
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
    <div class="comment">
      <div class="comment-header">
        <span class="comment-author">Researcher</span>
        <span class="comment-time">${formatTime(comment.timestamp)}</span>
      </div>
      <div class="comment-text">${comment.text}</div>
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
  
  try {
    const response = await fetch(`/api/sound-drops/${dropId}/discussion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
    text: commentText,
        author: 'Researcher'
      })
    });
  
    if (response.ok) {
      const result = await response.json();
  
      // Get updated drops to refresh display
      const drops = await getSoundDrops();
      const drop = drops.find(d => d.id == dropId);
  
      if (drop) {
  // Update the comments display
  const commentsList = document.getElementById(`comments-list-${dropId}`);
  if (commentsList) {
          commentsList.innerHTML = renderComments(drop.discussions);
  }
  
  // Update the discussion count in the modal header
  const modalHeader = document.querySelector('.discussion-modal-content h4');
  if (modalHeader) {
          modalHeader.textContent = `Comments (${drop.discussions.length})`;
        }
  }
  
  // Clear the textarea
  textarea.value = '';
  
  // Update the main page
      const freshData = await getSoundDrops();
      renderSoundDropsFromData(freshData);
      updateStatsFromData(freshData);
      
    } else {
      console.error('Failed to add comment');
      alert('Failed to add comment. Please try again.');
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    alert('Error adding comment. Please try again.');
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
  
  // Always show local backup first for immediate loading
  const localData = getLocalBackup();
  if (localData.length > 0) {
    console.log('Loading', localData.length, 'drops from localStorage for immediate display');
    await renderSoundDropsFromData(localData);
    await updateStatsFromData(localData);
  }
  
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
  
  // Refresh data every 30 seconds to show new drops from other users
  setInterval(async () => {
    const freshData = await getSoundDrops();
    renderSoundDropsFromData(freshData);
    updateStatsFromData(freshData);
  }, 30 * 1000);
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

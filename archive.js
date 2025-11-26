// SoundDrop Archive - View Past Themes & Sounds

// Daily themes rotation (same as main app)
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

// Get theme for specific date
function getThemeForDate(date) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  return themes[dayOfYear % themes.length];
}

// Initialize archive page
document.addEventListener('DOMContentLoaded', () => {
  // Set max date to yesterday (can't archive today)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = yesterday.toISOString().split('T')[0];
  document.getElementById('archive-date').max = maxDate;
  
  // Set default to yesterday
  document.getElementById('archive-date').value = maxDate;
  
  // Event listeners
  document.getElementById('load-archive-btn').addEventListener('click', loadArchiveForDate);
  document.getElementById('archive-date').addEventListener('change', loadArchiveForDate);
  
  // Load weekly summary
  loadWeeklySummary();
});

// Load archive for selected date
async function loadArchiveForDate() {
  const selectedDate = document.getElementById('archive-date').value;
  if (!selectedDate) return;
  
  const date = new Date(selectedDate);
  const theme = getThemeForDate(date);
  
  // Show loading
  const content = document.getElementById('archive-content');
  content.innerHTML = `
    <div class="loading-archive">
      <div class="loading-spinner"></div>
      <p>Loading archive for ${date.toLocaleDateString()}...</p>
    </div>
  `;
  
  try {
    // Try to get archived data from API
    const sounds = await getArchivedSounds(selectedDate);
    
    // Render archive content
    renderArchiveContent(date, theme, sounds);
    
  } catch (error) {
    console.error('Failed to load archive:', error);
    content.innerHTML = `
      <div class="archive-error">
        <h3>📭 No Archive Data</h3>
        <p>No archived sounds found for ${date.toLocaleDateString()}.</p>
        <p>This might be because:</p>
        <ul>
          <li>No sounds were recorded on this date</li>
          <li>The archive system wasn't active yet</li>
          <li>Data hasn't been archived from the research database</li>
        </ul>
      </div>
    `;
  }
}

// Get archived sounds for a specific date
async function getArchivedSounds(dateString) {
  try {
    // Try API first
    const response = await fetch(`/api/archive/${dateString}`);
    if (response.ok) {
      const data = await response.json();
      return data.sounds || [];
    }
  } catch (error) {
    console.log('API archive not available, checking localStorage');
  }
  
  // Fallback to localStorage (limited to recent data)
  const backup = localStorage.getItem('soundDropsBackup');
  if (backup) {
    const allSounds = JSON.parse(backup);
    const targetDate = new Date(dateString);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    return allSounds.filter(sound => {
      const soundDate = new Date(sound.timestamp);
      return soundDate >= startOfDay && soundDate <= endOfDay;
    });
  }
  
  return [];
}

// Render archive content
function renderArchiveContent(date, theme, sounds) {
  const content = document.getElementById('archive-content');
  
  const soundsHtml = sounds.length > 0 
    ? sounds.map(sound => `
        <div class="archived-sound">
          <div class="sound-header">
            <h4>Theme: ${sound.theme}</h4>
            <span class="sound-time">${new Date(sound.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="sound-content">
            <audio controls>
              <source src="${sound.audioData}" type="audio/wav">
              Your browser does not support audio playback.
            </audio>
            <p class="sound-context">"${sound.context}"</p>
            ${sound.discussions && sound.discussions.length > 0 
              ? `<div class="archived-discussions">
                   <h5>💬 Discussions (${sound.discussions.length})</h5>
                   ${sound.discussions.map(d => `
                     <div class="archived-comment">
                       <span class="comment-time">${new Date(d.timestamp).toLocaleTimeString()}</span>
                       <p>${d.comment}</p>
                     </div>
                   `).join('')}
                 </div>`
              : ''
            }
          </div>
        </div>
      `).join('')
    : '<div class="no-sounds"><h3>📭 No sounds recorded</h3><p>No one shared sounds for this theme on this day.</p></div>';
  
  content.innerHTML = `
    <div class="archive-theme-header">
      <h2>🎵 ${theme.title}</h2>
      <p class="archive-date">📅 ${date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}</p>
      <p class="theme-description">${theme.description}</p>
      <div class="archive-stats">
        <span class="stat">${sounds.length} sounds</span>
        <span class="stat">${sounds.reduce((total, s) => total + (s.discussions?.length || 0), 0)} discussions</span>
      </div>
    </div>
    
    <div class="archived-sounds">
      <h3>🎧 Recorded Sounds</h3>
      ${soundsHtml}
    </div>
  `;
}

// Load weekly summary
async function loadWeeklySummary() {
  try {
    // Calculate stats from the last 7 days
    const weekData = await getWeeklyData();
    
    document.getElementById('total-sounds').textContent = weekData.totalSounds;
    document.getElementById('total-discussions').textContent = weekData.totalDiscussions;
    document.getElementById('active-days').textContent = weekData.activeDays;
    document.getElementById('favorite-theme').textContent = weekData.favoriteTheme;
    
    // Render theme timeline
    renderThemeTimeline(weekData.dailyThemes);
    
    document.getElementById('weekly-summary').style.display = 'block';
    
  } catch (error) {
    console.error('Failed to load weekly summary:', error);
  }
}

// Get weekly data for summary
async function getWeeklyData() {
  const weekData = {
    totalSounds: 0,
    totalDiscussions: 0,
    activeDays: 0,
    favoriteTheme: 'None',
    dailyThemes: []
  };
  
  const today = new Date();
  const themeCount = {};
  
  // Check last 7 days
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    try {
      const sounds = await getArchivedSounds(dateString);
      const theme = getThemeForDate(date);
      
      if (sounds.length > 0) {
        weekData.activeDays++;
        weekData.totalSounds += sounds.length;
        weekData.totalDiscussions += sounds.reduce((total, s) => total + (s.discussions?.length || 0), 0);
        
        themeCount[theme.title] = (themeCount[theme.title] || 0) + sounds.length;
      }
      
      weekData.dailyThemes.push({
        date: date,
        theme: theme,
        soundCount: sounds.length
      });
      
    } catch (error) {
      weekData.dailyThemes.push({
        date: date,
        theme: getThemeForDate(date),
        soundCount: 0
      });
    }
  }
  
  // Find favorite theme
  const maxTheme = Object.keys(themeCount).reduce((a, b) => 
    themeCount[a] > themeCount[b] ? a : b, 'None'
  );
  weekData.favoriteTheme = maxTheme;
  
  return weekData;
}

// Render theme timeline
function renderThemeTimeline(dailyThemes) {
  const timeline = document.getElementById('theme-list');
  
  timeline.innerHTML = dailyThemes.reverse().map(day => `
    <div class="timeline-item ${day.soundCount > 0 ? 'active' : 'inactive'}">
      <div class="timeline-date">
        ${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
      <div class="timeline-theme">
        <h4>${day.theme.title}</h4>
        <p>${day.soundCount} sound${day.soundCount !== 1 ? 's' : ''}</p>
      </div>
    </div>
  `).join('');
}

// Modal functions
function closeArchiveModal() {
  document.getElementById('archive-modal').style.display = 'none';
}


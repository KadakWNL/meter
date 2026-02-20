// content script for detecting page-level activity
// only detects activity presence, not content => no privacy breach

// activity batch for efficient messaging
interface ActivityBatch {
  mouse: boolean;
  keyboard: boolean;
  scroll: boolean;
}

let activityBatch: ActivityBatch = {
  mouse: false,
  keyboard: false,
  scroll: false
};

let batchTimeout: number | null = null;
let lastMediaState: string | null = null;

// send batched activity signals
function sendActivityBatch() {
  const activities: string[] = [];
  
  if (activityBatch.mouse) activities.push('mouse');
  if (activityBatch.keyboard) activities.push('keyboard');
  if (activityBatch.scroll) activities.push('scroll');
  
  if (activities.length > 0) {
    chrome.runtime.sendMessage({
      type: 'ACTIVITY_BATCH',
      activities: activities,
      timestamp: Date.now()
    }).catch(() => {
      // ignore errors if background script not ready
    });
    
    // reset batch
    activityBatch = {
      mouse: false,
      keyboard: false,
      scroll: false
    };
  }
  
  batchTimeout = null;
}

// schedule batch send (debounced)
function scheduleBatchSend() {
  if (batchTimeout !== null) {
    clearTimeout(batchTimeout);
  }
  
  batchTimeout = window.setTimeout(() => {
    sendActivityBatch();
  }, 1000); // send after 1 second of no new activity
}

// throttle function for high-frequency events
function throttle(func: () => void, limit: number): () => void {
  let inThrottle = false;
  return function() {
    if (!inThrottle) {
      func();
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// detect mouse activity (throttled to 500ms)
const handleMouseActivity = throttle(() => {
  activityBatch.mouse = true;
  scheduleBatchSend();
}, 500);

// detect keyboard activity (immediate)
function handleKeyboardActivity() {
  activityBatch.keyboard = true;
  scheduleBatchSend();
}

// detect scroll activity (throttled to 500ms)
const handleScrollActivity = throttle(() => {
  activityBatch.scroll = true;
  scheduleBatchSend();
}, 500);

// check for media playback (video/audio)
function checkMediaStatus() {
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  
  let hasPlayingVideo = false;
  let hasPlayingAudio = false;
  
  // check videos - only visible and playing ones
  for (const video of Array.from(videos)) {
    if (!video.paused && !video.ended && video.currentTime > 0) {
      const rect = video.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      
      // check if in viewport and has significant size
      const isInViewport = (
        rect.top < viewportHeight &&
        rect.bottom > 0 &&
        rect.left < viewportWidth &&
        rect.right > 0
      );
      
      const hasSignificantSize = rect.width > 100 && rect.height > 100;
      
      // check visibility
      const computedStyle = window.getComputedStyle(video);
      const isVisible = (
        computedStyle.display !== 'none' &&
        computedStyle.visibility !== 'hidden' &&
        parseFloat(computedStyle.opacity) > 0
      );
      
      if (isInViewport && hasSignificantSize && isVisible) {
        hasPlayingVideo = true;
        break;
      }
    }
  }
  
  // check audio elements
  for (const audio of Array.from(audios)) {
    if (!audio.paused && !audio.ended && audio.currentTime > 0 && audio.volume > 0) {
      hasPlayingAudio = true;
      break;
    }
  }
  
  // create state string for comparison
  const currentState = `v:${hasPlayingVideo},a:${hasPlayingAudio}`;
  
  // only send if state changed (efficiency)
  if (currentState !== lastMediaState) {
    chrome.runtime.sendMessage({
      type: 'MEDIA_STATUS',
      hasVideo: hasPlayingVideo,
      hasAudio: hasPlayingAudio,
      timestamp: Date.now()
    }).catch(() => {
      // ignore errors
    });
    
    lastMediaState = currentState;
  }
}

// detect Picture-in-Picture mode
function handlePiPEnter() {
  chrome.runtime.sendMessage({
    type: 'PIP_STATUS',
    isInPiP: true
  }).catch(() => {});
}

function handlePiPLeave() {
  chrome.runtime.sendMessage({
    type: 'PIP_STATUS',
    isInPiP: false
  }).catch(() => {});
}

// setup event listeners
function setupListeners() {
  // mouse movement (passive for performance)
  document.addEventListener('mousemove', handleMouseActivity, { passive: true });
  
  // keyboard activity
  document.addEventListener('keydown', handleKeyboardActivity, { passive: true });
  
  // scroll activity (passive for performance)
  document.addEventListener('scroll', handleScrollActivity, { passive: true });
  
  // media events for immediate state changes
  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLMediaElement) {
      checkMediaStatus();
    }
  }, true);
  
  document.addEventListener('pause', (e) => {
    if (e.target instanceof HTMLMediaElement) {
      checkMediaStatus();
    }
  }, true);
  
  // Picture-in-Picture events
  document.addEventListener('enterpictureinpicture', handlePiPEnter);
  document.addEventListener('leavepictureinpicture', handlePiPLeave);
  
  // periodic media check (every 5 seconds)
  setInterval(checkMediaStatus, 5000);
  
  // initial media check
  checkMediaStatus();
}

// initialize
setupListeners();

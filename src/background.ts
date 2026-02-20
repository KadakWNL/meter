import { getDomain } from "./utils/domain.js";
import { ActivitySignalsManager } from "./utils/activitySignals.js";
import { DEFAULT_AFK_CONFIG } from "./utils/afkConfig.js";


// console.log("ALLO MY FRENDO") // test reload extension works

// struct DomainTimeData to store Domain: time
interface DomainTimeData {
  [domain: string]: number;
}

let currentDomain: string | null = null;
let startTime: number | null = null;

// AFK detection state
const activitySignals = new ActivitySignalsManager();
let isSystemIdle = false;
let afkStartTime: number | null = null;
let gracePeriodTimeout: number | null = null;
let isInPiP = false;

// tab switching detection
let tabSwitchState = {
  count: 0,
  lastSwitchTime: 0,
  windowId: chrome.windows.WINDOW_ID_NONE as number
};

// window focus state
let windowFocusState = {
  hasFocus: true,
  lastFocusChange: Date.now()
};

// check if user should be marked as AFK
function shouldBeAFK(): boolean {
  // don't mark as AFK if in Picture-in-Picture mode
  if (isInPiP) return false;
  
  // don't mark as AFK if system is not idle
  if (!isSystemIdle) return false;
  
  // check activity signals
  const isActive = activitySignals.isUserActive();
  
  return !isActive;
}

// check if system is locked
let isSystemLocked = false;

// update AFK status and handle state transitions
function updateAFKStatus() {
  const shouldPauseTracking = shouldBeAFK();
  const isCurrentlyAFK = afkStartTime !== null;
  
  if (shouldPauseTracking && !isCurrentlyAFK) {
    // potential AFK detected - start grace period
    afkStartTime = Date.now();
    
    // clear existing grace period timeout
    if (gracePeriodTimeout !== null) {
      clearTimeout(gracePeriodTimeout);
    }
    
    // set grace period timer
    gracePeriodTimeout = setTimeout(() => {
      if (afkStartTime !== null) {
        // still AFK after grace period - pause tracking
        pauseTrackingForAFK();
      }
      gracePeriodTimeout = null;
    }, DEFAULT_AFK_CONFIG.gracePeriod);
    
  } else if (!shouldPauseTracking && isCurrentlyAFK) {
    // user is back - clear grace period
    if (gracePeriodTimeout !== null) {
      clearTimeout(gracePeriodTimeout);
      gracePeriodTimeout = null;
    }
    
    const wasInGracePeriod = afkStartTime ? 
      (Date.now() - afkStartTime < DEFAULT_AFK_CONFIG.gracePeriod) : 
      false;
    afkStartTime = null;
    
    if (!wasInGracePeriod) {
      // user returned from actual AFK - resume tracking
      resumeTrackingFromAFK();
    }
  }
}

// pause tracking due to AFK
async function pauseTrackingForAFK() {
  console.log('User is AFK - pausing tracking');
  await stopTracking();
}

// resume tracking after AFK
async function resumeTrackingFromAFK() {
  // don't resume if system is still locked
  if (isSystemLocked) {
    console.log('System still locked - not resuming tracking');
    return;
  }
  
  console.log('User returned from AFK - resuming tracking');
  
  // reset activity signals
  activitySignals.resetAll();
  
  // restart tracking on current tab if browser has focus
  if (windowFocusState.hasFocus) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      const domain = getDomain(tabs[0].url);
      if (domain) {
        startTracking(domain);
      }
    }
  }
}

// getDate
function getTodayKey(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

// saveTime
async function saveTime(domain: string, seconds: number) {
  const key = getTodayKey();
  const result = await chrome.storage.local.get(key); 
  const dayData: DomainTimeData = (result[key] as DomainTimeData) || {};
  
  dayData[domain] = (dayData[domain] || 0) + seconds;
  
  await chrome.storage.local.set({ [key]: dayData });
  console.log(`Saved ${seconds}s for ${domain}. Total: ${dayData[domain]}s`);
}

async function stopTracking() {
  if (currentDomain && startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed > 0) {
      await saveTime(currentDomain, elapsed);
    }
  }
  currentDomain = null;
  startTime = null;
}

// start tracking a new domain
function startTracking(domain: string) {
  currentDomain = domain;
  startTime = Date.now();
  console.log(`Tracking started: ${domain}`);
}

// tab activation
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  await stopTracking();
  
  const tab = await chrome.tabs.get(tabId);
  const domain = getDomain(tab.url);

  if (domain) {
    startTracking(domain);
  }
  
  // detect rapid tab switching
  const now = Date.now();
  const timeSinceLastSwitch = now - tabSwitchState.lastSwitchTime;
  
  if (timeSinceLastSwitch < DEFAULT_AFK_CONFIG.rapidSwitchWindow && 
      tabSwitchState.windowId === windowId) {
    tabSwitchState.count++;
  } else {
    tabSwitchState.count = 1;
  }
  
  tabSwitchState.lastSwitchTime = now;
  tabSwitchState.windowId = windowId;
  
  // if rapid switching, increase tab switch signal weight
  const isRapidSwitching = tabSwitchState.count >= DEFAULT_AFK_CONFIG.rapidSwitchCount;
  if (isRapidSwitching) {
    activitySignals.setWeight('tabSwitch', 2.0);
  } else {
    activitySignals.setWeight('tabSwitch', 1.0);
  }
  
  // tab switch is activity signal
  activitySignals.updateSignal('tabSwitch');
  updateAFKStatus();
});

// URL changes in active tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    await stopTracking();
    
    const domain = getDomain(changeInfo.url);
    if (domain) {
      startTracking(domain);
    }
  }
});

// Handle window focus changes (user switches to another app)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const now = Date.now();
  const wasFocused = windowFocusState.hasFocus;
  const hasFocus = windowId !== chrome.windows.WINDOW_ID_NONE;
  
  if (wasFocused && !hasFocus) {
    // browser lost focus - user switched to another app
    windowFocusState.hasFocus = false;
    windowFocusState.lastFocusChange = now;
    await stopTracking();
    
  } else if (!wasFocused && hasFocus) {
    // browser regained focus
    const focusLostTime = now - windowFocusState.lastFocusChange;
    windowFocusState.hasFocus = true;
    windowFocusState.lastFocusChange = now;
    
    // if focus was lost for very short time, user is multitasking (not AFK)
    if (focusLostTime < DEFAULT_AFK_CONFIG.shortFocusSwitchThreshold) {
      // reset activity signals - user is actively working
      activitySignals.resetAll();
      
      // clear AFK state
      if (afkStartTime !== null) {
        afkStartTime = null;
        if (gracePeriodTimeout !== null) {
          clearTimeout(gracePeriodTimeout);
          gracePeriodTimeout = null;
        }
      }
    }
    
    // resume tracking on active tab
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      const domain = getDomain(tab.url);
      if (domain) {
        startTracking(domain);
      }
    }
    
    updateAFKStatus();
  }
});

// save data periodically (prevent lost data on extension crashes)
setInterval(async () => {
  // don't save if system is locked or user is AFK
  if (isSystemLocked || afkStartTime !== null) {
    return;
  }
  
  if (currentDomain && startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed >= 10) {
      await saveTime(currentDomain, elapsed);
      startTime = Date.now(); // Reset timer
    }
  }
}, 10000);

// handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'ACTIVITY_BATCH':
      // update multiple signals from batched activity
      activitySignals.updateBatch(message.activities);
      updateAFKStatus();
      break;
      
    case 'MEDIA_STATUS':
      // update video and audio signals
      activitySignals.updateSignal('video', message.hasVideo);
      activitySignals.updateSignal('audio', message.hasAudio);
      updateAFKStatus();
      break;
      
    case 'PIP_STATUS':
      // Picture-in-Picture mode - user is actively watching
      isInPiP = message.isInPiP;
      if (isInPiP) {
        activitySignals.updateSignal('video', true);
      }
      updateAFKStatus();
      break;
  }
});

// chrome idle detection
chrome.idle.setDetectionInterval(DEFAULT_AFK_CONFIG.idleThreshold);

chrome.idle.onStateChanged.addListener(async (newState) => {
  const wasLocked = isSystemLocked;
  isSystemLocked = (newState === 'locked');
  isSystemIdle = (newState === 'idle' || newState === 'locked');
  
  if (isSystemLocked) {
    // system is locked - immediately stop tracking without grace period
    console.log('System locked - stopping tracking immediately');
    await stopTracking();
    
    // clear grace period if any
    if (gracePeriodTimeout !== null) {
      clearTimeout(gracePeriodTimeout);
      gracePeriodTimeout = null;
    }
    afkStartTime = Date.now(); // mark as AFK
    
  } else if (wasLocked && !isSystemLocked) {
    // system was unlocked - clear AFK state
    console.log('System unlocked');
    afkStartTime = null;
    activitySignals.resetAll();
    
  } else if (!isSystemIdle) {
    // system became active (not from unlock) - reset signals
    activitySignals.resetAll();
  }
  
  // only update AFK status if not locked (locked is handled explicitly above)
  if (!isSystemLocked) {
    updateAFKStatus();
  }
});

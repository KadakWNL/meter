import { getDomain } from "./utils/domain.js";

// struct DomainTimeData to store Domain: time
interface DomainTimeData {
  [domain: string]: number;
}

let currentDomain: string | null = null;
let startTime: number | null = null;

// Lock detection state
let isSystemLocked = false;

// window focus state
let windowFocusState = {
  hasFocus: true,
  lastFocusChange: Date.now()
};

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
  // prevent restarting tracking for the same domain
  if (currentDomain === domain && startTime !== null) {
    console.log(`Already tracking ${domain}, ignoring restart`);
    return;
  }
  
  currentDomain = domain;
  startTime = Date.now();
  console.log(`Tracking started: ${domain}`);
}

// tab activation
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  console.log(`Tab activated: ${tabId}`);
  await stopTracking();
  
  const tab = await chrome.tabs.get(tabId);
  const domain = getDomain(tab.url);

  if (domain) {
    startTracking(domain);
  }
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
  const wasFocused = windowFocusState.hasFocus;
  const hasFocus = windowId !== chrome.windows.WINDOW_ID_NONE;
  
  if (wasFocused && !hasFocus) {
    // browser lost focus - user switched to another app
    windowFocusState.hasFocus = false;
    windowFocusState.lastFocusChange = Date.now();
    await stopTracking();
    
  } else if (!wasFocused && hasFocus) {
    // browser regained focus
    windowFocusState.hasFocus = true;
    windowFocusState.lastFocusChange = Date.now();
    
    // resume tracking on active tab
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      const domain = getDomain(tab.url);
      if (domain) {
        startTracking(domain);
      }
    }
  }
});

// save data periodically (prevent lost data on extension crashes)
setInterval(async () => {
  // don't save if system is locked
  if (isSystemLocked) {
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

// handle messages from content scripts (optional debug logging)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DEBUG_LOG') {
    console.log(`[Content] ${message.message}`);
  }
});

// chrome lock detection only
chrome.idle.setDetectionInterval(60); // Check every 60 seconds

chrome.idle.onStateChanged.addListener(async (newState) => {
  const wasLocked = isSystemLocked;
  isSystemLocked = (newState === 'locked');
  
  if (isSystemLocked && !wasLocked) {
    // system just got locked - stop tracking
    console.log('System locked - stopping tracking');
    await stopTracking();
    
  } else if (!isSystemLocked && wasLocked) {
    // system was unlocked
    console.log('System unlocked - ready to resume tracking');
  }
});

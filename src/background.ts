import { getDomain } from "./utils/domain.js";

// struct DomainTimeData to store Domain: time
interface DomainTimeData {
  [domain: string]: number;
}

let currentDomain: string | null = null;
let startTime: number | null = null;

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
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
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
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Lost focus - stop tracking
    await stopTracking();
  } else {
    // Gained focus - start tracking active tab
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
  if (currentDomain && startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed >= 10) {
      await saveTime(currentDomain, elapsed);
      startTime = Date.now(); // Reset timer
    }
  }
}, 10000);

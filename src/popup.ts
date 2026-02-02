interface DomainTimeData {
  [domain: string]: number;
}

type Theme = "light" | "dark" | "system";

// manage themes
function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

async function loadTheme() {
  const result = await chrome.storage.local.get("theme");
  const theme: Theme = (result.theme as Theme) || "system";
  applyTheme(theme);
  updateThemeIcon(theme);
}

function applyTheme(theme: Theme) {
  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;
  document.body.setAttribute("data-theme", effectiveTheme);
}

function updateThemeIcon(theme: Theme) {
  const lightIcon = document.getElementById("light-icon");
  const darkIcon = document.getElementById("dark-icon");
  const systemIcon = document.getElementById("system-icon");

  lightIcon?.classList.add("hidden");
  darkIcon?.classList.add("hidden");
  systemIcon?.classList.add("hidden");

  if (theme === "light") lightIcon?.classList.remove("hidden");
  else if (theme === "dark") darkIcon?.classList.remove("hidden");
  else systemIcon?.classList.remove("hidden");
}

async function cycleTheme() {
  const result = await chrome.storage.local.get("theme");
  const currentTheme: Theme = (result.theme as Theme) || "system";
  
  const themes: Theme[] = ["light", "dark", "system"];
  const currentIndex = themes.indexOf(currentTheme);
  const nextTheme = themes[(currentIndex + 1) % themes.length];

  await chrome.storage.local.set({ theme: nextTheme });
  applyTheme(nextTheme);
  updateThemeIcon(nextTheme);
}

// time formatting for display
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// get date
function getTodayKey(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

// Load and display today's data
async function loadTodayData() {
  const key = getTodayKey();
  const result = await chrome.storage.local.get(key);
  const dayData: DomainTimeData = (result[key] as DomainTimeData) || {};

  const totalTimeDiv = document.getElementById("total-time");
  const domainsListDiv = document.getElementById("domains-list");

  if (!totalTimeDiv || !domainsListDiv) return;

  // calculate total time
  const totalSeconds = Object.values(dayData).reduce((sum, time) => sum + time, 0);

  // display total time
  totalTimeDiv.textContent = totalSeconds > 0 ? formatTime(totalSeconds) : "0m 0s";

  // sort domains by time and take top 5
  const sortedDomains = Object.entries(dayData)
    .sort(([, timeA], [, timeB]) => timeB - timeA)
    .slice(0, 5);

  // display domains
  if (sortedDomains.length === 0) {
    domainsListDiv.innerHTML = '<div class="no-data">No activity tracked yet today.<br>Start browsing!</div>';
    return;
  }

  domainsListDiv.innerHTML = "";
  const maxTime = sortedDomains[0][1]; // longest time for progress bar scaling

  sortedDomains.forEach(([domain, seconds]) => {
    const percentage = (seconds / maxTime) * 100;

    const domainItem = document.createElement("div");
    domainItem.className = "domain-item";
    domainItem.innerHTML = `
      <div class="domain-header">
        <span class="domain-name">${domain}</span>
        <span class="domain-time">${formatTime(seconds)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
    `;

    domainsListDiv.appendChild(domainItem);
  });
}

// load data when popup opens
loadTheme();
loadTodayData();

const themeToggle = document.getElementById("theme-toggle");
themeToggle?.addEventListener("click", cycleTheme);

// system theme changes listener
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
  const result = await chrome.storage.local.get("theme");
  if (result.theme === "system") {
    applyTheme("system");
  }
});

// listen for storage changes and update UI
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (changes.theme) {
      loadTheme();
    } else {
      loadTodayData();
    }
  }
});

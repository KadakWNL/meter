import { loadTheme, cycleTheme, applyTheme } from "./utils/theme.js";
import { renderChart, DomainTimeData } from "./chart.js";
import { formatTime, getDateKey, formatDateDisplay } from "./utils/dateUtils.js";

// keep track of what date we're looking at (starts with today)
let selectedDate: Date = new Date();

// load and display data for selected date
async function loadDateData() {
  const key = getDateKey(selectedDate);
  const result = await chrome.storage.local.get(key);
  const dayData: DomainTimeData = (result[key] as DomainTimeData) || {};

  const domainsListDiv = document.getElementById("domains-list");

  if (!domainsListDiv) return;

  // calculate total time spent
  const totalSeconds = Object.values(dayData).reduce((sum, time) => sum + time, 0);

  // update the center text in the chart
  const centerText = document.getElementById("chart-center-text");
  if (centerText) {
    centerText.textContent = totalSeconds > 0 ? formatTime(totalSeconds) : "0m 0s";
  }

  // render the chart
  renderChart(dayData);

  // sort domains by time (most to least)
  const sortedDomains = Object.entries(dayData)
    .sort(([, timeA], [, timeB]) => timeB - timeA);

  // display domains list
  if (sortedDomains.length === 0) {
    domainsListDiv.innerHTML = '<div class="no-data">No activity tracked yet.<br>Start browsing!</div>';
    return;
  }

  domainsListDiv.innerHTML = "";

  sortedDomains.forEach(([domain, seconds]) => {
    const domainItem = document.createElement("div");
    domainItem.className = "domain-item";
    domainItem.innerHTML = `
      <div class="domain-header">
        <span class="domain-name">${domain}</span>
        <span class="domain-time">${formatTime(seconds)}</span>
      </div>
    `;

    domainsListDiv.appendChild(domainItem);
  });
}

// update date display and button states
function updateDateDisplay() {
  const currentDateDiv = document.getElementById("current-date");
  const nextDateBtn = document.getElementById("next-date") as HTMLButtonElement;
  
  if (currentDateDiv) {
    currentDateDiv.textContent = formatDateDisplay(selectedDate);
  }
  
  // disable next button if we're already at today (can't go to future)
  const today = new Date();
  const isToday = getDateKey(selectedDate) >= getDateKey(today);
  if (nextDateBtn) {
    nextDateBtn.disabled = isToday;
  }
}

// initialize when popup opens
loadTheme();
loadDateData();
updateDateDisplay();

// date navigation buttons
const prevDateBtn = document.getElementById("prev-date");
const nextDateBtn = document.getElementById("next-date");

prevDateBtn?.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() - 1);
  loadDateData();
  updateDateDisplay();
});

nextDateBtn?.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() + 1);
  loadDateData();
  updateDateDisplay();
});

// settings button
const settingsBtn = document.getElementById("settings-btn");
settingsBtn?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
});

// listen for storage changes and update UI
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (changes.theme) {
      loadTheme();
      loadDateData(); // reload to update chart border color
    } else {
      // only reload if the changed key matches our selected date
      const selectedKey = getDateKey(selectedDate);
      if (changes[selectedKey]) {
        loadDateData();
      }
    }
  }
});

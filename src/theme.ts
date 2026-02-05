export type Theme = "light" | "dark" | "system";

// check what theme the system is using
function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// load saved theme from storage and apply it
export async function loadTheme() {
  const result = await chrome.storage.local.get("theme");
  const theme: Theme = (result.theme as Theme) || "system";
  applyTheme(theme);
  updateThemeIcon(theme);
}

// apply the theme to the page
export function applyTheme(theme: Theme) {
  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;
  document.body.setAttribute("data-theme", effectiveTheme);
}

// update which icon is shown in the theme toggle button
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

// cycle through themes: light -> dark -> system -> light
export async function cycleTheme() {
  const result = await chrome.storage.local.get("theme");
  const currentTheme: Theme = (result.theme as Theme) || "system";
  
  const themes: Theme[] = ["light", "dark", "system"];
  const currentIndex = themes.indexOf(currentTheme);
  const nextTheme = themes[(currentIndex + 1) % themes.length];

  await chrome.storage.local.set({ theme: nextTheme });
  applyTheme(nextTheme);
  updateThemeIcon(nextTheme);
}

// get the current active theme (light or dark)
export function getCurrentTheme(): "light" | "dark" {
  return document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

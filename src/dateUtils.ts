// format seconds into a human readable string
export function formatTime(seconds: number): string {
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

// get date in YYYY-MM-DD format (for storage keys)
export function getDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

// format date for display (shows "Today", "Yesterday", or actual date)
export function formatDateDisplay(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateKey = getDateKey(date);
  const todayKey = getDateKey(today);
  const yesterdayKey = getDateKey(yesterday);
  
  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined 
  });
}

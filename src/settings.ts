import { loadTheme, applyTheme } from './utils/theme.js';

// dialog system (custom built)
function showDialog(title: string, message: string, isDanger: boolean = false): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('custom-dialog');
    const dialogTitle = document.getElementById('dialog-title');
    const dialogMessage = document.getElementById('dialog-message');
    const confirmBtn = document.getElementById('dialog-confirm');
    const cancelBtn = document.getElementById('dialog-cancel');

    if (!overlay || !dialogTitle || !dialogMessage || !confirmBtn || !cancelBtn) {
      resolve(false);
      return;
    }

    // set content
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;

    // apply danger styling if needed
    if (isDanger) {
      confirmBtn.classList.add('danger');
    } else {
      confirmBtn.classList.remove('danger');
    }

    // show dialog
    overlay.style.display = 'flex';

    // handle confirm
    const handleConfirm = () => {
      overlay.style.display = 'none';
      cleanup();
      resolve(true);
    };

    // handle cancel
    const handleCancel = () => {
      overlay.style.display = 'none';
      cleanup();
      resolve(false);
    };

    // cleanup listeners
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      overlay.removeEventListener('click', handleOverlayClick);
    };

    // close on overlay click
    const handleOverlayClick = (e: MouseEvent) => {
      if (e.target === overlay) {
        handleCancel();
      }
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
  });
}

// notification system
function showNotification(type: 'success' | 'error' | 'info', title: string, message: string) {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // icon based on type
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>`;
  } else {
    iconSvg = `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>`;
  }

  notification.innerHTML = `
    ${iconSvg}
    <div class="notification-content">
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const closeBtn = notification.querySelector('.notification-close');
  closeBtn?.addEventListener('click', () => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  });

  container.appendChild(notification);

  // auto-dismiss after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

// initialize settings page
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await loadCurrentSettings();
  setupThemeOptions();
  setupActionButtons();
});

// load current settings from storage
async function loadCurrentSettings() {
  const result = await chrome.storage.local.get(['theme']);
  const currentTheme = (result.theme as string) || 'system';

  // highlight active theme
  document.querySelectorAll('.theme-option').forEach(btn => {
    const theme = btn.getAttribute('data-theme');
    if (theme === currentTheme) {
      btn.classList.add('active');
    }
  });
}

// setup theme option buttons
function setupThemeOptions() {
  document.querySelectorAll('.theme-option').forEach(button => {
    button.addEventListener('click', async () => {
      const theme = button.getAttribute('data-theme') as 'light' | 'dark' | 'system';
      
      // Update active state
      document.querySelectorAll('.theme-option').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Save and apply theme
      await chrome.storage.local.set({ theme });
      await applyTheme(theme);
      
      // Add visual feedback
      button.classList.add('saved');
      setTimeout(() => button.classList.remove('saved'), 300);
    });
  });
}

// setup action buttons (import, export, reset)
function setupActionButtons() {
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file') as HTMLInputElement;
  const exportBtn = document.getElementById('export-btn');
  const resetBtn = document.getElementById('reset-btn');

  // Import data
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => {
      importFile.click();
    });

    importFile.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedData = JSON.parse(text);

        // Count how many date entries will be imported
        let dateCount = 0;
        for (const key of Object.keys(importedData)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            dateCount++;
          }
        }

        if (dateCount === 0) {
          showNotification('error', 'Invalid File', 'No valid browsing data found in file');
          return;
        }

        // show confirmation dialog
        const confirmed = await showDialog(
          'Import Data',
          `Found ${dateCount} day(s) of browsing data.\nThis will OVERWRITE any existing data for those dates.\n\nContinue with import?`,
          false
        );

        if (!confirmed) {
          importFile.value = ''; // Reset file input
          return;
        }

        // get current data
        const currentData = await chrome.storage.local.get(null);

        // merge imported data (overwriting existing)
        const mergedData = { ...currentData };
        for (const [key, value] of Object.entries(importedData)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            mergedData[key] = value;
          }
        }

        // save merged data
        await chrome.storage.local.clear();
        await chrome.storage.local.set(mergedData);

        // reset file input
        importFile.value = '';

        // show success notification
        showNotification('success', 'Import Successful', `Imported ${dateCount} day(s) of data`);
      } catch (error) {
        console.error('Import failed:', error);
        showNotification('error', 'Import Failed', 'Invalid JSON file or corrupted data');
        importFile.value = ''; // reset file input
      }
    });
  }

  // export data
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const data = await chrome.storage.local.get(null);
        
        // filter out settings, keep only date-keyed data
        const exportData: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
          // Date keys are in YYYY-MM-DD format
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            exportData[key] = value;
          }
        }

        if (Object.keys(exportData).length === 0) {
          showNotification('info', 'No Data', 'No browsing data available to export');
          return;
        }
        
        // create JSON blob and download
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
          type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meter-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Export failed:', error);
        showNotification('error', 'Export Failed', 'Could not export data');
      }
    });
  }

  // reset data
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const confirmed = await showDialog(
        'RESET ALL DATA',
        'This will permanently delete ALL tracked browsing data. This action CANNOT be undone.\nTip: Consider exporting your data first using the Export button above.\n\nDo you want to continue?',
        true
      );
      
      if (!confirmed) return;

      // double confirmation for reset
      const doubleConfirm = await showDialog(
        'Are you absolutely sure?',
        'Click OK to permanently delete all data.\nClick Cancel to go back.',
        true
      );

      if (!doubleConfirm) return;

      try {
        const data = await chrome.storage.local.get(null);
        
        // find all date-keyed entries to remove
        const keysToRemove: string[] = [];
        for (const key of Object.keys(data)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            keysToRemove.push(key);
          }
        }

        if (keysToRemove.length === 0) {
          showNotification('info', 'No Data', 'No browsing data found to reset');
          return;
        }
        
        // remove all date data
        await chrome.storage.local.remove(keysToRemove);
        
        // show success notification
        showNotification('success', 'Data Reset', `Deleted ${keysToRemove.length} day(s) of browsing data`);
      } catch (error) {
        console.error('Reset failed:', error);
        showNotification('error', 'Reset Failed', 'Could not reset data');
      }
    });
  }
}

// listen for changes from other tabs/popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.theme) {
    const newTheme = changes.theme.newValue as 'light' | 'dark' | 'system';
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === newTheme);
    });
    applyTheme(newTheme);
  }
});

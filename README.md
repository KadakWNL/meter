## Meter
Meter will help you track your browsing time daily and be more productive :>


## Setup & Installation

### Prerequisites
- Node.js (for TypeScript compilation)
- Chrome/Chromium-based browser

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/KadakWNL/meter.git
   cd meter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile TypeScript to JavaScript**
   ```bash
   npm run build
   ```
   
   Or for development with auto-compilation:
   ```bash
   npm run dev
   ```

4. **Load the extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `Meter` folder
   - The extension icon should appear in your toolbar!



## Available Scripts

- `npm run build` - Compile TypeScript once
- `npm run dev` - Watch mode (auto-compiles on save)

## Making Changes

1. Edit `.ts` files in the `src/` folder
2. TypeScript compiles to `.js` in the `dist/` folder
3. Reload the extension in Chrome:
   - Go to `chrome://extensions/`
   - Click the reload icon on the Meter extension

## Inside Stuff

1. **Background Tracking**: The service worker (`background.ts`) tracks:
   - Active tab changes
   - URL updates
   - Window focus/blur
   - Saves data every 10 seconds

2. **Data Storage**: Uses `chrome.storage.local` with date-keyed entries:
   ```json
   {
     "2026-02-05": {
       "youtube.com": 3600,
       "github.com": 1200
     }
   }
   ```

3. **Popup UI**: Shows chart and list for the selected date

## Tech Stack

- **TypeScript**: Type-safe development
- **Chart.js**: Beautiful doughnut charts
- **Chrome Extension Manifest V3**: Modern extension APIs
- **CSS Custom Properties**: Dynamic theming

## Contributing

Feel free to open issues or submit PRs! 
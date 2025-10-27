# Fast Bookmarks

A Chrome extension that provides quick access to your bookmarks through a keyboard-driven overlay menu.

## Features

- **Keyboard-Driven Navigation**: Press `Alt+K` to open the bookmark menu
- **Tab Key Cycling**: Use Tab to cycle through bookmarks
- **Quick Selection**: Press Enter to navigate to the selected bookmark
- **Visual Feedback**: Clean, modern overlay with smooth transitions

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the directory containing the extension files

## Usage

1. Press `Alt+K` while browsing any website
2. Use `Tab` to cycle through your bookmarks
3. Press `Enter` to navigate to the selected bookmark in the current tab
4. Press `Esc` to close the menu without navigating

## File Structure

```
.
├── manifest.json       # Extension configuration
├── background.js       # Service worker for handling commands
├── content.js         # Content script for overlay UI
├── overlay.css        # Styling for the overlay
├── icons/             # Extension icons
└── README.md          # This file
```

## Development

The extension uses Chrome's Manifest V3 API with:
- `bookmarks` permission to access bookmarks
- `activeTab` permission to interact with current tab
- `commands` permission for keyboard shortcuts

## Future Enhancements

- Filter bookmarks by typing
- Configurable keyboard shortcuts
- Bookmark folders support
- Recent bookmarks display
- Custom styling options


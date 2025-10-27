// Background service worker for Fast Bookmarks

// Listen for keyboard command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-bookmark-menu') {
    handleToggleMenu();
  }
});

// Handle menu toggle
async function handleToggleMenu() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      console.error('No active tab found');
      return;
    }

    // Check if tab URL exists and is valid
    if (!tab.url) {
      return; // Silently fail
    }

    // Check if tab is showing a restricted page (but allow new tab and error pages)
    const restrictedPatterns = [
      'chrome://extensions',
      'chrome://settings',
      'edge://',
      'about:',
      'view-source:',
      'data:'
    ];
    
    if (restrictedPatterns.some(pattern => tab.url.startsWith(pattern))) {
      return; // Silently fail
    }

    // Fetch all bookmarks
    const bookmarks = await fetchAllBookmarks();
    
    // Try to send message to content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'showOverlay',
      bookmarks: bookmarks
    }).catch(async (error) => {
      // Content script not ready, inject it first
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['overlay.css']
        });
        
        // Give it a moment to initialize
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showOverlay',
            bookmarks: bookmarks
          });
        }, 100);
      } catch (injectionError) {
        // Silently fail - Chrome restricts some pages for security
      }
    });
  } catch (error) {
    console.error('Error showing bookmark menu:', error);
  }
}

// Fetch all bookmarks and flatten the tree
async function fetchAllBookmarks() {
  const bookmarkTree = await chrome.bookmarks.getTree();
  const bookmarks = [];
  
  function flattenBookmarks(nodes) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push({
          id: node.id,
          title: node.title,
          url: node.url
        });
      }
      if (node.children) {
        flattenBookmarks(node.children);
      }
    }
  }
  
  flattenBookmarks(bookmarkTree);
  return bookmarks;
}

// Listen for navigation requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'navigate') {
    chrome.tabs.update(sender.tab.id, { url: request.url });
    sendResponse({ success: true });
  } else if (request.action === 'navigateNewTab') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
  }
  return true;
});


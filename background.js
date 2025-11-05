// Background service worker for Fast Bookmarks

// Log immediately when script loads
console.log('Fast Bookmarks: Background script loaded');

// Listen for keyboard command
console.log('Fast Bookmarks: Command listener registered');
chrome.commands.onCommand.addListener((command) => {
  console.log('Fast Bookmarks: Command received:', command);
  if (command === 'toggle-bookmark-menu') {
    console.log('Fast Bookmarks: Calling handleToggleMenu');
    handleToggleMenu();
  }
});

// Handle menu toggle
async function handleToggleMenu() {
  console.log('Fast Bookmarks: handleToggleMenu called');
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Fast Bookmarks: Active tab:', tab?.url, tab?.id);
    
    if (!tab || !tab.id) {
      console.error('No active tab found');
      return;
    }

    // Check if tab URL exists and is valid
    if (!tab.url) {
      console.log('Fast Bookmarks: Tab has no URL');
      return; // Silently fail
    }

    // Check if tab is showing a restricted page - if so, open overlay.html instead
    const isRestrictedUrl = (url) =>
      !url || url.startsWith('chrome://') || url.startsWith('edge://') ||
      url.startsWith('about:') || url.startsWith('view-source:') ||
      url.startsWith('data:');
    
    console.log('Fast Bookmarks: Checking if restricted:', tab.url, 'Result:', isRestrictedUrl(tab.url));
    
    if (isRestrictedUrl(tab.url)) {
      // Open overlay in extension page instead of trying to inject
      const overlayUrl = chrome.runtime.getURL('overlay.html');
      console.log('Fast Bookmarks: Opening overlay.html at:', overlayUrl);
      await chrome.tabs.create({ url: overlayUrl });
      console.log('Fast Bookmarks: Overlay tab created');
      return;
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
        // Injection failed - fallback to overlay.html
        try {
          await chrome.tabs.create({ url: chrome.runtime.getURL('overlay.html') });
        } catch (fallbackError) {
          // Silently fail - Chrome restricts some pages for security
        }
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

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'navigate') {
    chrome.tabs.update(sender.tab.id, { url: request.url });
    sendResponse({ success: true });
  } else if (request.action === 'navigateNewTab') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
  } else if (request.action === 'requestBookmarks') {
    // Handle bookmark request from overlay.html
    fetchAllBookmarks().then((bookmarks) => {
      sendResponse({ bookmarks });
    }).catch((error) => {
      sendResponse({ bookmarks: [] });
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'overlayClosed') {
    // Close overlay.html tab when user dismisses overlay
    if (sender?.tab?.id && sender?.url?.includes('overlay.html')) {
      chrome.tabs.remove(sender.tab.id);
      sendResponse({ success: true });
    }
    return true;
  }
  return true;
});


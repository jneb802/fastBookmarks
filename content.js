// Content script for Fast Bookmarks

// Detect if we're running in the extension overlay page
const isExtensionOverlayPage = location.protocol === 'chrome-extension:' && location.pathname.endsWith('/overlay.html');

let overlay = null;
let currentIndex = 0;
let allBookmarks = [];
let filteredBookmarks = [];
let searchQuery = '';
let isOverlayVisible = false;
let showResults = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showOverlay') {
    showOverlay(request.bookmarks);
    sendResponse({ success: true });
  }
  return true;
});

// Show the overlay with bookmarks
function showOverlay(bookmarks) {
  allBookmarks = bookmarks;
  filteredBookmarks = bookmarks;
  searchQuery = '';
  currentIndex = 0;
  isOverlayVisible = true;
  showResults = false;

  // Remove existing overlay if present
  if (overlay) {
    overlay.remove();
  }

  // Create overlay element
  overlay = document.createElement('div');
  overlay.id = 'bookmark-navigator-overlay';
  
  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  backdrop.addEventListener('click', closeOverlay);
  
  // Create menu container
  const menu = document.createElement('div');
  menu.className = 'menu';
  
  // Create search bar
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Search bookmarks...';
  searchInput.value = searchQuery;
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    showResults = true;
    filterBookmarks();
    currentIndex = 0;
    renderBookmarks();
    updateSelection();
  });
  
  searchContainer.appendChild(searchInput);
  menu.appendChild(searchContainer);
  
  // Create bookmark list container
  const list = document.createElement('div');
  list.className = 'bookmark-list';
  list.id = 'bookmark-list';
  menu.appendChild(list);
  
  overlay.appendChild(backdrop);
  overlay.appendChild(menu);
  document.body.appendChild(overlay);
  
  // Focus search input
  searchInput.focus();
  
  // Add keyboard event listeners with capture to intercept before other handlers
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
}

// Filter bookmarks based on search query
function filterBookmarks() {
  if (searchQuery.trim() === '') {
    filteredBookmarks = allBookmarks;
  } else {
    const lowerQuery = searchQuery.toLowerCase();
    filteredBookmarks = allBookmarks.filter(bookmark => 
      bookmark.title.toLowerCase().includes(lowerQuery) || 
      bookmark.url.toLowerCase().includes(lowerQuery)
    );
  }
}

// Render bookmarks in list
function renderBookmarks() {
  const list = document.getElementById('bookmark-list');
  
  if (!showResults || filteredBookmarks.length === 0) {
    list.style.display = 'none';
    return;
  }
  
  list.style.display = 'block';
  list.innerHTML = '';
  
  filteredBookmarks.forEach((bookmark, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'bookmark-item';
    itemElement.dataset.index = index;
    
    const icon = document.createElement('img');
    icon.className = 'item-icon';
    // Extract domain for favicon
    try {
      const domain = new URL(bookmark.url).hostname;
      icon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (e) {
      icon.src = '';
    }
    icon.alt = '';
    icon.onerror = function() {
      // Fallback to emoji if favicon fails to load
      this.style.display = 'none';
      const fallback = document.createElement('span');
      fallback.className = 'item-icon';
      fallback.textContent = '🔖';
      this.parentNode.insertBefore(fallback, this);
    };
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'item-content';
    
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = bookmark.title;
    
    const url = document.createElement('div');
    url.className = 'item-url';
    url.textContent = bookmark.url;
    
    contentWrapper.appendChild(title);
    contentWrapper.appendChild(url);
    
    itemElement.appendChild(icon);
    itemElement.appendChild(contentWrapper);
    
    // Add click handler
    itemElement.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey) {
        navigateToBookmarkNewTab(bookmark.url);
      } else {
        navigateToBookmark(bookmark.url);
      }
    });
    
    list.appendChild(itemElement);
  });
}

// Handle keyboard input
function handleKeyDown(event) {
  if (!isOverlayVisible) return;
  
  // STOP ALL EVENTS FROM REACHING THE PAGE IMMEDIATELY
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  const searchInput = document.querySelector('.search-input');
  
  // Allow typing in search input (but still blocked from reaching page)
  if (document.activeElement === searchInput) {
    if ((event.key.length === 1 || event.key === 'Backspace') && !event.metaKey && !event.ctrlKey && !event.altKey) {
      return; // Let the input handle it naturally
    }
  }
  
  // Now prevent default for navigation keys
  const handledKeys = ['Tab', 'ArrowDown', 'ArrowUp', 'Enter', 'Escape'];
  if (handledKeys.includes(event.key)) {
    event.preventDefault();
  }
  
  switch (event.key) {
    case 'Tab':
      if (!showResults) {
        showResults = true;
        filterBookmarks();
        renderBookmarks();
        updateSelection();
      } else if (filteredBookmarks.length > 0) {
        if (event.shiftKey) {
          // Shift+Tab goes up
          currentIndex = (currentIndex - 1 + filteredBookmarks.length) % filteredBookmarks.length;
        } else {
          // Tab goes down
          currentIndex = (currentIndex + 1) % filteredBookmarks.length;
        }
        updateSelection();
      }
      break;
      
    case 'ArrowDown':
      if (!showResults) {
        showResults = true;
        filterBookmarks();
        renderBookmarks();
      }
      if (filteredBookmarks.length > 0) {
        currentIndex = (currentIndex + 1) % filteredBookmarks.length;
        updateSelection();
      }
      break;
      
    case 'ArrowUp':
      if (!showResults) {
        showResults = true;
        filterBookmarks();
        renderBookmarks();
      }
      if (filteredBookmarks.length > 0) {
        currentIndex = (currentIndex - 1 + filteredBookmarks.length) % filteredBookmarks.length;
        updateSelection();
      }
      break;
      
    case 'Enter':
      if (!showResults) {
        showResults = true;
        filterBookmarks();
        renderBookmarks();
        updateSelection();
      } else if (filteredBookmarks[currentIndex]) {
        const bookmark = filteredBookmarks[currentIndex];
        if (event.metaKey || event.ctrlKey) {
          navigateToBookmarkNewTab(bookmark.url);
        } else {
          navigateToBookmark(bookmark.url);
        }
      }
      break;
      
    case 'Escape':
      closeOverlay();
      break;
      
    case 'Backspace':
      // Handled above - backspace works normally in search
      break;
  }
}

// Handle keyup to prevent page from receiving events
function handleKeyUp(event) {
  if (!isOverlayVisible) return;
  event.stopPropagation();
  event.stopImmediatePropagation();
}

// Update visual selection
function updateSelection() {
  const items = overlay.querySelectorAll('.bookmark-item');
  items.forEach((item, index) => {
    if (index === currentIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// Navigate to selected bookmark
function navigateToBookmark(url) {
  chrome.runtime.sendMessage({
    action: 'navigate',
    url: url
  });
  // Only close overlay if not in extension overlay page (that tab will navigate)
  if (!isExtensionOverlayPage) {
    closeOverlay();
  }
}

// Navigate to selected bookmark in new tab
function navigateToBookmarkNewTab(url) {
  chrome.runtime.sendMessage({
    action: 'navigateNewTab',
    url: url
  });
  // Close overlay tab when opened from overlay.html
  if (isExtensionOverlayPage) {
    chrome.runtime.sendMessage({ action: 'overlayClosed' });
  }
  closeOverlay();
}

// Close the overlay
function closeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  isOverlayVisible = false;
  showResults = false;
  allBookmarks = [];
  filteredBookmarks = [];
  searchQuery = '';
  currentIndex = 0;
  
  // Remove keyboard event listeners
  document.removeEventListener('keydown', handleKeyDown, true);
  document.removeEventListener('keyup', handleKeyUp, true);
  
  // If running in overlay.html and user dismissed (Escape/backdrop), close the tab
  if (isExtensionOverlayPage) {
    chrome.runtime.sendMessage({ action: 'overlayClosed' });
  }
}

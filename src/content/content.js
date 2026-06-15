import { startObserver, performScan, setCapturedNetworkUrls } from './observer.js';
import { MESSAGE_TYPES } from './constants.js';

const localNetworkUrls = [];

// Helper to safely send messages and detect context invalidation
function safeSendMessage(message) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    try {
      chrome.runtime.sendMessage(message, () => {
        // Accessing lastError suppresses "Uncaught (in promise) Error" if no listener is present
        const err = chrome.runtime.lastError;
      });
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

const cleanUrlForMatching = (url) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname.toLowerCase();
    
    if (parsed.hostname.includes('googlevideo.com') || pathname.includes('/videoplayback')) {
      const idParam = parsed.searchParams.get('id');
      return `${parsed.origin}${pathname}?id=${idParam || ''}`.toLowerCase();
    }
    
    pathname = pathname.replace(/\.(m3u8|mp4|webm|mpd|ts|mov|m4v|3gp)$/i, '');
    pathname = pathname.replace(/[-_](\d+w|\d+p|\d+k|hls|master|preview)(_?\d+)?$/i, '');
    
    return (parsed.origin + pathname).toLowerCase();
  } catch (e) {
    let clean = url.split('?')[0].split('#')[0].toLowerCase();
    clean = clean.replace(/\.(m3u8|mp4|webm|mpd|ts|mov|m4v|3gp)$/i, '');
    clean = clean.replace(/[-_](\d+w|\d+p|\d+k|hls|master|preview)(_?\d+)?$/i, '');
    return clean;
  }
};

const processPageVideos = (videos) => {
  let hasNew = false;
  if (!window.clipnetMetadataRegistry) {
    window.clipnetMetadataRegistry = {};
  }
  videos.forEach(item => {
    if (!item) return;
    const url = typeof item === 'string' ? item : item.url;
    if (typeof item === 'object' && item.url) {
      const cleanKey = cleanUrlForMatching(item.url);
      window.clipnetMetadataRegistry[cleanKey] = {
        title: item.title,
        thumbnail: item.thumbnail
      };
    }
    if (!localNetworkUrls.includes(url)) {
      localNetworkUrls.push(url);
      hasNew = true;
    }
  });
  if (hasNew) {
    setCapturedNetworkUrls(localNetworkUrls);
  }
  return hasNew;
};

let cleanupObserver = null;

// Start observing page changes and save results to cache in background
cleanupObserver = startObserver((media) => {
  const success = safeSendMessage({
    type: 'saveMedia',
    payload: media
  });
  if (!success && cleanupObserver) {
    cleanupObserver();
    cleanupObserver = null;
  }
});

// Listen for message actions
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Check context validity inside listeners
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      return false;
    }

    if (request.type === 'spaNavigation') {
      localNetworkUrls.length = 0;
      setCapturedNetworkUrls([]);
      window.clipnetMetadataRegistry = {};
      
      chrome.runtime.sendMessage({ type: 'getPageVideos' }, (response) => {
        if (chrome.runtime.lastError) return;
        const extraUrls = (response && response.videos) || [];
        processPageVideos(extraUrls);
        performScan((media) => {
          safeSendMessage({
            type: 'saveMedia',
            payload: media
          });
        });
      });
      return false;
    }

    // Support both legacy 'getVideos' and new 'getMedia' message calls
    if (request.type === MESSAGE_TYPES.GET_MEDIA || request.type === 'getVideos') {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ type: 'getPageVideos' }, (response) => {
          const extraUrls = (response && response.videos) || [];
          processPageVideos(extraUrls);

          performScan((media) => {
            sendResponse({ media, videos: media.videos });
          });
        });
        return true; // keep channel open for async response
      } else {
        performScan((media) => {
          sendResponse({ media, videos: media.videos });
        });
        return true;
      }
    }

    if (request.type === MESSAGE_TYPES.FOUND_MEDIA) {
      const { url } = request.payload;
      if (!localNetworkUrls.includes(url)) {
        localNetworkUrls.push(url);
        setCapturedNetworkUrls(localNetworkUrls);
        
        // Perform scan and push update
        performScan((media) => {
          safeSendMessage({
            type: 'saveMedia',
            payload: media
          });
        });
      }
    }
    return false;
  });
}

// At startup, immediately fetch page-specific Redux state videos (e.g. Pinterest)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  try {
    chrome.runtime.sendMessage({ type: 'getPageVideos' }, (response) => {
      if (chrome.runtime.lastError) return;
      const extraUrls = (response && response.videos) || [];
      const hasNew = processPageVideos(extraUrls);
      if (hasNew) {
        performScan((media) => {
          safeSendMessage({
            type: 'saveMedia',
            payload: media
          });
        });
      }
    });
  } catch (e) {
    // Suppress errors during tab startup/disconnect transitions
  }
}


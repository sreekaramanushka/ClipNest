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

    // Support both legacy 'getVideos' and new 'getMedia' message calls
    if (request.type === MESSAGE_TYPES.GET_MEDIA || request.type === 'getVideos') {
      performScan((media) => {
        sendResponse({ media, videos: media.videos });
      });
      return true; // keep channel open for async response
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


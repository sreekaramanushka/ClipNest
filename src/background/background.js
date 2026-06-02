// background.js – service worker for managing media cache and webRequest monitoring

const capturedUrlsByTab = {};

// Register DNR rules to modify headers for Pinterest CDN (enables bypass of CORS & Referer blocks)
const PINTEREST_RULE_ID = 1001;

function setupDNRRules() {
  if (chrome.declarativeNetRequest) {
    const rules = [
      {
        id: PINTEREST_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Referer', operation: 'set', value: 'https://www.pinterest.com/' }
          ],
          responseHeaders: [
            { header: 'Access-Control-Allow-Origin', operation: 'set', value: '*' },
            { header: 'Access-Control-Allow-Methods', operation: 'set', value: 'GET, HEAD, OPTIONS' },
            { header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' }
          ]
        },
        condition: {
          requestDomains: ['pinimg.com', 'pinterest.com'],
          resourceTypes: ['xmlhttprequest', 'media', 'other']
        }
      }
    ];

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [PINTEREST_RULE_ID],
      addRules: rules
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to update declarativeNetRequest rules:", chrome.runtime.lastError.message);
      } else {
        console.log("ClipNet CORS/Referer rules registered successfully.");
      }
    });
  }
}

// Setup rules on load
setupDNRRules();
chrome.runtime.onInstalled.addListener(() => {
  setupDNRRules();
});
chrome.runtime.onStartup.addListener(() => {
  setupDNRRules();
});

// Listener for storage and messaging actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'download') {
    const { url, filename } = message.payload;
    chrome.downloads.download({ url, filename }, downloadId => {
      if (chrome.runtime.lastError) {
        console.error('Download error:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true; // async response flag
  }
  
  if (message.type === 'saveMedia') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      chrome.storage.local.set({ [`media_cache_${tabId}`]: message.payload });
    }
    return false;
  }

  if (message.type === 'getCapturedVideos') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId && capturedUrlsByTab[tabId]) {
      sendResponse({ videos: capturedUrlsByTab[tabId] });
    } else {
      sendResponse({ videos: [] });
    }
    return false;
  }

  if (message.type === 'getPageVideos') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
      sendResponse({ videos: [] });
      return false;
    }

    // Execute script in the MAIN world of the tab to safely read window.__PWS_DATA__ and window.initialReduxState (bypassing CSP)
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const data = window.__PWS_DATA__ || window.initialReduxState;
        if (!data) return [];
        const urls = [];
        function find(obj) {
          if (!obj) return;
          if (typeof obj === 'string') {
            const lower = obj.toLowerCase();
            if (obj.startsWith('http') && 
                !obj.startsWith('blob:') &&
                (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.m3u8') || lower.includes('.mpd') || lower.includes('v.pinimg.com/videos/'))) {
              if (!urls.includes(obj)) urls.push(obj);
            }
          } else if (Array.isArray(obj)) {
            obj.forEach(find);
          } else if (typeof obj === 'object') {
            for (const k in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, k)) find(obj[k]);
            }
          }
        }
        find(data);
        return urls;
      }
    }).then(results => {
      const urls = (results && results[0]?.result) || [];
      sendResponse({ videos: urls });
    }).catch(err => {
      console.error("ClipNet scripting execution error:", err);
      sendResponse({ videos: [] });
    });
    return true; // Keep message channel open
  }
  return false;
});

// webRequest listener for catching media URLs, streams, and players
chrome.webRequest.onCompleted.addListener(
  details => {
    const { url, type, tabId } = details;
    if (tabId < 0) return; // Ignore requests not associated with a tab
    
    const lowerUrl = url.toLowerCase();
    const isMediaUrl = 
      lowerUrl.includes('.mp4') || 
      lowerUrl.includes('.webm') || 
      lowerUrl.includes('.m3u8') || 
      lowerUrl.includes('.mpd') ||
      lowerUrl.includes('.mp3') || 
      lowerUrl.includes('.wav') || 
      lowerUrl.includes('.aac') || 
      lowerUrl.includes('.ogg') || 
      lowerUrl.includes('.flac') ||
      lowerUrl.includes('.m4a') ||
      lowerUrl.includes('v.pinimg.com/videos/') ||
      type === 'media';
                       
    if (isMediaUrl) {
      if (!capturedUrlsByTab[tabId]) {
        capturedUrlsByTab[tabId] = [];
      }
      if (!capturedUrlsByTab[tabId].includes(url)) {
        capturedUrlsByTab[tabId].push(url);
        // Alert the content script that a new network media url was found
        chrome.tabs.sendMessage(tabId, { type: 'foundMedia', payload: { url } }).catch(err => {
          // Ignore error if tab content script is not loaded
        });
      }
    }
  },
  { urls: ['<all_urls>'] }
);

// Clean up tab cache and logs on closure/updates
chrome.tabs.onRemoved.addListener(tabId => {
  delete capturedUrlsByTab[tabId];
  chrome.storage.local.remove(`media_cache_${tabId}`);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    delete capturedUrlsByTab[tabId];
    chrome.storage.local.remove(`media_cache_${tabId}`);
  }
});

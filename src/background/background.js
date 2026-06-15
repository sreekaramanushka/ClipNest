// background.js – service worker for managing media cache and webRequest monitoring

const capturedUrlsByTab = {};

function getExtensionFromUrl(url) {
  if (!url) return '.mp4';
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('.mp3') || lowerUrl.includes('mime=audio')) return '.mp3';
  if (lowerUrl.includes('.wav')) return '.wav';
  if (lowerUrl.includes('.aac')) return '.aac';
  if (lowerUrl.includes('.ogg')) return '.ogg';
  if (lowerUrl.includes('.flac')) return '.flac';
  if (lowerUrl.includes('.m4a')) return '.m4a';
  if (lowerUrl.includes('.opus')) return '.opus';
  
  if (lowerUrl.includes('.m3u8')) return '.m3u8';
  if (lowerUrl.includes('.mpd')) return '.mpd';
  if (lowerUrl.includes('.webm') || lowerUrl.includes('mime=video%2fwebm') || lowerUrl.includes('mime=video/webm')) return '.webm';
  
  if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) return '.jpg';
  if (lowerUrl.includes('.png')) return '.png';
  if (lowerUrl.includes('.gif')) return '.gif';
  if (lowerUrl.includes('.webp')) return '.webp';
  if (lowerUrl.includes('.svg')) return '.svg';
  
  const cleanUrl = url.split('?')[0].split('#')[0];
  const lastDot = cleanUrl.lastIndexOf('.');
  if (lastDot !== -1) {
    const suffix = cleanUrl.slice(lastDot).toLowerCase();
    if (suffix.length <= 5 && /^\.[a-z0-9]+$/.test(suffix)) {
      return suffix;
    }
  }
  
  return '.mp4';
}

function sanitizeFilename(filename, url) {
  if (!filename || typeof filename !== 'string') {
    filename = 'download';
  }
  
  const lastDotIndex = filename.lastIndexOf('.');
  let name = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;
  let ext = lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';
  
  const extClean = ext.replace('.', '').trim().toLowerCase();
  const isValidExt = extClean && extClean.length <= 5 && /^[a-z0-9]+$/.test(extClean);
  
  if (!isValidExt) {
    if (ext) {
      name = name + ext;
    }
    ext = getExtensionFromUrl(url);
  }

  // Override HLS/DASH manifest extensions to MP4 so they save as playable video files
  const finalExtClean = ext.replace('.', '').trim().toLowerCase();
  if (finalExtClean === 'm3u8' || finalExtClean === 'mpd') {
    ext = '.mp4';
  }
  
  name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
             .replace(/[^a-zA-Z0-9\s\-_().,]/g, '')
             .replace(/\s+/g, ' ')
             .trim();
             
  if (name.length > 60) {
    name = name.slice(0, 60).trim();
  }
  
  if (!name) {
    name = 'download';
  }
  
  return name + ext;
}

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
    const safeFilename = sanitizeFilename(filename, url);
    chrome.downloads.download({ url, filename: safeFilename }, downloadId => {
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
        const results = [];
        const visited = new Set();
        
        // Recursive heuristic scanner to locate objects containing both video stream URLs and image cover URLs
        const scanHeuristics = (node) => {
          if (!node || typeof node !== 'object') return;
          if (visited.has(node)) return;
          visited.add(node);
          
          const videoUrls = [];
          const imageUrls = [];
          let title = '';

          const collect = (subNode) => {
            if (!subNode || typeof subNode !== 'object') return;
            for (const key in subNode) {
              try {
                const val = subNode[key];
                if (typeof val === 'string') {
                  const valLower = val.toLowerCase();
                  if (val.startsWith('http')) {
                    if (valLower.includes('.m3u8') || valLower.includes('.mp4') || valLower.includes('v.pinimg.com/videos/')) {
                      if (!videoUrls.includes(val)) videoUrls.push(val);
                    } else if (valLower.includes('.jpg') || valLower.includes('.png') || valLower.includes('i.pinimg.com/')) {
                      if (!imageUrls.includes(val)) imageUrls.push(val);
                    }
                  } else if ((key === 'title' || key === 'description' || key === 'grid_title') && val.trim().length > 0) {
                    if (!title) title = val.trim();
                  }
                } else if (val && typeof val === 'object') {
                  if (val.url && typeof val.url === 'string') {
                    const urlLower = val.url.toLowerCase();
                    if (urlLower.includes('.m3u8') || urlLower.includes('.mp4') || urlLower.includes('v.pinimg.com/videos/')) {
                      if (!videoUrls.includes(val.url)) videoUrls.push(val.url);
                    } else if (urlLower.includes('.jpg') || urlLower.includes('.png') || urlLower.includes('i.pinimg.com/')) {
                      if (!imageUrls.includes(val.url)) imageUrls.push(val.url);
                    }
                  }
                  collect(val);
                }
              } catch (e) {}
            }
          };

          // Heuristic: If this node has a property 'videos' or looks like a Pin object, let's collect properties
          const isPinNode = node.videos || (node.id && node.type === 'pin');
          if (isPinNode) {
            collect(node);
            if (videoUrls.length > 0) {
              let bestThumbnail = imageUrls[0] || null;
              for (const img of imageUrls) {
                if (img.includes('originals') || img.includes('736x')) {
                  bestThumbnail = img;
                  break;
                }
              }
              
              videoUrls.forEach(vUrl => {
                if (!results.some(r => r.url === vUrl)) {
                  results.push({
                    url: vUrl,
                    title: title,
                    thumbnail: bestThumbnail
                  });
                }
              });
            }
          }

          // Recurse children
          if (Array.isArray(node)) {
            node.forEach(scanHeuristics);
          } else {
            for (const key in node) {
              if (Object.prototype.hasOwnProperty.call(node, key)) {
                scanHeuristics(node[key]);
              }
            }
          }
        };

        // 1. Scan window variables
        const winData = window.__PWS_DATA__ || window.initialReduxState;
        if (winData) {
          scanHeuristics(winData);
        }

        // 2. Scan script tags containing JSON data
        const scripts = document.querySelectorAll('script[type="application/json"]');
        for (const script of scripts) {
          try {
            const text = script.textContent;
            if (text && (text.includes('video_list') || text.includes('v.pinimg.com') || text.includes('pinimg'))) {
              const parsed = JSON.parse(text);
              if (parsed) {
                scanHeuristics(parsed);
              }
            }
          } catch (e) {}
        }

        // Fallback: If no structured items found, run raw string scan over DOM scripts and window objects
        if (results.length === 0) {
          const rawUrls = [];
          const findRaw = (obj) => {
            if (!obj) return;
            if (typeof obj === 'string') {
              const lower = obj.toLowerCase();
              if (obj.startsWith('http') && 
                  !obj.startsWith('blob:') &&
                  (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.m3u8') || lower.includes('.mpd') || lower.includes('v.pinimg.com/videos/'))) {
                if (!rawUrls.includes(obj)) rawUrls.push(obj);
              }
            } else if (Array.isArray(obj)) {
              obj.forEach(findRaw);
            } else if (typeof obj === 'object') {
              for (const k in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, k)) findRaw(obj[k]);
              }
            }
          };
          
          if (winData) findRaw(winData);
          for (const script of scripts) {
            try {
              const text = script.textContent;
              if (text) {
                const parsed = JSON.parse(text);
                if (parsed) findRaw(parsed);
              }
            } catch (e) {}
          }
          return rawUrls.map(url => ({ url, title: '', thumbnail: null }));
        }

        return results;
      }
    }).then(results => {
      const videos = (results && results[0]?.result) || [];
      sendResponse({ videos });
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
      lowerUrl.includes('.opus') ||
      lowerUrl.includes('.ts') ||
      lowerUrl.includes('.m4v') ||
      lowerUrl.includes('.mov') ||
      lowerUrl.includes('v.pinimg.com/videos/') ||
      lowerUrl.includes('googlevideo.com/videoplayback') ||
      lowerUrl.includes('youtube.com/videoplayback') ||
      lowerUrl.includes('mime=audio') ||
      lowerUrl.includes('mime=video') ||
      lowerUrl.includes('mime%3daudio') ||
      lowerUrl.includes('mime%3dvideo') ||
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

// Sniff Content-Type headers for 100% accurate identification of media streams without reliance on extension suffixes
chrome.webRequest.onHeadersReceived.addListener(
  details => {
    const { url, tabId, responseHeaders } = details;
    if (tabId < 0) return;

    if (!responseHeaders) return;
    const contentTypeHeader = responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
    if (contentTypeHeader) {
      const contentType = contentTypeHeader.value.toLowerCase();
      if (contentType.startsWith('audio/') || 
          contentType.startsWith('video/') || 
          contentType === 'application/x-mpegurl' || 
          contentType === 'application/vnd.apple.mpegurl' || 
          contentType === 'application/dash+xml') {
        
        if (!capturedUrlsByTab[tabId]) {
          capturedUrlsByTab[tabId] = [];
        }
        if (!capturedUrlsByTab[tabId].includes(url)) {
          capturedUrlsByTab[tabId].push(url);
          chrome.tabs.sendMessage(tabId, { type: 'foundMedia', payload: { url } }).catch(err => {
            // Ignore error if tab content script is not loaded
          });
        }
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Clean up tab cache and logs on closure/updates
const lastTabUrls = {};

chrome.tabs.onRemoved.addListener(tabId => {
  delete capturedUrlsByTab[tabId];
  delete lastTabUrls[tabId];
  chrome.storage.local.remove(`media_cache_${tabId}`);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const currentUrl = changeInfo.url || tab?.url || '';
  if (!currentUrl) return;

  const lastUrl = lastTabUrls[tabId];
  const urlChanged = lastUrl && lastUrl !== currentUrl;
  
  // Update last known URL
  lastTabUrls[tabId] = currentUrl;

  if (changeInfo.status === 'loading' || urlChanged) {
    if (currentUrl.startsWith('chrome-extension://') || 
        currentUrl.startsWith('chrome://') || 
        currentUrl.startsWith('edge://') || 
        currentUrl.startsWith('about:')) {
      return;
    }

    // Reset captured network URLs for this tab
    delete capturedUrlsByTab[tabId];
    
    // Clear storage cache for this tab
    chrome.storage.local.remove(`media_cache_${tabId}`);
    
    // Inform content script of SPA navigation
    chrome.tabs.sendMessage(tabId, { type: 'spaNavigation', payload: { url: currentUrl } }).catch(err => {
      // Ignore if content script is not yet loaded
    });
  }
});

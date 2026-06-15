import { useState, useEffect, useCallback } from 'react';
import { MESSAGE_TYPES } from '../../shared/constants.js';

export default function useMediaExtractor() {
  const [media, setMedia] = useState({ videos: [], audios: [], images: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTabId, setActiveTabId] = useState(null);

  const loadMediaFromCache = useCallback((tabId) => {
    if (!tabId) return;
    setLoading(true);
    chrome.storage.local.get([`media_cache_${tabId}`], (result) => {
      const cached = result[`media_cache_${tabId}`];
      if (cached) {
        setMedia(cached);
      } else {
        setMedia({ videos: [], audios: [], images: [] });
      }
      setLoading(false);
    });
  }, []);

  const triggerScan = useCallback((tabId) => {
    if (!tabId) return;
    setLoading(true);
    setError(null);

    chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.GET_MEDIA }, (response) => {
      if (chrome.runtime.lastError) {
        // If content script is not loaded, we suggest reloading the page tab
        setError('Connection lost. Please reload the webpage tab to reconnect the extension.');
        setLoading(false);
        return;
      }
      if (response && response.media) {
        setMedia(response.media);
        // Save to cache
        chrome.storage.local.set({ [`media_cache_${tabId}`]: response.media });
      }
      setLoading(false);
    });
  }, []);

  // Handle initial tab activation & activation switches
  useEffect(() => {
    const handleTabChange = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          const tab = tabs[0];
          const url = tab.url || '';
          
          // Ignore extension pages, chrome settings, empty tabs, etc. to prevent false connection errors
          if (url.startsWith('chrome-extension://') || 
              url.startsWith('chrome://') || 
              url.startsWith('edge://') || 
              url.startsWith('about:') || 
              url === '') {
            // Keep the previous activeTabId and its cached media!
            return;
          }

          const tabId = tab.id;
          setActiveTabId(tabId);
          loadMediaFromCache(tabId);
          triggerScan(tabId);
        }
      });
    };

    handleTabChange();

    // Listen to tab activation changes
    chrome.tabs.onActivated.addListener(handleTabChange);
    
    // Listen to tab updates (reloads/navigations)
    const handleTabUpdate = (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tabId === activeTabId) {
        const url = tab?.url || '';
        if (url.startsWith('chrome-extension://') || 
            url.startsWith('chrome://') || 
            url.startsWith('edge://') || 
            url.startsWith('about:') || 
            url === '') {
          return;
        }
        loadMediaFromCache(tabId);
        triggerScan(tabId);
      }
    };
    chrome.tabs.onUpdated.addListener(handleTabUpdate);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange);
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    };
  }, [activeTabId, loadMediaFromCache, triggerScan]);

  // Listen to background cache writes (storage updates) for real-time scrolling updates
  useEffect(() => {
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local' && activeTabId) {
        const key = `media_cache_${activeTabId}`;
        if (changes[key]) {
          setMedia(changes[key].newValue || { videos: [], audios: [], images: [] });
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [activeTabId]);

  const refresh = () => {
    if (activeTabId) {
      triggerScan(activeTabId);
    }
  };

  const reloadTab = () => {
    if (!activeTabId) return;
    setLoading(true);
    setError(null);
    chrome.tabs.reload(activeTabId, {}, () => {
      setTimeout(() => {
        triggerScan(activeTabId);
      }, 1000);
    });
  };

  return { media, loading, error, refresh, reloadTab };
}

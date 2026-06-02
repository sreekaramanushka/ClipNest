import { extractVideos } from './extractVideos.js';
import { extractAudio } from './extractAudio.js';
import { extractImages } from './extractImages.js';

let capturedNetworkUrls = [];
let scanTimeout = null;

export function setCapturedNetworkUrls(urls) {
  capturedNetworkUrls = urls;
}

export function performScan(onNewMedia) {
  const perfUrls = [];
  if (window.performance && window.performance.getEntriesByType) {
    const entries = window.performance.getEntriesByType('resource');
    entries.forEach(e => {
      if (e.name.startsWith('http')) {
        perfUrls.push(e.name);
      }
    });
  }

  const combinedNetwork = Array.from(new Set([...capturedNetworkUrls, ...perfUrls]));

  const videos = extractVideos(combinedNetwork);
  const audios = extractAudio(combinedNetwork);
  const images = extractImages(combinedNetwork);

  onNewMedia({ videos, audios, images });
}

export function startObserver(onNewMedia) {
  const triggerScan = () => {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      performScan(onNewMedia);
    }, 500);
  };

  const observer = new MutationObserver(mutations => {
    let shouldScan = false;
    for (let i = 0; i < mutations.length; i++) {
      const addedNodes = mutations[i].addedNodes;
      if (addedNodes && addedNodes.length > 0) {
        for (let j = 0; j < addedNodes.length; j++) {
          const node = addedNodes[j];
          if (node.nodeType === 1) {
            const tag = node.tagName.toLowerCase();
            if (tag === 'img' || tag === 'video' || tag === 'audio' || tag === 'source' || tag === 'picture' || tag === 'div' || node.querySelector('img, video, audio, source')) {
              shouldScan = true;
              break;
            }
          }
        }
      }
      if (shouldScan) break;
    }
    if (shouldScan) triggerScan();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('scroll', triggerScan, { passive: true });
  window.addEventListener('resize', triggerScan, { passive: true });

  // Initial immediate scan
  triggerScan();

  return () => {
    observer.disconnect();
    window.removeEventListener('scroll', triggerScan);
    window.removeEventListener('resize', triggerScan);
  };
}

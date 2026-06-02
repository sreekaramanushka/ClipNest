import { MEDIA_TYPES } from './constants.js';

export function extractVideos(alreadyCapturedUrls = []) {
  const videoElements = Array.from(document.querySelectorAll('video'));
  const sourceElements = Array.from(document.querySelectorAll('source'));
  const items = [];
  const addedUrls = new Set();

  const resolveUrl = (src) => {
    if (!src) return null;
    try {
      return new URL(src, window.location.href).href;
    } catch (e) {
      return null;
    }
  };

  const getExtension = (url) => {
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('.');
    if (parts.length > 1) {
      const ext = parts.pop().toLowerCase();
      if (ext.length <= 4) return ext;
    }
    return 'mp4'; // fallback
  };

  const addVideo = (url, title = '', thumbnail = null) => {
    const absoluteUrl = resolveUrl(url);
    if (!absoluteUrl) return;
    
    // Ignore duplicates
    if (addedUrls.has(absoluteUrl)) return;
    addedUrls.add(absoluteUrl);

    const isBlob = absoluteUrl.startsWith('blob:');
    let ext = isBlob ? 'blob' : getExtension(absoluteUrl);
    if (absoluteUrl.includes('.m3u8')) ext = 'm3u8';
    if (absoluteUrl.includes('.mpd')) ext = 'mpd';

    items.push({
      id: `video_${items.length}_${Date.now()}`,
      type: MEDIA_TYPES.VIDEO,
      url: absoluteUrl,
      title: title || absoluteUrl.split('/').pop().split('?')[0] || 'Web Video',
      thumbnail: thumbnail,
      size: isBlob ? 'Blob URL' : null,
      extension: ext
    });
  };

  // 1. Process Video Elements
  videoElements.forEach(video => {
    const src = video.currentSrc || video.src;
    const title = video.getAttribute('title') || video.getAttribute('aria-label') || '';
    const poster = video.poster ? resolveUrl(video.poster) : null;
    
    if (src) {
      addVideo(src, title, poster);
    }

    // Process source tags inside the video tag
    video.querySelectorAll('source').forEach(source => {
      const sourceSrc = source.src;
      if (sourceSrc) {
        addVideo(sourceSrc, title || source.getAttribute('title') || '', poster);
      }
    });
  });

  // 2. Process standalone Source Elements
  sourceElements.forEach(source => {
    const parent = source.parentElement;
    if (parent && parent.tagName.toLowerCase() === 'video') return; // already processed
    
    const src = source.src;
    if (src) {
      addVideo(src, source.getAttribute('title') || '');
    }
  });

  // 3. Process already captured network urls (from background/performance)
  alreadyCapturedUrls.forEach(url => {
    const lowerUrl = url.toLowerCase();
    const isVideo = lowerUrl.includes('.mp4') || 
                    lowerUrl.includes('.webm') || 
                    lowerUrl.includes('.m3u8') || 
                    lowerUrl.includes('.mpd') || 
                    lowerUrl.includes('.mov') ||
                    lowerUrl.includes('.m4v') ||
                    lowerUrl.includes('v.pinimg.com/videos/');

    if (isVideo) {
      addVideo(url);
    }
  });

  return items;
}

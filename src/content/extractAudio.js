import { MEDIA_TYPES } from './constants.js';

export function extractAudio(alreadyCapturedUrls = []) {
  const audioElements = Array.from(document.querySelectorAll('audio'));
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

  const getPageTitle = () => {
    let title = document.title || 'Extracted Audio';
    // Strip common site suffixes for a cleaner display name
    title = title.replace(/\s*-\s*YouTube\s*Music/i, '');
    title = title.replace(/\s*-\s*YouTube/i, '');
    title = title.replace(/\s*\|\s*Pinterest/i, '');
    return title.trim();
  };

  const cleanMediaUrl = (url) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('googlevideo.com') || parsed.pathname.includes('/videoplayback')) {
        // Strip byte-range parameters so the entire audio can be loaded/downloaded instead of a single 1-second chunk
        parsed.searchParams.delete('range');
        parsed.searchParams.delete('rn');
        parsed.searchParams.delete('rbuf');
      }
      return parsed.href;
    } catch (e) {
      return url;
    }
  };

  const cleanUrlForMatching = (url) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return (parsed.origin + parsed.pathname).toLowerCase();
    } catch (e) {
      return url.split('?')[0].split('#')[0].toLowerCase();
    }
  };

  const getExtension = (url) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('mime=audio%2fwebm') || lowerUrl.includes('mime=audio/webm')) return 'webm';
    if (lowerUrl.includes('mime=audio%2fmp4') || lowerUrl.includes('mime=audio/mp4')) return 'm4a';
    if (lowerUrl.includes('mime=audio%2faac') || lowerUrl.includes('mime=audio/aac')) return 'aac';
    if (lowerUrl.includes('mime=audio%2fogg') || lowerUrl.includes('mime=audio/ogg')) return 'ogg';
    
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('.');
    if (parts.length > 1) {
      const ext = parts.pop().toLowerCase();
      if (ext.length <= 4) return ext;
    }
    return 'mp3'; // fallback
  };

  const addAudio = (url, title = '') => {
    const absoluteUrl = resolveUrl(url);
    if (!absoluteUrl) return;

    // Filter out unplayable blob URLs entirely
    if (absoluteUrl.startsWith('blob:')) return;

    // Clean YouTube / google video streams of chunking bounds
    const cleanedUrl = cleanMediaUrl(absoluteUrl);

    if (addedUrls.has(cleanedUrl)) return;
    addedUrls.add(cleanedUrl);

    const ext = getExtension(cleanedUrl);
    
    let displayTitle = title;

    // Check registry for metadata with query-agnostic key
    const matchKey = cleanUrlForMatching(cleanedUrl);
    if (window.clipnetMetadataRegistry && window.clipnetMetadataRegistry[matchKey]) {
      const meta = window.clipnetMetadataRegistry[matchKey];
      if (!displayTitle) displayTitle = meta.title;
    }

    if (!displayTitle) {
      if (cleanedUrl.includes('googlevideo.com') || cleanedUrl.includes('youtube.com') || cleanedUrl.includes('/videoplayback')) {
        displayTitle = `${getPageTitle()}`;
      } else {
        displayTitle = cleanedUrl.split('/').pop().split('?')[0] || 'Web Audio Stream';
      }
    }

    items.push({
      id: `audio_${items.length}_${Date.now()}`,
      type: MEDIA_TYPES.AUDIO,
      url: cleanedUrl,
      title: displayTitle,
      size: null,
      extension: ext
    });
  };

  // 1. Process Audio Elements
  audioElements.forEach(audio => {
    const src = audio.currentSrc || audio.src;
    const title = audio.getAttribute('title') || audio.getAttribute('aria-label') || '';
    
    if (src) {
      addAudio(src, title);
    }

    // Process source tags inside audio tag
    audio.querySelectorAll('source').forEach(source => {
      const sourceSrc = source.src;
      if (sourceSrc) {
        addAudio(sourceSrc, title || source.getAttribute('title') || '');
      }
    });
  });

  // 2. Process standalone Source Elements (if parent is not audio/video)
  sourceElements.forEach(source => {
    const parent = source.parentElement;
    if (parent && (parent.tagName.toLowerCase() === 'audio' || parent.tagName.toLowerCase() === 'video')) return;

    const src = source.src;
    const typeAttr = source.getAttribute('type') || '';
    if (src && (typeAttr.includes('audio') || getExtension(src) === 'mp3' || getExtension(src) === 'wav')) {
      addAudio(src, source.getAttribute('title') || '');
    }
  });

  // 3. Process captured network urls (audio file formats & dynamic streams)
  alreadyCapturedUrls.forEach(url => {
    const lowerUrl = url.toLowerCase();
    const isAudio = lowerUrl.includes('.mp3') || 
                    lowerUrl.includes('.wav') || 
                    lowerUrl.includes('.aac') || 
                    lowerUrl.includes('.ogg') || 
                    lowerUrl.includes('.flac') ||
                    lowerUrl.includes('.m4a') ||
                    lowerUrl.includes('.opus') ||
                    lowerUrl.includes('googlevideo.com/videoplayback') ||
                    lowerUrl.includes('youtube.com/videoplayback') ||
                    lowerUrl.includes('mime=audio') ||
                    lowerUrl.includes('mime%3daudio');

    if (isAudio) {
      addAudio(url);
    }
  });

  return items;
}

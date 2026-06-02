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

  const getExtension = (url) => {
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

    if (addedUrls.has(absoluteUrl)) return;
    addedUrls.add(absoluteUrl);

    const isBlob = absoluteUrl.startsWith('blob:');
    const ext = isBlob ? 'blob' : getExtension(absoluteUrl);

    items.push({
      id: `audio_${items.length}_${Date.now()}`,
      type: MEDIA_TYPES.AUDIO,
      url: absoluteUrl,
      title: title || absoluteUrl.split('/').pop().split('?')[0] || 'Web Audio Stream',
      size: isBlob ? 'Blob URL' : null,
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

  // 3. Process captured network urls (audio file formats)
  alreadyCapturedUrls.forEach(url => {
    const lowerUrl = url.toLowerCase();
    const isAudio = lowerUrl.includes('.mp3') || 
                    lowerUrl.includes('.wav') || 
                    lowerUrl.includes('.aac') || 
                    lowerUrl.includes('.ogg') || 
                    lowerUrl.includes('.flac') ||
                    lowerUrl.includes('.m4a') ||
                    lowerUrl.includes('.opus');

    if (isAudio) {
      addAudio(url);
    }
  });

  return items;
}

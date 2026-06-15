import { MEDIA_TYPES } from './constants.js';

export function extractVideos(alreadyCapturedUrls = []) {
  const videoElements = Array.from(document.querySelectorAll('video'));
  const sourceElements = Array.from(document.querySelectorAll('source'));
  const items = [];
  const addedCleanKeys = new Set();

  const resolveUrl = (src) => {
    if (!src) return null;
    try {
      return new URL(src, window.location.href).href;
    } catch (e) {
      return null;
    }
  };

  const getPageTitle = () => {
    let title = document.title || 'Extracted Video';
    title = title.replace(/\s*-\s*YouTube\s*Music/i, '');
    title = title.replace(/\s*-\s*YouTube/i, '');
    title = title.replace(/\s*\|\s*Pinterest/i, '');
    return title.trim();
  };

  const cleanMediaUrl = (url) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('googlevideo.com') || parsed.pathname.includes('/videoplayback')) {
        // Strip byte-range parameters to play/download the full media
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

  const findPinterestMetaFromDOM = (videoUrl) => {
    try {
      const parts = videoUrl.split('/');
      const fileName = parts[parts.length - 1].split('?')[0];
      const hash = fileName.split('.')[0];
      
      if (hash && hash.length > 10) {
        const imgs = Array.from(document.querySelectorAll('img'));
        for (const img of imgs) {
          const src = img.src || img.getAttribute('src');
          if (src && src.includes(hash)) {
            return {
              thumbnail: src,
              title: img.getAttribute('alt') || img.getAttribute('title') || ''
            };
          }
        }
      }
    } catch (e) {}
    return null;
  };

  const getExtension = (url) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('mime=video%2fwebm') || lowerUrl.includes('mime=video/webm')) return 'webm';
    if (lowerUrl.includes('mime=video%2fmp4') || lowerUrl.includes('mime=video/mp4')) return 'mp4';
    if (lowerUrl.includes('mime=video%2f3gpp') || lowerUrl.includes('mime=video/3gpp')) return '3gp';
    if (lowerUrl.includes('.m3u8')) return 'm3u8';
    if (lowerUrl.includes('.mpd')) return 'mpd';
    
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
    
    // Ignore HLS segments/fragments (.ts files) entirely
    if (absoluteUrl.toLowerCase().includes('.ts')) return;
    
    // Ignore unplayable blob URLs entirely
    if (absoluteUrl.startsWith('blob:')) return;

    // Clean YouTube / google video streams of chunking bounds
    const cleanedUrl = cleanMediaUrl(absoluteUrl);

    const matchKey = cleanUrlForMatching(cleanedUrl);
    if (addedCleanKeys.has(matchKey)) return;
    addedCleanKeys.add(matchKey);

    const ext = getExtension(cleanedUrl);

    let displayTitle = title;
    let displayThumbnail = thumbnail;

    // Try to resolve Pinterest cover picture and title from DOM matching
    if (cleanedUrl.includes('pinimg.com') || cleanedUrl.includes('pinterest.com')) {
      const domMeta = findPinterestMetaFromDOM(cleanedUrl);
      if (domMeta) {
        if (!displayTitle) displayTitle = domMeta.title;
        if (!displayThumbnail) displayThumbnail = domMeta.thumbnail;
      }
    }

    // Try to resolve high-quality unique metadata from global state registry using query-agnostic matching key
    if (window.clipnetMetadataRegistry && window.clipnetMetadataRegistry[matchKey]) {
      const meta = window.clipnetMetadataRegistry[matchKey];
      if (!displayTitle) displayTitle = meta.title;
      if (!displayThumbnail) displayThumbnail = meta.thumbnail;
    }

    if (!displayTitle) {
      if (cleanedUrl.includes('googlevideo.com') || cleanedUrl.includes('youtube.com') || cleanedUrl.includes('/videoplayback')) {
        displayTitle = `${getPageTitle()}`;
      } else {
        displayTitle = cleanedUrl.split('/').pop().split('?')[0] || 'Web Video';
      }
    }

    items.push({
      id: `video_${items.length}_${Date.now()}`,
      type: MEDIA_TYPES.VIDEO,
      url: cleanedUrl,
      title: displayTitle,
      thumbnail: displayThumbnail,
      size: null,
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
                    lowerUrl.includes('v.pinimg.com/videos/') ||
                    lowerUrl.includes('googlevideo.com/videoplayback') ||
                    lowerUrl.includes('youtube.com/videoplayback') ||
                    lowerUrl.includes('mime=video') ||
                    lowerUrl.includes('mime%3dvideo');

    if (isVideo) {
      addVideo(url);
    }
  });

  return items;
}

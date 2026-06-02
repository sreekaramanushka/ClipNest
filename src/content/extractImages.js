import { MEDIA_TYPES } from './constants.js';

export function extractImages(alreadyCapturedUrls = []) {
  const imgElements = Array.from(document.querySelectorAll('img'));
  const sourceElements = Array.from(document.querySelectorAll('picture source, source'));
  const bgElements = Array.from(document.querySelectorAll('[style*="background"]'));
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
    return 'jpg'; // fallback
  };

  const addImage = (url, title = '', thumbnail = null) => {
    const absoluteUrl = resolveUrl(url);
    if (!absoluteUrl) return;

    // Ignore tracker/tiny spacer pixels (< 15 characters, or typical tiny data URIs)
    if (absoluteUrl.startsWith('data:image') && absoluteUrl.length < 150) return;

    if (addedUrls.has(absoluteUrl)) return;
    addedUrls.add(absoluteUrl);

    const isBlob = absoluteUrl.startsWith('blob:');
    const ext = isBlob ? 'blob' : getExtension(absoluteUrl);

    items.push({
      id: `image_${items.length}_${Date.now()}`,
      type: MEDIA_TYPES.IMAGE,
      url: absoluteUrl,
      title: title || absoluteUrl.split('/').pop().split('?')[0] || 'Web Image',
      thumbnail: thumbnail || absoluteUrl,
      size: isBlob ? 'Blob URL' : null,
      extension: ext
    });
  };

  // 1. Process <img> Elements
  imgElements.forEach(img => {
    const src = img.src;
    const title = img.alt || img.getAttribute('title') || '';
    if (src) {
      addImage(src, title);
    }

    // Process srcset attribute if present
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      srcset.split(',').forEach(item => {
        const parts = item.trim().split(/\s+/);
        if (parts[0]) {
          addImage(parts[0], title);
        }
      });
    }
  });

  // 2. Process Picture/Source Elements
  sourceElements.forEach(source => {
    const srcset = source.getAttribute('srcset');
    if (srcset) {
      srcset.split(',').forEach(item => {
        const parts = item.trim().split(/\s+/);
        if (parts[0]) {
          addImage(parts[0], source.getAttribute('title') || '');
        }
      });
    }
  });

  // 3. Process inline Background Styles
  bgElements.forEach(el => {
    const bg = el.style.backgroundImage || el.style.background;
    if (bg && bg.includes('url(')) {
      const match = bg.match(/url\(['"]?([^'"]+?)['"]?\)/);
      if (match && match[1]) {
        addImage(match[1], el.getAttribute('title') || el.innerText?.slice(0, 30) || 'Background Asset');
      }
    }
  });

  // 4. Capture CSS background images via Performance entries & custom image formats
  alreadyCapturedUrls.forEach(url => {
    const lowerUrl = url.toLowerCase();
    const isImage = lowerUrl.includes('.png') || 
                    lowerUrl.includes('.jpg') || 
                    lowerUrl.includes('.jpeg') || 
                    lowerUrl.includes('.webp') || 
                    lowerUrl.includes('.avif') ||
                    lowerUrl.includes('.gif') ||
                    lowerUrl.includes('.svg') ||
                    lowerUrl.includes('.bmp') ||
                    lowerUrl.includes('.ico');

    if (isImage) {
      addImage(url);
    }
  });

  return items;
}

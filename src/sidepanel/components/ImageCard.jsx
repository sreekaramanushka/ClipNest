import React, { useState } from 'react';

const ImageCard = ({ image, onPreview }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(image.url);
      if (!response.ok) throw new Error(`HTTP status ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      chrome.runtime.sendMessage({ 
        type: 'download', 
        payload: { url: blobUrl, filename: image.title || 'image.jpg' } 
      }, () => {
        setDownloading(false);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
      });
    } catch (e) {
      console.warn("Pre-fetch failed, downloading directly:", e);
      chrome.runtime.sendMessage({ 
        type: 'download', 
        payload: { url: image.url, filename: image.title || 'image.jpg' } 
      }, () => {
        setDownloading(false);
      });
    }
  };

  const handleOpen = () => {
    chrome.tabs.create({ url: image.url });
  };

  const handleCopyUrl = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(image.url).catch(err => {
      console.error('Failed to copy image URL', err);
    });
  };

  return (
    <div className="image-card" onClick={() => !downloading && onPreview(image)}>
      <div className="image-thumbnail-container">
        <img 
          className="image-thumbnail" 
          src={image.thumbnail || image.url} 
          alt={image.title} 
          loading="lazy" 
        />
        <span className="image-type-badge">{image.extension}</span>
      </div>
      <div className="image-info">
        <div className="image-title" title={image.title}>{image.title || image.url}</div>
      </div>
      <div className="image-actions">
        <button onClick={handleCopyUrl} title="Copy Link" disabled={downloading}>Copy</button>
        <button onClick={(e) => { e.stopPropagation(); handleOpen(); }} title="Open original URL" disabled={downloading}>Open</button>
        <button 
          className="btn-download" 
          onClick={(e) => { e.stopPropagation(); handleDownload(); }} 
          title="Download Image"
          disabled={downloading}
        >
          {downloading ? 'Saving...' : 'Download'}
        </button>
      </div>
    </div>
  );
};

export default ImageCard;

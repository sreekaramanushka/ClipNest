import React from 'react';

const ImageCard = ({ image, onPreview }) => {
  const handleDownload = () => {
    chrome.runtime.sendMessage({ 
      type: 'download', 
      payload: { url: image.url, filename: image.title || 'image.jpg' } 
    });
  };

  const handleOpen = () => {
    chrome.tabs.create({ url: image.url });
  };

  const handleCopyUrl = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(image.url);
    } catch (err) {
      console.error('Failed to copy image URL', err);
    }
  };

  return (
    <div className="image-card" onClick={() => onPreview(image)}>
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
        <button onClick={handleCopyUrl} title="Copy Link">Copy</button>
        <button onClick={(e) => { e.stopPropagation(); handleOpen(); }} title="Open original URL">Open</button>
        <button 
          className="btn-download" 
          onClick={(e) => { e.stopPropagation(); handleDownload(); }} 
          title="Download Image"
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default ImageCard;

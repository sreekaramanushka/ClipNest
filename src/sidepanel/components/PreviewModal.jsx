import React from 'react';

const PreviewModal = ({ activeItem, onClose }) => {
  if (!activeItem) return null;

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
        <button className="preview-modal-close" onClick={onClose} aria-label="Close preview">✕</button>
        
        <div className="preview-modal-media">
          {activeItem.type === 'image' && (
            <img src={activeItem.url} alt={activeItem.title} className="preview-modal-image" />
          )}
          {activeItem.type === 'video' && (
            <video src={activeItem.url} controls autoPlay className="preview-modal-video"></video>
          )}
          {activeItem.type === 'audio' && (
            <audio src={activeItem.url} controls autoPlay className="preview-modal-audio"></audio>
          )}
        </div>
        
        <div className="preview-modal-footer">
          <div className="preview-modal-title" title={activeItem.title}>
            {activeItem.title || 'Untitled Media'}
          </div>
          <div className="preview-modal-meta">
            <span className="preview-modal-badge">{activeItem.extension}</span>
            <a href={activeItem.url} target="_blank" rel="noreferrer" className="preview-modal-link">
              Open Direct URL
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;

import React, { useState } from 'react';

const AudioCard = ({ audio }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(audio.url);
      if (!response.ok) throw new Error(`HTTP status ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      chrome.runtime.sendMessage({ 
        type: 'download', 
        payload: { url: blobUrl, filename: audio.title || 'audio.mp3' } 
      }, () => {
        setDownloading(false);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
      });
    } catch (e) {
      console.warn("Pre-fetch failed, downloading directly:", e);
      chrome.runtime.sendMessage({ 
        type: 'download', 
        payload: { url: audio.url, filename: audio.title || 'audio.mp3' } 
      }, () => {
        setDownloading(false);
      });
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(audio.url);
    } catch (e) {
      console.error('Failed to copy audio URL', e);
    }
  };

  return (
    <div className="audio-card">
      <div className="audio-card-top">
        <div className="audio-icon-placeholder">🎵</div>
        <div className="audio-info">
          <div className="audio-title" title={audio.title}>{audio.title || audio.url}</div>
          <div className="audio-meta">
            {audio.size && <span className="audio-size">{audio.size}</span>}
            <span className="audio-type-badge">{audio.extension}</span>
          </div>
        </div>
      </div>
      
      {/* Inline Audio Player for sidepanel preview */}
      <div className="audio-player-wrapper">
        <audio src={audio.url} controls preload="none" className="audio-player"></audio>
      </div>

      <div className="audio-actions">
        <button onClick={handleCopyUrl} disabled={downloading}>Copy Link</button>
        <button 
          className="btn-download" 
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? 'Downloading...' : 'Download'}
        </button>
      </div>
    </div>
  );
};

export default AudioCard;

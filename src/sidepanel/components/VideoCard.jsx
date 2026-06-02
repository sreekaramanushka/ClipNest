import React from 'react';

const VideoCard = ({ video }) => {
  const handleDownload = () => {
    chrome.runtime.sendMessage({ type: 'download', payload: { url: video.url, filename: video.title || 'video.mp4' } });
  };

  const handlePreview = () => {
    const previewUrl = chrome.runtime.getURL(`preview.html?url=${encodeURIComponent(video.url)}&title=${encodeURIComponent(video.title || 'Video')}`);
    chrome.tabs.create({ url: previewUrl });
  };

  return (
    <div className="video-card">
      <div className="video-card-top">
        {video.thumbnail ? (
          <img className="video-thumbnail" src={video.thumbnail} alt={video.title} />
        ) : (
          <div className="video-thumbnail-placeholder" />
        )}
        <div className="video-info">
          <div className="video-title" title={video.title}>{video.title || video.url}</div>
          <div className="video-meta">
            {video.size && <span className="video-size">{video.size}</span>}
            <span className="video-type-badge">{video.extension}</span>
          </div>
        </div>
      </div>
      
      <div className="video-actions">
        <button onClick={handlePreview}>Preview</button>
        <button className="btn-download" onClick={handleDownload}>Download</button>
      </div>
    </div>
  );
};

export default VideoCard;

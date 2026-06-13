import React, { useState, useEffect, useRef } from 'react';

const VideoThumbnail = ({ video }) => {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    let active = true;

    if (isHovered && videoRef.current) {
      const videoEl = videoRef.current;
      const url = video.url;
      const lowerUrl = url.toLowerCase();
      
      const isHls = (lowerUrl.includes('.m3u8') || lowerUrl.includes('manifest') || lowerUrl.includes('hls')) && 
                    !lowerUrl.includes('.mp4') && 
                    !lowerUrl.includes('.webm') &&
                    !lowerUrl.includes('.mpd');

      if (isHls) {
        if (window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls({
            maxBufferSize: 0,
            maxBufferLength: 2,
            xhrSetup: (xhr) => {
              xhr.withCredentials = false;
            }
          });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(videoEl);
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            if (active) {
              videoEl.play().catch(e => console.log("HLS preview autoplay blocked", e));
            }
          });
        } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
          videoEl.src = url;
          videoEl.play().catch(e => console.log("Native HLS preview autoplay blocked", e));
        }
      } else {
        videoEl.src = url;
        videoEl.play().catch(e => console.log("Standard preview autoplay blocked", e));
      }
    }

    return () => {
      active = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.load();
      }
    };
  }, [isHovered, video.url]);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        width: '72px',
        height: '48px',
        borderRadius: '6px',
        overflow: 'hidden',
        background: 'var(--accent-grey)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '1px solid var(--border-light)',
        cursor: 'pointer'
      }}
      title="Hover to live preview video"
    >
      {isHovered ? (
        <video 
          ref={videoRef}
          muted
          loop
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      ) : video.thumbnail ? (
        <img 
          src={video.thumbnail} 
          alt={video.title} 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      ) : (
        <div style={{ fontSize: '1.1rem', userSelect: 'none' }}>📽️</div>
      )}
      
      {!isHovered && (
        <div style={{
          position: 'absolute',
          bottom: '2px',
          right: '2px',
          background: 'rgba(0,0,0,0.68)',
          borderRadius: '3px',
          padding: '1px 3.5px',
          fontSize: '0.52rem',
          color: '#fff',
          pointerEvents: 'none',
          lineHeight: '1',
          fontWeight: '500',
          letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}>
          Hover
        </div>
      )}
    </div>
  );
};

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
        <VideoThumbnail video={video} />
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

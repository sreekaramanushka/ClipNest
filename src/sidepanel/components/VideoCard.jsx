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

const downloadHlsAsMp4 = async (m3u8Url, onProgress) => {
  const response = await fetch(m3u8Url);
  if (!response.ok) throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
  let manifestText = await response.text();
  
  const baseUri = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
  const lines = manifestText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const isMasterPlaylist = lines.some(line => line.includes('#EXT-X-STREAM-INF'));
  
  let targetM3u8Url = m3u8Url;
  if (isMasterPlaylist) {
    let bestStreamUrl = null;
    let maxBandwidth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/i);
        const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
        
        let streamUrl = lines[i + 1];
        if (streamUrl && !streamUrl.startsWith('#')) {
          if (!streamUrl.startsWith('http')) {
            streamUrl = new URL(streamUrl, baseUri).href;
          }
          if (bandwidth > maxBandwidth) {
            maxBandwidth = bandwidth;
            bestStreamUrl = streamUrl;
          }
        }
      }
    }
    
    if (bestStreamUrl) {
      targetM3u8Url = bestStreamUrl;
      const subResponse = await fetch(targetM3u8Url);
      if (!subResponse.ok) throw new Error(`Failed to fetch stream manifest: HTTP ${subResponse.status}`);
      manifestText = await subResponse.text();
    }
  }
  
  const subBaseUri = targetM3u8Url.substring(0, targetM3u8Url.lastIndexOf('/') + 1);
  const mediaLines = manifestText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const manifestParams = new URL(targetM3u8Url).search;
  const segmentUrls = [];
  for (let i = 0; i < mediaLines.length; i++) {
    const line = mediaLines[i];
    if (line.startsWith('#')) continue;
    let segmentUrl = line;
    if (!segmentUrl.startsWith('http')) {
      segmentUrl = new URL(segmentUrl, subBaseUri).href;
    }
    if (manifestParams && !segmentUrl.includes('?')) {
      segmentUrl += manifestParams;
    }
    segmentUrls.push(segmentUrl);
  }
  
  if (segmentUrls.length === 0) {
    throw new Error("No video segments found in the HLS playlist.");
  }
  
  const chunks = [];
  for (let i = 0; i < segmentUrls.length; i++) {
    if (onProgress) {
      onProgress(Math.round((i / segmentUrls.length) * 100));
    }
    const segmentResponse = await fetch(segmentUrls[i]);
    if (!segmentResponse.ok) {
      throw new Error(`Failed to fetch video segment ${i}: HTTP ${segmentResponse.status}`);
    }
    const arrayBuffer = await segmentResponse.arrayBuffer();
    chunks.push(new Uint8Array(arrayBuffer));
  }
  
  if (onProgress) {
    onProgress(100);
  }
  
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }
  
  const concatenated = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.length;
  }
  
  return new Blob([concatenated], { type: 'video/mp4' });
};

const VideoCard = ({ video }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress(0);

    const triggerDownload = (url, filename) => {
      try {
        chrome.runtime.sendMessage({ 
          type: 'download', 
          payload: { url, filename } 
        }, (response) => {
          setDownloading(false);
          setDownloadProgress(null);
          if (chrome.runtime.lastError) {
            console.error("Download error:", chrome.runtime.lastError);
            alert(`Download failed: ${chrome.runtime.lastError.message}`);
          } else if (response && !response.success) {
            alert(`Download failed: ${response.error || 'Unknown error'}`);
          }
        });
      } catch (err) {
        setDownloading(false);
        setDownloadProgress(null);
        console.error("Messaging failed:", err);
        alert("Connection to extension lost. Please reload the webpage.");
      }
    };

    try {
      const isHls = video.url.toLowerCase().includes('.m3u8');
      let blob;
      if (isHls) {
        blob = await downloadHlsAsMp4(video.url, (progress) => {
          setDownloadProgress(progress);
        });
      } else {
        const response = await fetch(video.url);
        if (!response.ok) throw new Error(`HTTP status ${response.status}`);
        blob = await response.blob();
      }
      
      const blobUrl = URL.createObjectURL(blob);
      const filename = video.title || 'video.mp4';
      const cleanFilename = filename.toLowerCase().endsWith('.m3u8') 
        ? filename.slice(0, -5) + '.mp4' 
        : filename;
      
      triggerDownload(blobUrl, cleanFilename);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
    } catch (e) {
      console.warn("Pre-fetch failed, downloading directly:", e);
      triggerDownload(video.url, video.title || 'video.mp4');
    }
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
        <button onClick={handlePreview} disabled={downloading}>Preview</button>
        <button 
          className="btn-download" 
          onClick={handleDownload} 
          disabled={downloading}
        >
          {downloading 
            ? (downloadProgress !== null ? `Downloading (${downloadProgress}%)...` : 'Downloading...') 
            : 'Download'}
        </button>
      </div>
    </div>
  );
};

export default VideoCard;

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

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mediaUrl = urlParams.get('url');
  const mediaTitle = urlParams.get('title') || 'Media Preview';

  if (mediaUrl) {
    const player = document.getElementById('player');
    const titleEl = document.getElementById('video-title');
    const urlEl = document.getElementById('video-url');
    const viewport = document.getElementById('viewport');
    
    const btnDownload = document.getElementById('btn-download');
    const btnCopy = document.getElementById('btn-copy');
    const toast = document.getElementById('toast');

    // Decode and display title & raw URL
    const decodedTitle = decodeURIComponent(mediaTitle);
    titleEl.textContent = decodedTitle;
    urlEl.textContent = mediaUrl;

    const lowerUrl = mediaUrl.toLowerCase();
    
    // 1. Detect if the media item is an Audio Stream
    const isAudio = lowerUrl.includes('.mp3') || 
                    lowerUrl.includes('.wav') || 
                    lowerUrl.includes('.aac') || 
                    lowerUrl.includes('.ogg') || 
                    lowerUrl.includes('.flac') ||
                    lowerUrl.includes('.m4a') ||
                    lowerUrl.includes('.opus') ||
                    lowerUrl.includes('mime=audio') ||
                    lowerUrl.includes('mime%3daudio');

    const isHls = (lowerUrl.includes('.m3u8') || lowerUrl.includes('manifest') || lowerUrl.includes('hls')) && 
                  !lowerUrl.includes('.mp4') && 
                  !lowerUrl.includes('.webm') &&
                  !lowerUrl.includes('.mpd');

    if (isAudio) {
      // Elevate aesthetic by adding a gorgeous animated audio visualization viewport
      viewport.classList.add('audio-mode-viewport');
      viewport.innerHTML = `
        <div class="audio-visualization">🎵</div>
        <audio id="player" controls autoplay style="width: 80%; max-width: 500px; margin-top: 10px;"></audio>
      `;
      const audioPlayer = document.getElementById('player');
      audioPlayer.src = mediaUrl;
      
      audioPlayer.onerror = () => {
        titleEl.textContent = "Unable to play audio preview natively";
        urlEl.textContent = "This audio stream format may require custom headers. You can still download it directly below.";
      };
    } else {
      // 2. Play Video Stream (Standard or HLS)
      if (isHls) {
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
          const hls = new Hls({
            xhrSetup: (xhr) => {
              xhr.withCredentials = false;
            }
          });
          hls.loadSource(mediaUrl);
          hls.attachMedia(player);
          
          hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
              console.error("HLS fatal playback error:", data);
              titleEl.textContent = "Playback failed: HLS load error";
              urlEl.textContent = `Type: ${data.type} | Details: ${data.details}`;
            }
          });
        } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Safari Support
          player.src = mediaUrl;
        } else {
          titleEl.textContent = "HLS streams are not supported in this browser";
          urlEl.textContent = "Please install an extension/browser supporting HLS or download the stream directly.";
        }
      } else {
        // Standard video file (MP4, WebM)
        player.src = mediaUrl;
        
        player.onerror = () => {
          titleEl.textContent = "Unable to load preview natively in browser";
          urlEl.textContent = "This stream format or source may require custom headers. You can still download it directly.";
        };
      }
    }

    const triggerDownload = (url, filename, fallbackMsg) => {
      try {
        chrome.runtime.sendMessage({ 
          type: 'download', 
          payload: { url, filename } 
        }, (response) => {
          btnDownload.disabled = false;
          if (chrome.runtime.lastError) {
            console.error("Download error:", chrome.runtime.lastError);
            showToast(`Download failed: ${chrome.runtime.lastError.message}`);
            return;
          }
          if (response && response.success) {
            showToast(fallbackMsg || "Download started successfully!");
          } else {
            showToast(`Download failed: ${response?.error || 'Unknown error'}`);
          }
        });
      } catch (err) {
        btnDownload.disabled = false;
        console.error("Messaging failed:", err);
        showToast("Connection to extension lost. Please refresh this page tab.");
      }
    };

    btnDownload.addEventListener('click', async () => {
      btnDownload.disabled = true;
      let extension = isAudio ? 'mp3' : 'mp4';
      if (lowerUrl.includes('mime=audio%2fwebm') || lowerUrl.includes('mime=audio/webm')) extension = 'webm';
      if (lowerUrl.includes('mime=audio%2fmp4') || lowerUrl.includes('mime=audio/mp4')) extension = 'm4a';
      if (lowerUrl.includes('mime=video%2fwebm') || lowerUrl.includes('mime=video/webm')) extension = 'webm';
      if (lowerUrl.includes('mime=video%2fmp4') || lowerUrl.includes('mime=video/mp4')) extension = 'mp4';
      if (isHls) {
        extension = 'mp4';
      }
      
      let rawName = decodedTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
      if (rawName.length > 60) {
        rawName = rawName.slice(0, 60).trim();
      }
      const filename = `${rawName || 'extracted-media'}.${extension}`;

      try {
        let blob;
        if (isHls) {
          showToast("Downloading segments... (0%)", null);
          blob = await downloadHlsAsMp4(mediaUrl, (progress) => {
            showToast(`Downloading segments... (${progress}%)`, null);
          });
        } else {
          showToast("Preparing download...");
          const response = await fetch(mediaUrl);
          if (!response.ok) throw new Error(`HTTP status ${response.status}`);
          blob = await response.blob();
        }
        
        const blobUrl = URL.createObjectURL(blob);
        triggerDownload(blobUrl, filename, "Download started successfully!");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
      } catch (err) {
        console.warn("Pre-fetch or HLS compile failed, downloading directly:", err);
        showToast("Pre-fetch failed, downloading directly...");
        triggerDownload(mediaUrl, filename, "Download started!");
      }
    });

    // 4. Interactive Actions: Copy URL
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(mediaUrl);
        showToast("Link copied to clipboard!");
      } catch (err) {
        showToast("Failed to copy link.");
      }
    });

    // Helper to display animated status toasts
    let toastTimeout = null;
    function showToast(message, duration = 3000) {
      toast.textContent = message;
      toast.classList.add('show');
      if (toastTimeout) {
        clearTimeout(toastTimeout);
      }
      if (duration !== null) {
        toastTimeout = setTimeout(() => {
          toast.classList.remove('show');
          toastTimeout = null;
        }, duration);
      }
    }
  } else {
    document.getElementById('video-title').textContent = "No video source provided";
  }
});

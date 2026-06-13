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
      const isHls = (lowerUrl.includes('.m3u8') || lowerUrl.includes('manifest') || lowerUrl.includes('hls')) && 
                    !lowerUrl.includes('.mp4') && 
                    !lowerUrl.includes('.webm') &&
                    !lowerUrl.includes('.mpd');
      
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

    // 3. Interactive Actions: Download Media
    btnDownload.addEventListener('click', () => {
      // Determine a safe, clean filename based on media characteristics
      let extension = isAudio ? 'mp3' : 'mp4';
      if (lowerUrl.includes('mime=audio%2fwebm') || lowerUrl.includes('mime=audio/webm')) extension = 'webm';
      if (lowerUrl.includes('mime=audio%2fmp4') || lowerUrl.includes('mime=audio/mp4')) extension = 'm4a';
      if (lowerUrl.includes('mime=video%2fwebm') || lowerUrl.includes('mime=video/webm')) extension = 'webm';
      if (lowerUrl.includes('mime=video%2fmp4') || lowerUrl.includes('mime=video/mp4')) extension = 'mp4';
      if (lowerUrl.includes('.m3u8')) extension = 'm3u8';
      
      const rawName = decodedTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
      const filename = `${rawName || 'extracted-media'}.${extension}`;
      
      chrome.runtime.sendMessage({ 
        type: 'download', 
        payload: { url: mediaUrl, filename } 
      }, (response) => {
        if (response && response.success) {
          showToast("Download started successfully!");
        } else {
          showToast(`Download failed: ${response?.error || 'Unknown error'}`);
        }
      });
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
    function showToast(message) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  } else {
    document.getElementById('video-title').textContent = "No video source provided";
  }
});

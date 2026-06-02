document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const videoUrl = urlParams.get('url');
  const videoTitle = urlParams.get('title') || 'Video Preview';

  if (videoUrl) {
    const player = document.getElementById('player');
    const titleEl = document.getElementById('video-title');
    const urlEl = document.getElementById('video-url');

    titleEl.textContent = decodeURIComponent(videoTitle);
    urlEl.textContent = videoUrl;

    const lowerUrl = videoUrl.toLowerCase();
    
    // Check if this is an HLS (.m3u8) stream
    const isHls = (lowerUrl.includes('.m3u8') || lowerUrl.includes('manifest') || lowerUrl.includes('hls')) && 
                  !lowerUrl.includes('.mp4') && 
                  !lowerUrl.includes('.webm') &&
                  !lowerUrl.includes('.mpd');
    
    if (isHls) {
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
          // Handle credentials/cookies if needed
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          }
        });
        hls.loadSource(videoUrl);
        hls.attachMedia(player);
        
        hls.on(Hls.Events.ERROR, function(event, data) {
          if (data.fatal) {
            console.error("HLS fatal error:", data);
            titleEl.textContent = "Playback failed: HLS loading error";
            urlEl.textContent = `Type: ${data.type} | Details: ${data.details}`;
          }
        });
      } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
        // Native support (Safari)
        player.src = videoUrl;
      } else {
        titleEl.textContent = "HLS streams are not supported in this browser";
        urlEl.textContent = "Please install a browser that supports HLS or download the stream directly.";
      }
    } else {
      // Standard video file (MP4, WebM)
      player.src = videoUrl;
      
      player.onerror = () => {
        titleEl.textContent = "Unable to load preview natively in browser";
        urlEl.textContent = "This stream format or source may require custom headers. You can still download it directly.";
      };
    }
  } else {
    document.getElementById('video-title').textContent = "No video source provided";
  }
});

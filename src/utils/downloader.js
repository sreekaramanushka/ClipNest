// downloader.js – simple wrapper around chrome.downloads API

export function downloadVideo(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename }, downloadId => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}

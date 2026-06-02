import { extractVideos } from '../content/extractVideos.js';
import { extractAudio } from '../content/extractAudio.js';
import { extractImages } from '../content/extractImages.js';

describe('Media Extractors', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('extractVideos extracts videos from DOM elements', () => {
    document.body.innerHTML = `
      <video src="http://example.com/video1.mp4" poster="http://example.com/poster1.jpg" title="Video Title 1"></video>
      <video>
        <source src="http://example.com/video2.webm" />
      </video>
    `;

    const extracted = extractVideos();
    expect(extracted).toHaveLength(2);
    expect(extracted[0].url).toBe('http://example.com/video1.mp4');
    expect(extracted[0].title).toBe('Video Title 1');
    expect(extracted[0].thumbnail).toBe('http://example.com/poster1.jpg');
    expect(extracted[0].extension).toBe('mp4');

    expect(extracted[1].url).toBe('http://example.com/video2.webm');
    expect(extracted[1].extension).toBe('webm');
  });

  test('extractAudio extracts audio from DOM elements', () => {
    document.body.innerHTML = `
      <audio src="http://example.com/audio1.mp3" title="Audio Title 1"></audio>
      <audio>
        <source src="http://example.com/audio2.wav" />
      </audio>
    `;

    const extracted = extractAudio();
    expect(extracted).toHaveLength(2);
    expect(extracted[0].url).toBe('http://example.com/audio1.mp3');
    expect(extracted[0].title).toBe('Audio Title 1');
    expect(extracted[0].extension).toBe('mp3');

    expect(extracted[1].url).toBe('http://example.com/audio2.wav');
    expect(extracted[1].extension).toBe('wav');
  });

  test('extractImages extracts images from img and background styles', () => {
    document.body.innerHTML = `
      <img src="http://example.com/image1.png" alt="Image Title 1" />
      <div style="background-image: url('http://example.com/bg.jpg');">Content</div>
    `;

    const extracted = extractImages();
    expect(extracted).toHaveLength(2);
    expect(extracted[0].url).toBe('http://example.com/image1.png');
    expect(extracted[0].title).toBe('Image Title 1');
    expect(extracted[0].extension).toBe('png');

    expect(extracted[1].url).toBe('http://example.com/bg.jpg');
    expect(extracted[1].extension).toBe('jpg');
  });
});

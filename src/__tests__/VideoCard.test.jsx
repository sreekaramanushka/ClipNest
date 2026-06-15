import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VideoCard from '../sidepanel/components/VideoCard.jsx';

describe('VideoCard', () => {
  const mockVideo = {
    url: 'http://example.com/video.mp4',
    title: 'Test Video',
    thumbnail: 'http://example.com/thumb.jpg',
    size: '15.4 MB',
    type: 'mp4'
  };

  beforeAll(() => {
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:chrome-extension://mock-blob-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  test('renders video details correctly', () => {
    render(<VideoCard video={mockVideo} />);

    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('15.4 MB')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://example.com/thumb.jpg');
  });

  test('calls chrome runtime message for download on download button click', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['video data'], { type: 'video/mp4' }))
    });

    render(<VideoCard video={mockVideo} />);
    
    const downloadButton = screen.getByText('Download');
    fireEvent.click(downloadButton);

    // Wait for the button to transition into downloading state
    expect(screen.getByText(/Downloading/)).toBeInTheDocument();

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'download',
        payload: {
          url: 'blob:chrome-extension://mock-blob-url',
          filename: 'Test Video'
        }
      }, expect.any(Function));
    });
  });
});

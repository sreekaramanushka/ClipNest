import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VideoCard from '../sidepanel/components/VideoCard.jsx';

describe('VideoCard', () => {
  const mockVideo = {
    url: 'http://example.com/video.mp4',
    title: 'Test Video',
    thumbnail: 'http://example.com/thumb.jpg',
    size: '15.4 MB',
    type: 'mp4'
  };

  test('renders video details correctly', () => {
    render(<VideoCard video={mockVideo} />);

    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('15.4 MB')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://example.com/thumb.jpg');
  });

  test('calls chrome runtime message for download on download button click', () => {
    render(<VideoCard video={mockVideo} />);
    
    const downloadButton = screen.getByText('Download');
    fireEvent.click(downloadButton);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'download',
      payload: {
        url: 'http://example.com/video.mp4',
        filename: 'Test Video'
      }
    });
  });
});

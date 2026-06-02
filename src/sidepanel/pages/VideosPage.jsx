import React from 'react';
import VideoCard from '../components/VideoCard.jsx';

const VideosPage = ({ videos }) => {
  return (
    <div className="video-list">
      {videos.map(video => (
        <VideoCard key={video.id} video={video} />
      ))}
      {videos.length === 0 && (
        <p className="status-message">No videos detected on this page.</p>
      )}
    </div>
  );
};

export default VideosPage;

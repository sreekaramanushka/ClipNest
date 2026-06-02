import React, { useState } from 'react';
import ImageCard from '../components/ImageCard.jsx';

const ImagesPage = ({ images, onPreview }) => {
  const [limit, setLimit] = useState(24);

  const displayedImages = images.slice(0, limit);
  const hasMore = images.length > limit;

  return (
    <div className="images-page-container">
      <div className="image-grid">
        {displayedImages.map(image => (
          <ImageCard key={image.id} image={image} onPreview={onPreview} />
        ))}
      </div>
      {images.length === 0 && (
        <p className="status-message">No images detected on this page.</p>
      )}
      {hasMore && (
        <div className="load-more-container">
          <button className="btn-secondary load-more-btn" onClick={() => setLimit(prev => prev + 24)}>
            Load More ({images.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
};

export default ImagesPage;

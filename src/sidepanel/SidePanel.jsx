import React, { useState } from 'react';
import useMediaExtractor from './hooks/useMediaExtractor.js';
import SearchBar from './components/SearchBar.jsx';
import Tabs from './components/Tabs.jsx';
import VideosPage from './pages/VideosPage.jsx';
import AudioPage from './pages/AudioPage.jsx';
import ImagesPage from './pages/ImagesPage.jsx';
import PreviewModal from './components/PreviewModal.jsx';

const SidePanel = () => {
  const { media, loading, error, refresh, reloadTab } = useMediaExtractor();
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('videos');
  const [previewItem, setPreviewItem] = useState(null);

  const handleRefresh = () => {
    refresh();
  };

  const isConnectionError = error && error.includes('reload the webpage tab');

  // Filter lists based on search string
  const filterMedia = (items) => {
    if (!items) return [];
    return items.filter(item => 
      item.title?.toLowerCase().includes(filter.toLowerCase()) ||
      item.url?.toLowerCase().includes(filter.toLowerCase())
    );
  };

  const filteredVideos = filterMedia(media.videos);
  const filteredAudios = filterMedia(media.audios);
  const filteredImages = filterMedia(media.images);

  const counts = {
    videos: media.videos?.length || 0,
    audios: media.audios?.length || 0,
    images: media.images?.length || 0
  };

  return (
    <div className="side-panel">
      <header className="app-header">
        <img src="icons/icon48.png" className="app-logo" alt="ClipNet Logo" />
        <h1 className="app-title">ClipNet</h1>
      </header>
      
      <SearchBar 
        filter={filter} 
        setFilter={setFilter} 
        onRefresh={handleRefresh} 
        loading={loading} 
      />
      
      <Tabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        counts={counts} 
      />
      
      {loading && <p className="status-message">Scanning page for media files…</p>}
      
      {error && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <p className="status-message error" style={{ margin: '0 0 10px 0' }}>{error}</p>
          {isConnectionError && (
            <button className="btn-primary" onClick={reloadTab} style={{ fontSize: '0.8rem', padding: '8px 14px' }}>
              Reload Page Tab
            </button>
          )}
        </div>
      )}

      {!error && (
        <div className="media-content-area">
          {activeTab === 'videos' && (
            <VideosPage videos={filteredVideos} />
          )}
          {activeTab === 'audio' && (
            <AudioPage audios={filteredAudios} />
          )}
          {activeTab === 'images' && (
            <ImagesPage images={filteredImages} onPreview={setPreviewItem} />
          )}
        </div>
      )}

      {/* Dynamic Overlay Preview Modal */}
      {previewItem && (
        <PreviewModal 
          activeItem={previewItem} 
          onClose={() => setPreviewItem(null)} 
        />
      )}
    </div>
  );
};

export default SidePanel;

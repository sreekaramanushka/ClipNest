import React from 'react';

const Tabs = ({ activeTab, setActiveTab, counts }) => {
  const tabsList = [
    { id: 'videos', label: '🎥 Videos', count: counts.videos || 0 },
    { id: 'audio', label: '🎵 Audio', count: counts.audios || 0 },
    { id: 'images', label: '🖼 Images', count: counts.images || 0 }
  ];

  return (
    <div className="tabs-container">
      {tabsList.map(tab => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-label">{tab.label}</span>
          <span className="tab-count">{tab.count}</span>
        </button>
      ))}
    </div>
  );
};

export default Tabs;

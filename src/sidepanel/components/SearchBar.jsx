import React from 'react';

const SearchBar = ({ filter, setFilter, onRefresh, loading }) => {
  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search extracted media..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        {filter && (
          <button className="search-clear-btn" onClick={() => setFilter('')} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>
      <button 
        className="btn-primary refresh-btn" 
        onClick={onRefresh}
        disabled={loading}
      >
        {loading ? 'Scanning...' : 'Refresh'}
      </button>
    </div>
  );
};

export default SearchBar;

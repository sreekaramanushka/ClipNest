import React from 'react';
import AudioCard from '../components/AudioCard.jsx';

const AudioPage = ({ audios }) => {
  return (
    <div className="audio-list">
      {audios.map(audio => (
        <AudioCard key={audio.id} audio={audio} />
      ))}
      {audios.length === 0 && (
        <p className="status-message">No audio tracks detected on this page.</p>
      )}
    </div>
  );
};

export default AudioPage;

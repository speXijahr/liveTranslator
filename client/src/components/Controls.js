// client/src/components/Controls.js
import React from 'react';

function Controls({ isTranscribing, onStart, onStop, isSpeaker }) {
  if (!isSpeaker) {
    return <div className="status-message">You are a viewer. Transcriptions will appear below.</div>;
  }

  return (
    <div className="controls-container">
      <button onClick={onStart} disabled={isTranscribing} className="start-btn">
        Start Transcription
      </button>
      <button onClick={onStop} disabled={!isTranscribing} className="stop-btn">
        Stop Transcription
      </button>
    </div>
  );
}

export default Controls;

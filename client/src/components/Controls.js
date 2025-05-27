// client/src/components/Controls.js
import React from 'react';
import './Controls.css'; // We'll create this for any specific container styling

function Controls({
  isTranscribing,
  onStart,
  onStop,
  isSpeaker,
  speechApiSupported, // Expect this prop from App.js
}) {
  // Log props for debugging if needed (can be removed in production)
  // console.log('CONTROLS_COMPONENT: Props -> isSpeaker:', isSpeaker, 'isTranscribing:', isTranscribing, 'speechApiSupported:', speechApiSupported, 'typeof onStart:', typeof onStart);

  if (!isSpeaker) {
    return (
      <div className="controls-status-message">
        You are a viewer. Transcriptions will appear if the speaker is active.
      </div>
    );
  }

  const handleClick = () => {
    if (isTranscribing) {
      console.log('CONTROLS_COMPONENT: Stop button part clicked.');
      if (typeof onStop === 'function') {
        onStop();
      } else {
        console.error('CONTROLS_COMPONENT: onStop prop is not a function!');
      }
    } else {
      console.log('CONTROLS_COMPONENT: Start button part clicked.');
      if (typeof onStart === 'function') {
        onStart();
      } else {
        console.error('CONTROLS_COMPONENT: onStart prop is not a function!');
      }
    }
  };

  const buttonText = isTranscribing ? 'Stop Recording' : 'Start Recording';
  const isDisabled = !speechApiSupported; // Button is disabled if API not supported

  return (
    <div className="controls-container">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`record-btn ${isTranscribing ? 'recording' : ''}`}
        aria-pressed={isTranscribing} // For accessibility
      >
        {buttonText}
      </button>
      {!isDisabled && ( // Show status only if button is enabled (API supported)
        <div className="transcription-status-inline">
          {isTranscribing ? 'Status: Recording...' : 'Status: Ready to record.'}
        </div>
      )}
      {isDisabled && (
        <div className="transcription-status-inline error-text">
          Speech recognition not available in this browser.
        </div>
      )}
    </div>
  );
}

export default Controls;
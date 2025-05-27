// client/src/components/RoomSelectionScreen.js
import React from 'react';
import './RoomSelectionScreen.css'; // Create or use your existing CSS

// Add onAttemptBecomeSpeakerForRoom to the destructured props
function RoomSelectionScreen({ rooms, onJoinRoom, onShowSpeakerSetupForm, onAttemptBecomeSpeakerForRoom }) {
  return (
    <div className="room-selection-container">
      <h2>Available Rooms</h2>
      {(!rooms || rooms.length === 0) && (
        <p className="no-rooms-message">
          No active rooms at the moment. Why not set one up as speaker?
        </p>
      )}
      {rooms && rooms.length > 0 && (
        <div className="room-grid">
          {rooms.map(room => (
            <div key={room.id} className="room-card">
              <h3>Room: {room.id}</h3>
              <p className="room-status">
                Status: {room.hasSpeaker ? 'Active (Speaker Present)' : 'Waiting for speaker'}
              </p>
              <p className="viewer-count">Viewers: {room.viewerCount || 0}</p>
              <div className="room-actions"> {/* Wrapper for buttons */}
                <button
                  onClick={() => onJoinRoom(room.id)}
                  className="btn btn-join-viewer"
                >
                  Join as Viewer
                </button>
                {!room.hasSpeaker && typeof onAttemptBecomeSpeakerForRoom === 'function' && (
                  <button
                    onClick={() => onAttemptBecomeSpeakerForRoom(room.id)}
                    className="btn btn-become-speaker"
                  >
                    Become Speaker
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onShowSpeakerSetupForm}
        className="btn btn-create-new-room" // More descriptive class
      >
        Set up New Room as Speaker
      </button>
    </div>
  );
}

export default RoomSelectionScreen;
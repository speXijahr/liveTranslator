// client/src/components/CreateRoomForm.js
import React, { useState } from 'react';
import './CreateRoomForm.css';

function CreateRoomForm({
    onFormSubmit,
    onCancel,
    error,
    title = "Set Up / Join Room as Speaker",
    submitButtonText = "Start as Speaker"
}) {
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [adminSecret, setAdminSecret] = useState(''); // New state for admin secret
    const [formError, setFormError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!roomId.trim() || !password.trim()) {
            setFormError('Room ID and Room Password cannot be empty.');
            return;
        }
        // Admin secret can be optional if user is trying to join an existing room as speaker
        // The server will validate if it's needed (for new rooms)
        setFormError('');
        onFormSubmit(roomId, password, adminSecret); // Pass adminSecret
    };

    return (
        <div className="create-room-form-container">
            <h2>{title}</h2>
            <form onSubmit={handleSubmit} className="create-room-form">
                <div className="form-group">
                    <label htmlFor="new-room-id-input">Room ID:</label>
                    <input
                        id="new-room-id-input"
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Enter Room ID"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="new-room-password-input">Room Password:</label>
                    <input
                        id="new-room-password-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Set/Enter password for this room"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="admin-secret-input">Admin Secret (for new room):</label>
                    <input
                        id="admin-secret-input"
                        type="password"
                        value={adminSecret}
                        onChange={(e) => setAdminSecret(e.target.value)}
                        placeholder="Required only if Room ID is new"
                    />
                    <small className="form-text text-muted">
                        Only needed if this Room ID does not exist yet.
                    </small>
                </div>
                {(formError || error) && <p className="error-message form-error">{formError || error}</p>}
                <div className="button-group">
                    <button type="submit" className="submit-btn">{submitButtonText}</button>
                    <button type="button" onClick={onCancel} className="cancel-btn">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}

export default CreateRoomForm;
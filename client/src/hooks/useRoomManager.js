// client/src/hooks/useRoomManager.js
import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_VIEWER_LANG } from '../config/constants';

const useRoomManager = (socket, { onRoomJoined, onRoomError, onRoomsListed } = {}) => {
    const [roomId, setRoomId] = useState(null);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [showSpeakerSetupForm, setShowSpeakerSetupForm] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');

    // DEFINE CALLBACKS FIRST
    const initiateSessionAsSpeaker = useCallback((speakerAttemptRoomId, password, adminSecret) => { // Add adminSecret param
        if (!socket || !socket.connected) {
            // ... (error handling)
            return;
        }
        if (!speakerAttemptRoomId || !password) {
            // ... (error handling)
            return;
        }
        setStatus(`Attempting to start session in room "${speakerAttemptRoomId}" as speaker...`);
        setError('');
    
        const payload = {
            roomId: speakerAttemptRoomId,
            password: password,
            isSpeaker: true,
            adminSecret: adminSecret // Include adminSecret
        };
        console.log('CLIENT: Emitting join_room with payload:', JSON.stringify(payload, null, 2));
        socket.emit('join_room', payload, (response) => {
            // ... (response handling logic remains the same) ...
            console.log('Client: Response from join_room (speaker attempt):', response);
            if (response.success) {
                setRoomId(response.roomId);
                setIsSpeaker(response.isSpeaker);
                if (response.isSpeaker) {
                    setShowSpeakerSetupForm(false);
                    setStatus('Session initiated successfully as Speaker.');
                    window.history.replaceState({}, '', `/?roomId=${response.roomId}`);
                } else {
                    setStatus(`Joined room "${response.roomId}", but not as speaker. ${response.message || ''}`);
                }
                if (onRoomJoined) onRoomJoined({
                    roomId: response.roomId,
                    isSpeaker: response.isSpeaker,
                    messages: response.messages || [],
                    preferredLang: response.isSpeaker ? null : (response.preferredLang || DEFAULT_VIEWER_LANG),
                    messageFromJoin: response.message
                });
            } else {
                setError(response.message || 'Failed to join or initiate room.');
                setStatus('');
                if (onRoomError) onRoomError(response.message || 'Failed to join or initiate room.');
            }
        });
    }, [socket, onRoomJoined, onRoomError, setShowSpeakerSetupForm, setRoomId, setIsSpeaker, setStatus, setError]);

    const joinSessionAsViewer = useCallback((viewerAttemptRoomId) => {
        if (!socket || !socket.connected) {
            setError("Not connected to server.");
            if (onRoomError) onRoomError("Not connected to server.");
            return;
        }
        setStatus(`Joining room "${viewerAttemptRoomId}" as viewer...`);
        setError('');
        socket.emit('join_room', {
            roomId: viewerAttemptRoomId,
            isSpeaker: false
        }, (response) => {
            console.log('Client: Response from join_room (viewer attempt):', response);
            if (response.success) {
                setRoomId(response.roomId);
                setIsSpeaker(response.isSpeaker);
                setShowSpeakerSetupForm(false);
                setStatus('Joined as Viewer.');
                if (!window.location.search.includes(`roomId=${viewerAttemptRoomId}`)) {
                    window.history.replaceState({}, '', `/?roomId=${viewerAttemptRoomId}`);
                }
                if (onRoomJoined) onRoomJoined({
                    roomId: response.roomId,
                    isSpeaker: response.isSpeaker,
                    messages: response.messages || [],
                    preferredLang: response.preferredLang || DEFAULT_VIEWER_LANG,
                    messageFromJoin: response.message
                });
            } else {
                setError(response.message || 'Failed to join room as viewer.');
                setStatus('');
                const params = new URLSearchParams(window.location.search);
                if (params.get('roomId') === viewerAttemptRoomId) {
                    window.history.replaceState({}, '', `/`);
                }
                if (onRoomError) onRoomError(response.message || 'Failed to join room as viewer.');
            }
        });
    }, [socket, onRoomJoined, onRoomError, setShowSpeakerSetupForm, setRoomId, setIsSpeaker, setStatus, setError]);

    const handleShowSpeakerSetupForm = useCallback((show) => {
        setShowSpeakerSetupForm(show);
        setError('');
        setStatus(show ? 'Ready to set up as speaker.' : (roomId ? status : 'Room selection.'));
    }, [roomId, status, setShowSpeakerSetupForm, setError, setStatus]);


    // THEN DEFINE useEffects that might use these callbacks
    useEffect(() => {
        if (!socket || !socket.connected) {
            if (socket && !socket.connected) {
                setStatus('Waiting for server connection...');
            }
            return;
        }
        setStatus('Fetching room information...');
        const params = new URLSearchParams(window.location.search);
        const existingRoomIdFromUrl = params.get('roomId');
        if (existingRoomIdFromUrl) {
            joinSessionAsViewer(existingRoomIdFromUrl); // This is line 32 (or around it now)
        } else {
            socket.emit('get_rooms', (roomList) => {
                setRooms(roomList || []);
                if (onRoomsListed) onRoomsListed(roomList || []);
                setStatus('Room list loaded.');
            });
        }
    }, [socket, socket?.connected, joinSessionAsViewer, onRoomsListed]);

    useEffect(() => {
        if (socket) {
            const roomUpdateHandler = (updatedRooms) => {
                setRooms(updatedRooms || []);
                if (onRoomsListed) onRoomsListed(updatedRooms || []);
            };
            socket.on('rooms_updated', roomUpdateHandler);
            return () => {
                socket.off('rooms_updated', roomUpdateHandler);
            };
        }
   }, [socket, onRoomsListed]);

    return {
        roomId,
        isSpeaker,
        rooms,
        showSpeakerSetupForm,
        initiateSessionAsSpeaker,
        joinSessionAsViewer,
        handleShowSpeakerSetupForm,
        status,
        error
    };
};

export default useRoomManager;
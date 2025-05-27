import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const useSocketManager = (serverUrl, eventHandlers = {}) => {
    const [socket, setSocket] = useState(null);
    const [status, setStatus] = useState('Initializing...'); // e.g., 'Connecting', 'Connected', 'Disconnected'
    const [error, setError] = useState(null);
    const socketRef = useRef(null); // To hold the socket instance across re-renders without causing effect re-runs

    // Use a ref to hold the latest event handlers to avoid re-running the effect if only handlers change
    const savedEventHandlers = useRef(eventHandlers);
    useEffect(() => {
        savedEventHandlers.current = eventHandlers;
    }, [eventHandlers]);

    useEffect(() => {
        const newSocket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 45000, // Increased timeout
            autoConnect: true, // Explicitly true, though default
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
        setStatus('Connecting to server...');

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            setStatus('Connected');
            setError(null);
            if (savedEventHandlers.current.onConnect) {
                savedEventHandlers.current.onConnect(newSocket.id);
            }
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            // Only set status to disconnected if it wasn't an intentional disconnect by client
            if (reason === 'io client disconnect') {
                setStatus('Disconnected by client');
            } else {
                setStatus(`Disconnected: ${reason}. Attempting to reconnect...`);
                setError('Lost connection to the server.');
            }
            if (savedEventHandlers.current.onDisconnect) {
                savedEventHandlers.current.onDisconnect(reason);
            }
        });

        newSocket.on('connect_error', (err) => {
            console.error('Socket Connection Error:', err);
            setStatus('Connection failed');
            setError(`Connection error: ${err.message}. Please check server and network.`);
            if (savedEventHandlers.current.onConnectError) {
                savedEventHandlers.current.onConnectError(err);
            }
        });

        // Register other app-specific event handlers
        if (savedEventHandlers.current.onNewTranscription) {
            newSocket.on('new_transcription', savedEventHandlers.current.onNewTranscription);
        }
        if (savedEventHandlers.current.onSpeakerLeft) {
            newSocket.on('speaker_left', savedEventHandlers.current.onSpeakerLeft);
        }
        if (savedEventHandlers.current.onTranslatedMessage) {
            newSocket.on('translated_message', savedEventHandlers.current.onTranslatedMessage);
        }
        if (savedEventHandlers.current.onTranslationError) {
            newSocket.on('translation_error', savedEventHandlers.current.onTranslationError);
        }
         // Add any other general message handlers here

        return () => {
            console.log('Cleaning up socket connection for:', newSocket.id);
            newSocket.off('connect');
            newSocket.off('disconnect');
            newSocket.off('connect_error');
            if (savedEventHandlers.current.onNewTranscription) newSocket.off('new_transcription');
            if (savedEventHandlers.current.onSpeakerLeft) newSocket.off('speaker_left');
            if (savedEventHandlers.current.onTranslatedMessage) newSocket.off('translated_message');
            if (savedEventHandlers.current.onTranslationError) newSocket.off('translation_error');
            newSocket.disconnect();
            socketRef.current = null; // Clear ref
            setSocket(null); // Clear state
        };
    }, [serverUrl]); // Only re-run if serverUrl changes

    return { socket, status, error };
};

export default useSocketManager;
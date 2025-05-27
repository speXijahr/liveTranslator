// client/src/App.js
import React, { useState, useEffect, useCallback } from 'react';

// Config & Constants
import {
    SERVER_URL,
    SPEAKER_LANGUAGES, VIEWER_LANGUAGES,
    DEFAULT_SPEAKER_LANG, DEFAULT_VIEWER_LANG
} from './config/constants';

// Hooks
import useSocketManager from './hooks/useSocketManager';
import useRoomManager from './hooks/useRoomManager';
import useSpeechRecognition from './hooks/useSpeechRecognition';

// Components
import ReusableLanguageSelector from './components/ReusableLanguageSelector';
import TranscriptDisplay from './components/TranscriptDisplay';
import QRCodeDisplay from './components/QRCodeDisplay';
import RoomSelectionScreen from './components/RoomSelectionScreen';
import CreateRoomForm from './components/CreateRoomForm';
import Controls from './components/Controls';

import './App.css';

// Helper for message processing (can be moved to a utils file)
// Make sure 'isSpeaker' is accessible if processMessage needs it,
// or simplify if this function is ONLY for server messages which are always 'speaker'
// For messages from 'new_transcription', they are by definition from the speaker.
const processMessage = (msgFromServer, currentSpeakerLangForMsg) => {
    // Defensive check for msgFromServer
    const messageData = msgFromServer && typeof msgFromServer === 'object' ? msgFromServer : {};

    return {
        id: messageData.id || `client-${Date.now()}-${Math.random()}`, // Generate ID if missing
        text: messageData.text || '', // Original transcript
        sourceLang: messageData.sourceLang || currentSpeakerLangForMsg,
        senderType: 'speaker', // Messages from 'new_transcription' are from the speaker
        translations: messageData.translations && typeof messageData.translations === 'object' ? messageData.translations : {},
        isTranslating: messageData.isTranslating && typeof messageData.isTranslating === 'object' ? messageData.isTranslating : {},
        timestamp: messageData.timestamp || Date.now(),
    };
};

function App() {
    // Core application state
    const [messages, setMessages] = useState([]);
    const [appError, setAppError] = useState('');
    const [appStatus, setAppStatus] = useState('Initializing...');
    const [selectedSpeakerLang, setSelectedSpeakerLang] = useState(DEFAULT_SPEAKER_LANG);
    const [selectedViewerLang, setSelectedViewerLang] = useState(DEFAULT_VIEWER_LANG);

    // --- Initialize Hooks ---

    const { socket, socketStatus, socketError } = useSocketManager(SERVER_URL, {
        // Pass callbacks for socket events that App.js needs to react to directly
        onNewTranscription: (messageFromServer) => {
            setMessages(prev => [...prev, processMessage(messageFromServer, selectedSpeakerLang)]);
        },
        onSpeakerLeft: (data) => {
            setAppError(data.message || "Speaker has left.");
            setAppStatus('Session ended by speaker.');
            // Additional logic if needed, e.g. if current user was the speaker
        },
        onTranslatedMessage: ({ originalMessageId, translatedText, targetLang }) => {
            setMessages(prev => prev.map(msg => msg.id === originalMessageId ? {
                ...msg,
                translations: { ...(msg.translations || {}), [targetLang]: translatedText },
                isTranslating: { ...(msg.isTranslating || {}), [targetLang]: false }
            } : msg));
        },
        onTranslationError: ({ messageId, error: translationErrText, targetLang }) => {
            console.error(`Translation error for ${messageId} to ${targetLang}:`, translationErrText);
            setAppError(`Translation failed for a message.`);
            setMessages(prev => prev.map(msg => msg.id === messageId ? {
                ...msg, isTranslating: { ...(msg.isTranslating || {}), [targetLang]: false }
            } : msg));
            setTimeout(() => setAppError(''), 5000);
        }
    });

    const onRoomJoined = useCallback((details) => {
        setMessages(details.messages || []);
        if (!details.isSpeaker) {
            setSelectedViewerLang(details.preferredLang || DEFAULT_VIEWER_LANG);
        }
        setAppStatus(details.isSpeaker ? 'Session started as Speaker.' : 'Joined as Viewer.');
        setAppError(details.isSpeaker && !details.messageFromJoin ? '' : (details.messageFromJoin || ''));
    }, [setMessages, setSelectedViewerLang, setAppStatus, setAppError]);


    const onRoomError = useCallback((errMessage) => {
        setAppError(errMessage);
    }, [setAppError]); // Dependency is a setter (stable)

    const onRoomsListed = useCallback((roomList) => {
        // console.log('App.js: Rooms listed:', roomList);
        // You can add logic here if App.js needs to react to the room list directly
        // For example, if no rooms and not in a room, set a specific appStatus
        // if (roomList.length === 0 && !roomId) { // roomId would need to be a dependency if used
        //   setAppStatus("No active rooms. Feel free to create one!");
        // }
    }, []); // Add dependencies if it uses any state/props from App.js
    

    const {
        roomId,
        isSpeaker,
        rooms,
        showSpeakerSetupForm,
        initiateSessionAsSpeaker,
        joinSessionAsViewer,
        handleShowSpeakerSetupForm,
        status: roomStatus,
        error: roomErrorManager // Renamed to avoid conflict with appError if needed
    } = useRoomManager(socket, {
        onRoomJoined, // Pass the memoized callback
        onRoomError,  // Pass the memoized callback
        onRoomsListed // Pass the memoized callback
    });

      // NEW: Memoize onTranscriptionResult
      const onTranscriptionResult = useCallback((transcript) => {
        // Ensure socket, roomId, isSpeaker, selectedSpeakerLang are stable or correctly in deps
        // If they are props or state from App.js, they should be in this useCallback's dependency array
        if (socket && roomId && isSpeaker && transcript) {
            socket.emit('transcribe_data', {
                roomId,
                transcript,
                sourceLang: selectedSpeakerLang,
            });
        }
    }, [socket, roomId, isSpeaker, selectedSpeakerLang]); // Add dependencies used by this callback

    
    const handleRecognitionError = useCallback((errorMessage) => {
        setAppError(prevError => `${prevError} SpeechErr: ${errorMessage}`); // Example: append or set
    }, [setAppError]);


    const {
        isTranscribing, startTranscription, stopTranscription,
        isApiSupported: speechApiSupported,
        recognitionError,
        recognitionStatus
    } = useSpeechRecognition({
        isSpeaker,
        currentLanguage: selectedSpeakerLang,
        onTranscriptionResult: onTranscriptionResult, // Pass the memoized version
        onRecognitionError: handleRecognitionError, // Pass memoized if used
        // onRecognitionStatusChange: memoizedHandleRecognitionStatusChange, // If used
    });



    if (roomId && isSpeaker) { // Only log if we intend to show speaker controls
        console.log('APP_JS: Preparing props for Controls -> isSpeaker:', isSpeaker, 'isTranscribing:', isTranscribing, 'canRecord:', speechApiSupported, 'onStart is func:', typeof startTranscription === 'function');
    }

    // --- Aggregate status and error handling ---
    useEffect(() => {
        // Prioritize errors from different sources
        if (socketError) setAppError(socketError);
        else if (roomErrorManager) setAppError(roomErrorManager);
        else if (recognitionError) setAppError(recognitionError);
        // else setAppError(''); // Be careful not to clear errors too eagerly
    }, [socketError, roomErrorManager, recognitionError]);

    useEffect(() => {
        // More sophisticated status aggregation
        if (socketStatus && socketStatus !== 'Connected' && socketStatus !== 'Initializing...') {
            setAppStatus(socketStatus);
        } else if (roomStatus) {
            setAppStatus(roomStatus);
        } else if (isSpeaker && recognitionError) { // Show recognition error as status if speaker
            setAppStatus(`Mic status: ${recognitionError}`);
        } else if (isSpeaker && isTranscribing) {
            setAppStatus('Listening...');
        } else if (isSpeaker) {
            setAppStatus('Ready to record.');
        } else if (roomId) {
            setAppStatus('Viewing transcriptions.');
        } else if (socketStatus === 'Connected') {
            setAppStatus('Select or create a room.');
        } else {
            setAppStatus(socketStatus || 'Initializing...');
        }
    }, [socketStatus, roomStatus, recognitionError, isSpeaker, isTranscribing, roomId]);

    const handleAttemptBecomeSpeakerForExistingRoom = useCallback((roomIdForSpeakerAttempt) => {
        const password = prompt(`Enter password to become speaker for room "${roomIdForSpeakerAttempt}":`);
        if (password) { // User entered something and didn't cancel
            initiateSessionAsSpeaker(roomIdForSpeakerAttempt, password);
        } else if (password === "") { // User entered blank password
            setAppError("Password cannot be empty to become a speaker.");
            setTimeout(() => setAppError(''), 5000); // Clear error after 5s
        }
        // If password is null (user cancelled prompt), do nothing.
    }, [initiateSessionAsSpeaker, setAppError]); // `initiateSessionAsSpeaker` is from useRoomManager


    // --- UI Event Handlers ---
    const handleSpeakerLanguageChange = useCallback((lang) => {
        const wasTranscribing = isTranscribing;
        if (wasTranscribing) {
            stopTranscription();
        }
        setSelectedSpeakerLang(lang);
        if (wasTranscribing && isSpeaker) {
            // Allow speech hook to adjust to new language prop then restart
            setTimeout(() => startTranscription(), 250);
        }
    }, [isTranscribing, stopTranscription, isSpeaker, startTranscription]);

    const handleViewerLanguageChange = (lang) => {
        setSelectedViewerLang(lang);
    };

    const handleTranslateRequest = useCallback((messageId, targetLang) => {
        if (!socket || !roomId || !messageId || !targetLang) return;
        setMessages(prev => prev.map(msg => msg.id === messageId ? {
            ...msg, isTranslating: { ...(msg.isTranslating || {}), [targetLang]: true }
        } : msg));
        socket.emit('request_translation', { roomId, messageId, targetLang });
    }, [socket, roomId]);

    // --- Render Logic ---
    const effectiveAppStatus = appError ? '' : appStatus; // Hide status if error is present

    if (!speechApiSupported && isSpeaker /* This condition will be true once isSpeaker is confirmed by useRoomManager */) {
        return (
            <div className="App">
                <header className="header"><h1>Voice Transcription</h1></header>
                <div className="error-message">
                    Speech Recognition API is not supported in this browser.
                    Please try a different browser like Chrome or Edge.
                </div>
            </div>
        );
    }

    return (
        <div className="App">
            <header className="header">
                <h1>Voice Transcription</h1>
                {roomId && <div className="room-indicator">Room: {roomId} {isSpeaker ? "(Speaker)" : "(Viewer)"}</div>}
            </header>

            {!roomId && !showSpeakerSetupForm && (
                <RoomSelectionScreen
                    rooms={rooms}
                    onJoinRoom={(selectedRoomId) => joinSessionAsViewer(selectedRoomId)}
                    onShowSpeakerSetupForm={() => handleShowSpeakerSetupForm(true)}
                    onAttemptBecomeSpeakerForRoom={handleAttemptBecomeSpeakerForExistingRoom} // <<< Pass the new handler
                />
            )}

            {!roomId && showSpeakerSetupForm && (
                <CreateRoomForm
                    title="Set Up / Join Room as Speaker"
                    submitButtonText="Start as Speaker"
                    // onFormSubmit now takes (id, pass, adminSecret)
                    onFormSubmit={(id, pass, adminSecretValue) => initiateSessionAsSpeaker(id, pass, adminSecretValue)}
                    onCancel={() => handleShowSpeakerSetupForm(false)}
                // error={roomErrorManager}
                />
            )}

            {/* ... (In-Room UI when roomId is set) ... */}
            {roomId && (
                <>
                    {isSpeaker && (
                        <div className="controls-section speaker-controls">
                            <ReusableLanguageSelector
                                id="speaker-language"
                                label="Your Language:"
                                options={SPEAKER_LANGUAGES}
                                selectedValue={selectedSpeakerLang}
                                onChange={handleSpeakerLanguageChange}
                            />
                            <Controls
                                isSpeaker={isSpeaker}
                                isTranscribing={isTranscribing}
                                onStart={startTranscription}
                                onStop={stopTranscription}
                                speechApiSupported={speechApiSupported}
                            />
                            {recognitionError && <p className="error-message">{recognitionError}</p>}
                        </div>
                    )}
                    {!isSpeaker && roomId && (
                        <div className="controls-section viewer-controls">
                            <ReusableLanguageSelector
                                id="viewer-language"
                                label="Translate Messages To:"
                                options={VIEWER_LANGUAGES}
                                selectedValue={selectedViewerLang}
                                onChange={handleViewerLanguageChange}
                            />
                        </div>
                    )}
                    <TranscriptDisplay
                        messages={messages}
                        isSpeaker={isSpeaker}
                        selectedLanguage={selectedViewerLang}
                        onTranslate={handleTranslateRequest}
                        speakerLanguage={selectedSpeakerLang} // Original language of the speaker
                        availableTranslationLanguages={VIEWER_LANGUAGES.filter(l => l.value !== '')}
                    />
                    {isSpeaker && <QRCodeDisplay roomId={roomId} />}
                </>
            )}


            {appError && <div className="error-message">{appError}</div>}
            {/* {effectiveAppStatus && <div className="status-message">{effectiveAppStatus}</div>} */}
        </div>
    );
}

export default App;
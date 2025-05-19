// client/src/App.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import ReusableLanguageSelector from './components/ReusableLanguageSelector'; // Updated import
import TranscriptDisplay from './components/TranscriptDisplay';
import QRCodeDisplay from './components/QRCodeDisplay';
import './App.css'; // Ensure this is imported

// Determine the server URL based on environment
const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin  // Use the same origin in production
  : 'http://localhost:8080'; // Use localhost in development

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognitionInstance;
if (SpeechRecognition) {
    recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true; // Keep listening even after a pause
    recognitionInstance.interimResults = false; // We only want final results
} else {
    console.error("Speech Recognition API not supported in this browser.");
}

// Define language options centrally
const SPEAKER_LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'cs-CZ', label: 'Czech' },
  // Add more speaker languages as needed
];

const VIEWER_LANGUAGES = [
  { value: '', label: 'Original Language' }, // Option to view original
  { value: 'EN-US', label: 'English (US)' }, // Note: Ensure backend expects these codes (e.g. 'EN-US' vs 'en-US')
  { value: 'IT', label: 'Italian' },
  { value: 'CS', label: 'Czech' },
  // Add more viewer languages as needed
];


function App() {
    const [socket, setSocket] = useState(null);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [roomId, setRoomId] = useState(null);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [selectedLang, setSelectedLang] = useState(SPEAKER_LANGUAGES[0].value); // Speaker's input language
    const [selectedViewerLang, setSelectedViewerLang] = useState(VIEWER_LANGUAGES[0].value); // Viewer's target translation language
    const [messages, setMessages] = useState([]); // Ensure this is always an array
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Initializing...');

    const recognitionRef = useRef(recognitionInstance);

    // Helper to ensure messages have a consistent structure
    const processMessage = (msg) => ({
        id: msg.id || `client-${Date.now()}-${Math.random()}`, // Fallback ID, server ID preferred
        text: msg.text || '',
        sourceLang: msg.sourceLang || selectedLang,
        senderType: msg.senderType || 'speaker', // Default to speaker for new transcriptions
        translations: msg.translations || {},
        isTranslating: msg.isTranslating || {},
        timestamp: msg.timestamp || Date.now(),
    });

    const createNewRoom = useCallback((sock) => {
        sock.emit('create_room', (newRoomId) => {
            setRoomId(newRoomId);
            setIsSpeaker(true);
            setMessages([]); // Clear messages for new room
            setStatus('New room created. You are the Speaker.');
            window.history.replaceState({}, '', `/?roomId=${newRoomId}`);
            if (recognitionRef.current) {
                recognitionRef.current.lang = selectedLang;
            }
            setError('');
            setSelectedViewerLang(VIEWER_LANGUAGES[0].value); // Reset viewer lang choice
        });
    }, [selectedLang]); // Keep selectedLang dependency

    useEffect(() => {
        const newSocket = io(SERVER_URL);
        setSocket(newSocket);
        setStatus('Connecting to server...');

        const params = new URLSearchParams(window.location.search);
        const existingRoomId = params.get('roomId');

        const joinOrCreateRoom = (id) => {
            if (id) {
                newSocket.emit('join_room', { roomId: id }, (response) => {
                    if (response.success) {
                        const initialMessages = Array.isArray(response.messages) ? response.messages.map(processMessage) : [];
                        setRoomId(id);
                        setIsSpeaker(response.isSpeaker);
                        setMessages(initialMessages);
                        setStatus(response.isSpeaker ? 'Rejoined as Speaker' : 'Joined as Viewer');
                        if (response.isSpeaker && recognitionRef.current) {
                            recognitionRef.current.lang = selectedLang; // Use current selectedLang
                        }
                         // If viewer, set their language preference if they had one, or default
                        setSelectedViewerLang(response.preferredLang || VIEWER_LANGUAGES[0].value);
                    } else {
                        setError(`Room "${id}" not found. Creating a new room.`);
                        createNewRoom(newSocket);
                    }
                });
            } else {
                createNewRoom(newSocket);
            }
        };

        newSocket.on('connect', () => {
            setStatus('Connected. Joining room...');
            joinOrCreateRoom(existingRoomId);
        });

        newSocket.on('new_transcription', (messageFromServer) => {
            // Assuming server sends message with id, text, sourceLang
            setMessages(prevMessages => [...prevMessages, processMessage(messageFromServer)]);
        });

        newSocket.on('speaker_left', (data) => {
            setError(data.message || "Speaker has left the session. Refresh to start/join a new session.");
            setIsTranscribing(false);
            if (recognitionRef.current) recognitionRef.current.stop();
            // Don't set isSpeaker to false if the current user *was* the speaker.
            // Instead, perhaps disable controls or indicate room is inactive.
            // For a viewer, this is fine.
            if (!isSpeaker) { // Only clear messages if this user is a viewer
                setMessages([]);
            }
            setStatus('Session ended by speaker.');
        });

        newSocket.on('translated_message', ({ originalMessageId, translatedText, targetLang }) => {
            setMessages(prevMessages =>
                prevMessages.map(msg => {
                    if (msg.id === originalMessageId) {
                        return {
                            ...msg,
                            translations: {
                                ...(msg.translations || {}),
                                [targetLang]: translatedText // Store only the text
                            },
                            isTranslating: {
                                ...(msg.isTranslating || {}),
                                [targetLang]: false
                            }
                        };
                    }
                    return msg;
                })
            );
        });

        newSocket.on('translation_error', ({ messageId, error: translationError, targetLang }) => {
            console.error(`Translation error for message ${messageId} to ${targetLang}:`, translationError);
            setError(`Translation failed for a message.`); // Keep it brief
            setMessages(prevMessages =>
                prevMessages.map(msg => {
                    if (msg.id === messageId) {
                        return {
                            ...msg,
                            isTranslating: {
                                ...(msg.isTranslating || {}),
                                [targetLang]: false // Reset specific language flag
                            }
                        };
                    }
                    return msg;
                })
            );
            setTimeout(() => setError(''), 5000); // Clear error after 5s
        });

        newSocket.on('connect_error', (err) => {
            console.error('Connection Error:', err);
            setError('Failed to connect to the server. Please check your connection or try again later.');
            setStatus('Connection failed.');
        });

        newSocket.on('disconnect', (reason) => {
            setStatus(`Disconnected: ${reason}. Attempting to reconnect...`);
            setError('Lost connection to the server.');
             // Optionally, implement reconnection logic or inform user
        });

        return () => {
            newSocket.disconnect();
            if (recognitionRef.current && (isTranscribing || (recognitionRef.current.readyState === 1 /* listening */))) {
                recognitionRef.current.stop();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createNewRoom]); // createNewRoom is memoized and its deps are handled


    // Speech Recognition effect
    useEffect(() => {
        if (!recognitionRef.current || !isSpeaker) {
            if (isTranscribing && recognitionRef.current) {
                recognitionRef.current.stop(); // Ensure stop if no longer speaker
            }
            setIsTranscribing(false);
            return;
        }

        const rec = recognitionRef.current;
        rec.lang = selectedLang; // Always set the language before starting

        rec.onstart = () => {
            setIsTranscribing(true);
            setStatus('Listening...');
            setError('');
        };

        rec.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            let specificError = `Speech error: ${event.error}.`;
            if (event.error === 'no-speech') {
                specificError += " No speech detected. Please ensure your mic is working and you are speaking.";
            } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                specificError = "Microphone access denied. Please allow microphone access in your browser settings and refresh the page.";
                setIsTranscribing(false); // Stop trying if permission denied
            } else if (event.error === 'aborted') {
                specificError += " Recognition aborted. This can happen if you switch languages rapidly.";
            } else {
                // For other errors, we might not want to stop transcription immediately
                // as some might be transient.
                // setIsTranscribing(false); // Uncomment if you want to stop on any error
            }
            setError(specificError);
        };

        rec.onend = () => {
            const shouldRestart = isTranscribing && isSpeaker && !error.includes("access denied");
            setIsTranscribing(false); // Set to false first

            if (shouldRestart) {
                 // Brief pause before attempting to restart, to avoid rapid fire errors
                setTimeout(() => {
                    if (isSpeaker && recognitionRef.current) { // Check isSpeaker again, in case it changed
                         try {
                            if (recognitionRef.current.lang !== selectedLang) { // Ensure lang is current
                                recognitionRef.current.lang = selectedLang;
                            }
                            recognitionRef.current.start();
                        } catch (e) {
                            console.error("Error restarting recognition:", e);
                            setError("Could not restart voice recognition.");
                        }
                    }
                }, 250);
            } else if (isSpeaker) {
                setStatus('Ready to record');
            } else {
                setStatus('Viewing');
            }
        };

        rec.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript.trim() && socket && roomId && isSpeaker) {
                socket.emit('transcribe_data', {
                    roomId,
                    transcript: finalTranscript.trim(),
                    sourceLang: selectedLang, // Send the source language
                });
            }
        };
        // Cleanup function
        return () => {
            if (rec) {
                rec.onstart = null;
                rec.onresult = null;
                rec.onerror = null;
                rec.onend = null;
                if (isTranscribing || (rec.readyState === 1 /* Listening state */)) {
                    rec.abort(); // Use abort for more immediate stop
                }
            }
        };
    }, [socket, roomId, isSpeaker, selectedLang, error, isTranscribing]); // isTranscribing added to deps for onend logic to correctly assess restart

    const handleStartTranscription = useCallback(() => {
        if (!recognitionRef.current) {
            setError("Speech Recognition is not available on this browser.");
            return;
        }
        if (!isSpeaker || !socket || !roomId) {
            setError("Cannot start: Not designated as speaker or not connected to a room.");
            return;
        }
        if (isTranscribing) return;

        try {
            setError('');
            // Language is set in the useEffect for recognition
            if (recognitionRef.current.lang !== selectedLang) {
                recognitionRef.current.lang = selectedLang;
            }
            recognitionRef.current.start();
        } catch (e) {
            console.error("Error starting recognition:", e);
            setError("Failed to start voice recognition. Check microphone permissions or try a different browser.");
            setIsTranscribing(false);
        }
    }, [isSpeaker, socket, roomId, selectedLang, isTranscribing]);

    const handleStopTranscription = useCallback(() => {
        setIsTranscribing(false); // This will trigger onend logic in useEffect to stop
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setStatus(isSpeaker ? 'Transcription stopped. Ready to record.' : 'Viewing');
    }, [isSpeaker]);


    const handleLanguageChange = (lang) => {
        const wasTranscribing = isTranscribing;
        if (wasTranscribing) {
            handleStopTranscription(); // Stop current transcription
        }
        setSelectedLang(lang);
        // The useEffect for speech recognition will pick up the new selectedLang
        // and apply it if/when transcription restarts.
        if (wasTranscribing && isSpeaker) {
             // Add a slight delay to allow recognition to fully stop and language to set
            setTimeout(() => handleStartTranscription(), 300);
        }
    };

    const handleViewerLanguageChange = (lang) => {
        setSelectedViewerLang(lang);
        // Existing messages won't auto-translate unless explicitly requested.
        // New messages could potentially be auto-translated if 'lang' is set,
        // but current logic requires manual click per message.
    };

    const handleTranslateRequest = useCallback((messageId, targetLang) => {
        if (!socket || !roomId || !messageId || !targetLang) {
            console.warn("Translate request aborted: missing parameters", { socket, roomId, messageId, targetLang });
            return;
        }
        // Optimistically update UI
        setMessages(prevMessages =>
            prevMessages.map(msg => {
                if (msg.id === messageId) {
                    return {
                        ...msg,
                        isTranslating: {
                            ...(msg.isTranslating || {}),
                            [targetLang]: true
                        }
                    };
                }
                return msg;
            })
        );
        socket.emit('request_translation', { roomId, messageId, targetLang });
    }, [socket, roomId]);


    if (!SpeechRecognition && isSpeaker) {
        return (
            <div className="App">
                <div className="header"><h1>Voice Transcription</h1></div>
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
                <h1>{isSpeaker ? "Live Transcription" : "Viewing Session"}</h1>
                {status && <p className="status-indicator">{status}</p>}
                {error && <div className="error-message" role="alert">{error}</div>}
            </header>

            {isSpeaker && (
                <div className="controls-section">
                    <ReusableLanguageSelector
                        id="speaker-language"
                        label="Your Spoken Language:"
                        options={SPEAKER_LANGUAGES}
                        selectedValue={selectedLang}
                        onChange={handleLanguageChange}
                        disabled={isTranscribing}
                    />
                    <button
                        type="button"
                        className={`record-btn ${isTranscribing ? 'recording' : ''}`}
                        onClick={isTranscribing ? handleStopTranscription : handleStartTranscription}
                        disabled={!!error.includes("access denied")} // Disable if mic access is the core issue
                        aria-live="polite"
                    >
                        {/* Add an icon here if desired */}
                        {isTranscribing ? 'Stop Recording' : 'Start Recording'}
                    </button>
                </div>
            )}

            {!isSpeaker && roomId && ( // Show viewer language selector only if viewer and in a room
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
                selectedLanguage={selectedViewerLang} // Viewer's target language for translation
                onTranslate={handleTranslateRequest}
                // Pass speaker's current language for context if needed, e.g. to show "Original (English)"
                speakerLanguage={selectedLang}
            />

            {isSpeaker && roomId && (
                <QRCodeDisplay roomId={roomId} />
            )}

            {!roomId && !error && ( // Initial state before room is created/joined
                 <div className="status-message">
                    <p>Loading session...</p>
                    {/* You could add a spinner here */}
                </div>
            )}
        </div>
    );
}

export default App;
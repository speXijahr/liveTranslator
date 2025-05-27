// client/src/hooks/useSpeechRecognition.js
import { useState, useEffect, useRef, useCallback } from 'react';

const WebSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const useSpeechRecognition = ({
    isSpeaker, // Prop indicating if the current user is the designated speaker
    currentLanguage, // Prop for the language to be recognized
    onTranscriptionResult, // Callback: (transcript: string) => void
    onRecognitionError, // Optional Callback: (errorMessage: string) => void
    onRecognitionStatusChange, // Optional Callback: (statusMessage: string) => void
} = {}) => {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [internalError, setInternalError] = useState('');
    const [internalStatus, setInternalStatus] = useState(isSpeaker ? 'Ready' : 'Viewer mode');

    const recognitionRef = useRef(null);
    const isApiSupported = useRef(!!WebSpeechRecognition);
    // Ref to control automatic restarts, especially after manual stops or critical errors
    const attemptRestartRef = useRef(true);

    // Initialize or update recognition instance and its event handlers
    useEffect(() => {
        if (!isApiSupported.current || !isSpeaker) {
            // If not supported or no longer the speaker, ensure recognition is stopped
            if (recognitionRef.current && (isTranscribing || recognitionRef.current.recognizing)) { // .recognizing might not be standard
                attemptRestartRef.current = false; // Prevent restart
                recognitionRef.current.abort(); // More immediate stop
                setIsTranscribing(false);
                setInternalStatus(isSpeaker ? 'Mic off (not speaker)' : 'Viewing (mic disabled)');
                if (onRecognitionStatusChange) onRecognitionStatusChange(isSpeaker ? 'Mic off (not speaker)' : 'Viewing (mic disabled)');
            }
            return; // Exit early
        }

        // Initialize SpeechRecognition instance if it doesn't exist
        if (!recognitionRef.current) {
            recognitionRef.current = new WebSpeechRecognition();
            recognitionRef.current.continuous = true; // Keep listening
            recognitionRef.current.interimResults = false; // We only want final results
        }

        const rec = recognitionRef.current;
        rec.lang = currentLanguage; // Set language

        // Event Handlers
        rec.onstart = () => {
            setIsTranscribing(true);
            setInternalStatus('Listening...');
            setInternalError(''); // Clear previous errors
            if (onRecognitionStatusChange) onRecognitionStatusChange('Listening...');
            if (onRecognitionError) onRecognitionError(''); // Clear error in parent
            attemptRestartRef.current = true; // Default to allowing restart
        };

        rec.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript.trim() && onTranscriptionResult) {
                onTranscriptionResult(finalTranscript.trim());
            }
        };

        rec.onerror = (event) => {
            console.error('Speech recognition error:', event.error, event.message);
            let specificError = `Speech error: ${event.error}.`;
            if (event.error === 'no-speech') {
                specificError += " No speech detected. Please ensure your mic is working and try again.";
                // For no-speech, we might want to allow restart unless it's persistent
            } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                specificError = "Microphone access denied. Please allow microphone access in your browser settings and refresh.";
                attemptRestartRef.current = false; // Critical error, don't attempt to restart
                setIsTranscribing(false); // Stop immediately
            } else if (event.error === 'aborted') {
                specificError += " Recognition aborted."; // Can be due to manual stop or rapid changes
                // attemptRestartRef is usually set to false before manual abort/stop
            } else if (event.error === 'network') {
                specificError += " Network error during speech recognition. Please check your connection.";
            } else if (event.error === 'audio-capture') {
                specificError += " Audio capture failed. Check microphone hardware/permissions.";
                attemptRestartRef.current = false;
                setIsTranscribing(false);
            } else {
                specificError += ` ${event.message || 'An unknown error occurred.'}`;
            }
            setInternalError(specificError);
            if (onRecognitionError) onRecognitionError(specificError);
            // Let onend handle setIsTranscribing for non-critical errors to allow restart logic
        };

        rec.onend = () => {
            const wasTranscribingBeforeEnd = isTranscribing;
            setIsTranscribing(false); // Update state first
            const currentStatus = isSpeaker ? 'Mic off. Ready to start.' : 'Viewing (mic off)';
            setInternalStatus(currentStatus);
            if (onRecognitionStatusChange) onRecognitionStatusChange(currentStatus);

            console.log('Speech recognition ended. Attempting restart?', attemptRestartRef.current, 'Was transcribing?', wasTranscribingBeforeEnd, 'Is speaker?', isSpeaker);
            // Only restart if it was transcribing, user is still speaker, and restart is permitted
            if (wasTranscribingBeforeEnd && isSpeaker && attemptRestartRef.current) {
                console.log('Attempting to restart speech recognition...');
                setTimeout(() => {
                    // Double check conditions before restarting
                    if (isSpeaker && recognitionRef.current && attemptRestartRef.current) {
                        try {
                            if (recognitionRef.current.lang !== currentLanguage) {
                                recognitionRef.current.lang = currentLanguage;
                            }
                            recognitionRef.current.start();
                        } catch (e) {
                            console.error("Error restarting recognition:", e);
                            const restartErrorMsg = "Could not restart voice recognition.";
                            setInternalError(restartErrorMsg);
                            if (onRecognitionError) onRecognitionError(restartErrorMsg);
                        }
                    } else {
                        console.log('Conditions for restart no longer met.');
                    }
                }, 250); // Brief pause to avoid rapid error loops
            }
        };

        // Cleanup: remove event listeners and abort if necessary
        return () => {
            if (rec) {
                attemptRestartRef.current = false; // Prevent restart on cleanup
                // Check if recognition is active before trying to abort
                // The readyState might not be universally supported, but common in WebkitSpeechRecognition
                // 0: done, 1: listening, 2: recognizing
                try {
                    if (typeof rec.readyState === 'number' && rec.readyState !== 0) { // SpeechRecognition.DONE is 0
                        rec.abort();
                    } else if (isTranscribing) { // Fallback if readyState isn't available
                        rec.abort();
                    }
                } catch (e) {
                    console.warn("Error aborting speech recognition on cleanup:", e);
                }
                rec.onstart = null;
                rec.onresult = null;
                rec.onerror = null;
                rec.onend = null;
            }
        };
    }, [isSpeaker, currentLanguage, onTranscriptionResult, onRecognitionError, onRecognitionStatusChange]); // isTranscribing in deps for onend's wasTranscribingBeforeEnd

    const startTranscription = useCallback(() => {
        console.log('USE_SPEECH_RECOGNITION: startTranscription called. isApiSupported:', isApiSupported.current, 'isSpeaker:', isSpeaker, 'isTranscribing:', isTranscribing, 'recognitionRef.current:', !!recognitionRef.current);

        if (!isApiSupported.current) {
            const msg = "Speech Recognition not supported in this browser.";
            setInternalError(msg);
            if (onRecognitionError) onRecognitionError(msg);
            console.error('USE_SPEECH_RECOGNITION: Speech API not supported.');
            return;
        }
        if (!isSpeaker || !recognitionRef.current || isTranscribing) {
            console.warn('USE_SPEECH_RECOGNITION: Start conditions not met -> isSpeaker:', isSpeaker, 'hasRecRef:', !!recognitionRef.current, 'isTranscribing:', isTranscribing);
            return;
        }

        try {
            setInternalError('');
            if (onRecognitionError) onRecognitionError('');
            attemptRestartRef.current = true; // Set intent to run/restart

            if (recognitionRef.current.lang !== currentLanguage) {
                recognitionRef.current.lang = currentLanguage;
            }
            recognitionRef.current.start();
            // onstart handler will set isTranscribing and status
            console.log('USE_SPEECH_RECOGNITION: recognition.start() called.');
        } catch (e) {
            console.error("USE_SPEECH_RECOGNITION: Error starting recognition:", e);
            const msg = `Failed to start voice recognition: ${e.message}. Check mic permissions or try again.`;
            setInternalError(msg);
            if (onRecognitionError) onRecognitionError(msg);
            setIsTranscribing(false); // Ensure it's marked as not transcribing
        }
    }, [isSpeaker, currentLanguage, isTranscribing, onRecognitionError, setInternalError, setIsTranscribing]); // Added setters for stability

    const stopTranscription = useCallback(() => {
        console.log('USE_SPEECH_RECOGNITION: stopTranscription called. isTranscribing:', isTranscribing, 'recognitionRef.current:', !!recognitionRef.current);
        attemptRestartRef.current = false; // Signal that this is an intentional stop, prevent auto-restart by onend

        if (recognitionRef.current && isTranscribing) {
            recognitionRef.current.stop(); // This will trigger the 'onend' event
        } else if (recognitionRef.current && !isTranscribing) {
            // If not currently transcribing but an attempt might be pending or it's in an odd state
            recognitionRef.current.abort(); // More forceful stop
        }
        // isTranscribing and status will be updated by the 'onend' handler.
        // For immediate UI feedback, you could set status here, but onend is more accurate.
        // setInternalStatus(isSpeaker ? 'Mic stopped by user.' : 'Viewing (mic off)');
        // if (onRecognitionStatusChange) onRecognitionStatusChange(isSpeaker ? 'Mic stopped by user.' : 'Viewing (mic off)');
    }, [isTranscribing, isSpeaker /*, onRecognitionStatusChange, setInternalStatus (if setting status here) */]);

    // Effect to clean up the recognition instance itself when the hook unmounts
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                console.log('USE_SPEECH_RECOGNITION: Unmounting, aborting recognition.');
                attemptRestartRef.current = false;
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                     console.warn("Error aborting speech recognition on unmount:", e);
                }
                recognitionRef.current = null;
            }
        };
    }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

    return {
        isTranscribing,
        startTranscription,
        stopTranscription,
        isApiSupported: isApiSupported.current,
        recognitionError: internalError,
        recognitionStatus: internalStatus, // Expose internal status for more granular feedback
    };
};

export default useSpeechRecognition;
// client/src/components/TranscriptDisplay.js
import React, { useEffect, useRef } from 'react';

// Helper to get a display name for a language code
const getLanguageDisplayName = (langCode, availableLangs) => {
    const lang = availableLangs.find(l => l.value.toUpperCase() === langCode.toUpperCase() || l.code?.toUpperCase() === langCode.toUpperCase());
    return lang ? lang.label : langCode;
};

const VIEWER_LANGUAGES_FOR_DISPLAY = [
    { value: '', label: 'Original Language' },
    { value: 'EN-US', label: 'English (US)' },
    { value: 'IT', label: 'Italian' },
    { value: 'CS', label: 'Czech' },
];

const TranscriptDisplay = ({ messages = [], isSpeaker, selectedLanguage, onTranslate, speakerLanguage }) => {
  const endOfMessagesRef = useRef(null);
  const transcriptContainerRef = useRef(null);

  useEffect(() => {
    if (endOfMessagesRef.current && transcriptContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = transcriptContainerRef.current;
        if (scrollHeight - scrollTop - clientHeight < 100) {
            endOfMessagesRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }
  }, [messages]);

  if (!Array.isArray(messages)) {
    console.error('[TranscriptDisplay] messages is not an array. Value:', messages);
    return (
      <div className="transcript-display status-message" ref={transcriptContainerRef}>
        Error: Invalid messages format.
        <div ref={endOfMessagesRef} />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="transcript-display status-message" ref={transcriptContainerRef}>
        {isSpeaker ? "Start recording to see your transcriptions here." : "Waiting for messages..."}
        <div ref={endOfMessagesRef} />
      </div>
    );
  }

  return (
    <div className="transcript-display" ref={transcriptContainerRef}>
      {messages.map((message) => {
        if (!message || !message.id) {
            console.warn('Skipping rendering of invalid message:', message);
            return null;
        }

        // Get the text in the selected language
        const displayText = selectedLanguage && message.translations?.[selectedLanguage]?.text 
          ? message.translations[selectedLanguage].text 
          : message.text;

        return (
          <div
            key={message.id}
            className={`message-bubble ${isSpeaker ? 'speaker' : 'viewer'}`}
          >
            <p className="message-text">{displayText}</p>
          </div>
        );
      })}
      <div ref={endOfMessagesRef} />
    </div>
  );
};

export default TranscriptDisplay;
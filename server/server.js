// server/server.js
require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const deepl = require('deepl-node'); // Import DeepL

// --- DeepL Configuration ---
const DEEPL_AUTH_KEY = process.env.DEEPL_AUTH_KEY;
if (!DEEPL_AUTH_KEY) {
    console.warn("DEEPL_AUTH_KEY environment variable not set. Translation will not work.");
}
const translator = DEEPL_AUTH_KEY ? new deepl.Translator(DEEPL_AUTH_KEY) : null;

// Supported languages for translation (DeepL format)
const SUPPORTED_LANGUAGES = ['EN-US', 'IT', 'CS'];
// --------------------------

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '../client/build');
    app.use(express.static(buildPath));
    
    // Handle all other routes by serving index.html
    app.use((req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'));
    });
}

// Helper function to map language codes to DeepL format
function mapToDeepLLang(lang) {
    // Map Web Speech API language codes to DeepL format
    const langMap = {
        'en-US': 'EN',
        'it-IT': 'IT',
        'cs-CZ': 'CS'
    };
    return langMap[lang] || lang;
}

// Helper function to translate text to all supported languages
async function translateToAllLanguages(text, sourceLang) {
    const translations = {};
    const sourceLangDeepL = mapToDeepLLang(sourceLang);
    
    // Don't translate if source language is already in target languages
    if (SUPPORTED_LANGUAGES.includes(sourceLangDeepL)) {
        translations[sourceLangDeepL] = { text };
    }

    // Translate to all other supported languages
    for (const targetLang of SUPPORTED_LANGUAGES) {
        if (targetLang === sourceLangDeepL) continue; // Skip if source language matches target
        
        try {
            console.log(`Translating from ${sourceLangDeepL} to ${targetLang}`);
            const result = await translator.translateText(text, sourceLangDeepL, targetLang);
            translations[targetLang] = { text: result.text };
        } catch (error) {
            console.error(`Error translating to ${targetLang}:`, error);
            translations[targetLang] = { error: error.message };
        }
    }
    
    return translations;
}

// rooms[roomId] = { speakerSocketId: null, viewers: Set(), messages: [] };
const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create_room', (callback) => {
        const roomId = uuidv4();
        rooms[roomId] = {
            speakerSocketId: socket.id,
            viewers: new Set(),
            messages: [] // Initialize messages array for the room
        };
        socket.join(roomId);
        console.log(`Speaker ${socket.id} created and joined room ${roomId}`);
        callback(roomId);
    });

    socket.on('join_room', ({ roomId }, callback) => {
        if (rooms[roomId]) {
            socket.join(roomId);
            if (rooms[roomId].speakerSocketId === socket.id) {
                console.log(`Speaker ${socket.id} re-confirmed in room ${roomId}`);
                callback({ success: true, isSpeaker: true, messages: rooms[roomId].messages });
            } else {
                rooms[roomId].viewers.add(socket.id);
                console.log(`Viewer ${socket.id} joined room ${roomId}`);
                callback({ success: true, isSpeaker: false, messages: rooms[roomId].messages });
            }
        } else {
            console.log(`Room ${roomId} does not exist for join attempt by ${socket.id}`);
            callback({ success: false, message: 'Room not found.' });
        }
    });

    // Speaker sends transcription data
    socket.on('transcribe_data', async ({ roomId, transcript, sourceLang }) => {
        if (rooms[roomId] && rooms[roomId].speakerSocketId === socket.id) {
            try {
                // Get translations for all supported languages
                const translations = await translateToAllLanguages(transcript, sourceLang);
                
                const newMessage = {
                    id: uuidv4(),
                    text: transcript,
                    sender: 'Speaker',
                    sourceLang: sourceLang,
                    translations: translations,
                    timestamp: Date.now()
                };
                
                rooms[roomId].messages.push(newMessage);
                io.to(roomId).emit('new_transcription', newMessage);
            } catch (error) {
                console.error("Error processing transcription:", error);
                socket.emit('transcription_error', { error: "Failed to process transcription" });
            }
        } else {
            console.warn(`Unauthorized transcript from ${socket.id} for room ${roomId}.`);
        }
    });

    // Viewer requests translation for a specific message (now just returns existing translation)
    socket.on('request_translation', ({ roomId, messageId, targetLang }) => {
        if (rooms[roomId] && (rooms[roomId].viewers.has(socket.id) || rooms[roomId].speakerSocketId === socket.id)) {
            const message = rooms[roomId].messages.find(msg => msg.id === messageId);
            
            if (message && message.translations && message.translations[targetLang]) {
                socket.emit('translated_message', {
                    originalMessageId: messageId,
                    translatedText: message.translations[targetLang].text,
                    targetLang: targetLang
                });
            } else {
                socket.emit('translation_error', { 
                    messageId, 
                    error: "Translation not available for this language" 
                });
            }
        } else {
            console.warn(`Unauthorized translation request from ${socket.id} for room ${roomId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const roomId in rooms) {
            if (rooms[roomId].speakerSocketId === socket.id) {
                console.log(`Speaker ${socket.id} left room ${roomId}. Cleaning up.`);
                io.to(roomId).emit('speaker_left', { message: 'The speaker has left. Session closed.' });
                try {
                    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
                    if (socketsInRoom) {
                        socketsInRoom.forEach(socketIdInRoom => {
                            const Ssocket = io.sockets.sockets.get(socketIdInRoom);
                            if (Ssocket) Ssocket.leave(roomId);
                        });
                    }
                } catch (e) { console.error("Error making sockets leave room:", e); }
                delete rooms[roomId];
                console.log(`Room ${roomId} deleted.`);
                break;
            } else if (rooms[roomId].viewers.has(socket.id)) {
                rooms[roomId].viewers.delete(socket.id);
                console.log(`Viewer ${socket.id} left room ${roomId}`);
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`DeepL Translator ${translator ? 'INITIALIZED' : 'NOT INITIALIZED (check DEEPL_AUTH_KEY)'}`);
    console.log(`Server listening on *:${PORT}`);
});

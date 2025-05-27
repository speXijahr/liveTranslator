// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Configurations
const serverConfig = require('./config/serverConfig');
const corsOptions = require('./config/corsConfig');
const socketIoOptions = require('./config/socketIoOptions');
const { isDeeplConfigured } = require('./config/deeplConfig'); // Only need to know if it's set up

// Socket Event Handlers
const roomEventHandlers = require('./socketHandlers/roomEvents');
const { handleTranscribeData } = require('./socketHandlers/transcriptionEvents');
const { handleRequestTranslation } = require('./socketHandlers/translationEvents');
const { handleDisconnect } = require('./socketHandlers/disconnectEvents');

// --- Initialize Express, HTTP Server, Socket.IO ---
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { ...socketIoOptions, cors: corsOptions });

// --- Server Error Handling ---
httpServer.on('error', (error) => console.error('HTTP Server error:', error));
io.engine.on('connection_error', (err) => {
    console.error(`Socket.IO Engine Connection Error: Code ${err.code}, Message: ${err.message}, Context: ${err.context}`);
});

console.log(`SERVER_LOG: Server will be listening on port [${serverConfig.PORT}]`);
console.log(`SERVER_LOG: Running in ${serverConfig.NODE_ENV} mode`);

// --- Static File Serving for Production ---
if (serverConfig.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '../client/build');
    console.log(`SERVER_LOG: Serving static files from ${buildPath}`);
    app.use(express.static(buildPath));
    app.use((req, res, next) => {
        if (req.path.startsWith('/static/') || req.path.includes('.') || req.path.startsWith('/api/')) { // Exclude API routes if any
            return next();
        }
        res.sendFile(path.join(buildPath, 'index.html'));
    });
}

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Room events
    // If you keep explicit create_room:
    socket.on('create_room', (data, callback) => roomEventHandlers.handleCreateRoom(socket, io, data, callback));
    socket.on('join_room', (data, callback) => roomEventHandlers.handleJoinRoom(socket, io, data, callback));
    socket.on('get_rooms', (callback) => roomEventHandlers.handleGetRooms(callback));

    // Transcription event
    socket.on('transcribe_data', (data) => handleTranscribeData(socket, io, data));

    // Translation event
    socket.on('request_translation', (data) => handleRequestTranslation(socket, data));

    // Disconnect event
    socket.on('disconnect', () => handleDisconnect(socket, io));

    // Generic error handler for this socket
    socket.on('error', (error) => {
        console.error(`Socket error on ${socket.id}:`, error);
    });
});

// --- Start Server ---
httpServer.listen(serverConfig.PORT, () => {
    console.log(`DeepL Translator ${isDeeplConfigured ? 'INITIALIZED' : 'NOT INITIALIZED (check DEEPL_AUTH_KEY)'}`);
    console.log(`Server listening on *:${serverConfig.PORT}`);
});
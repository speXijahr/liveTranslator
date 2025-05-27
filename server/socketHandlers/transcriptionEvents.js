// server/socketHandlers/transcriptionEvents.js
const roomService = require('../services/roomService');

async function handleTranscribeData(socket, io, data) {
    const { roomId, transcript, sourceLang } = data;
    const result = await roomService.addMessageToRoom(roomId, socket.id, transcript, sourceLang);

    if (result.success) {
        io.to(roomId).emit('new_transcription', result.message);
    } else {
        console.warn(`Transcription attempt failed for room ${roomId} by ${socket.id}: ${result.error}`);
        socket.emit('transcription_error', { error: result.error || "Failed to process transcription" });
    }
}

module.exports = { handleTranscribeData };
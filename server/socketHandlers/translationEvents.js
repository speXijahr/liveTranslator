// server/socketHandlers/translationEvents.js
const roomService = require('../services/roomService');
const { DEEPL_TARGET_LANGUAGES } = require('../config/deeplConfig'); // To validate targetLang

function handleRequestTranslation(socket, data) {
    const { roomId, messageId, targetLang } = data; // targetLang from client is like 'EN-US', 'IT'

    // Basic validation of targetLang (optional, client should send valid ones)
    if (!DEEPL_TARGET_LANGUAGES.includes(targetLang)) {
         return socket.emit('translation_error', { messageId, error: "Unsupported target language."});
    }

    const room = roomService.findRoomById(roomId);
    if (!room || (!room.viewers.has(socket.id) && room.speakerSocketId !== socket.id)) {
        console.warn(`Unauthorized translation request from ${socket.id} for room ${roomId}`);
        return socket.emit('translation_error', { messageId, error: "Unauthorized." });
    }

    const result = roomService.getMessageTranslations(roomId, messageId, targetLang);

    if (result.error) {
        socket.emit('translation_error', { messageId, error: result.error, targetLang });
    } else {
        socket.emit('translated_message', {
            originalMessageId: result.originalMessageId,
            translatedText: result.translatedText,
            targetLang: result.targetLang
        });
    }
}

module.exports = { handleRequestTranslation };
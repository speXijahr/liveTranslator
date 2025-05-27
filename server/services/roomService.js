// server/services/roomService.js
const { v4: uuidv4 } = require('uuid');
const { translateTextToAllTargets } = require('./translationService'); // For new messages

const rooms = {}; // In-memory store

function getRoomListSnapshot() {
    return Object.keys(rooms).map(roomId => ({
        id: roomId,
        hasSpeaker: !!rooms[roomId].speakerSocketId,
        viewerCount: rooms[roomId].viewers.size,
        // passwordProtected: !!rooms[roomId].password // If you want to expose this
    }));
}

function findRoomById(roomId) {
    return rooms[roomId] || null;
}

// Was previously the 'create_room' logic, now more of an internal setup
function initializeNewRoom(roomId, password, speakerSocketId) {
    if (rooms[roomId]) {
        return { success: false, message: 'Room ID already exists' };
    }
    rooms[roomId] = {
        id: roomId,
        speakerSocketId: speakerSocketId || null,
        password: password,
        viewers: new Set(),
        messages: [],
    };
    console.log(`RoomService: Room ${roomId} initialized. Speaker: ${speakerSocketId || 'None'}. Password set.`);
    return { success: true, room: rooms[roomId] };
}


function attemptSpeakerJoin(roomId, roomPassword, socketId, clientAdminSecret, SERVER_ADMIN_SECRET) {
    let room = findRoomById(roomId);
    let justCreated = false;

    if (!room) { // Room does not exist, this is an attempt to create a new one
        // Check for the SERVER_ADMIN_SECRET. If it's not configured on the server, no new rooms can be created.
        if (!SERVER_ADMIN_SECRET) {
            console.warn("ROOM_SERVICE: Attempt to create room, but ROOM_CREATION_ADMIN_SECRET is not set on the server. Denying.");
            return { success: false, message: 'New room creation is currently disabled by server configuration.' };
        }
        // Now check if the client provided the correct admin secret
        if (clientAdminSecret !== SERVER_ADMIN_SECRET) {
            console.warn(`ROOM_SERVICE: Failed attempt to create room "${roomId}". Invalid or missing admin secret.`);
            return { success: false, message: 'Valid admin secret required to create a new room.' };
        }

        // Admin secret is valid, proceed to create the room
        console.log(`RoomService: Room "${roomId}" not found. Admin secret validated. Creating for speaker ${socketId}.`);
        const creationResult = initializeNewRoom(roomId, roomPassword, socketId); // Uses roomPassword for the room
        if (!creationResult.success) { // Should not happen if logic is sound
            return creationResult;
        }
        room = creationResult.room;
        justCreated = true;
    } else { // Room exists, check room's own password for speaker access
        if (room.password !== roomPassword) {
            return { success: false, message: 'Invalid room password for speaker access.' };
        }
        if (room.speakerSocketId && room.speakerSocketId !== socketId) {
            // Room has an active speaker who is not the current user.
            // Respond with success:true, isSpeaker:false, so client can decide to join as viewer or show message.
            return { success: true, isSpeaker: false, room, message: 'Another speaker is already active in this room.' };
        }
        // Password matches, and speaker slot is available or it's the same speaker rejoining.
    }

    // Assign/confirm speaker
    room.speakerSocketId = socketId;
    room.viewers.delete(socketId); // Ensure not listed as viewer if becoming speaker
    console.log(`RoomService: Speaker ${socketId} assigned to room ${roomId}.`);
    return { success: true, isSpeaker: true, room, justCreated };
}

function addViewer(roomId, socketId) {
    const room = findRoomById(roomId);
    if (!room) {
        return { success: false, message: 'Room not found.' };
    }
    // Prevent speaker from being added as a viewer in their own room through this path
    if (room.speakerSocketId === socketId) {
         return { success: true, isSpeaker: true, room, message: 'Already speaker in this room.' };
    }
    room.viewers.add(socketId);
    console.log(`RoomService: Viewer ${socketId} added to room ${roomId}. Count: ${room.viewers.size}`);
    return { success: true, isSpeaker: false, room };
}

async function addMessageToRoom(roomId, speakerSocketId, transcript, sourceLang) {
    const room = findRoomById(roomId);
    if (!room) return { success: false, error: "Room not found" };
    if (room.speakerSocketId !== speakerSocketId) return { success: false, error: "Unauthorized: Not the speaker" };

    try {
        const translations = await translateTextToAllTargets(transcript, sourceLang);
        const newMessage = {
            id: uuidv4(),
            text: transcript,
            sourceLang: sourceLang, // Client-side language code, e.g., 'en-US'
            translations: translations, // Keys are DeepL target codes e.g. 'EN-US', 'IT'
            timestamp: Date.now(),
            // senderType: 'speaker' // Can be added if client needs it explicitly
        };
        room.messages.push(newMessage);
        return { success: true, message: newMessage };
    } catch (error) {
        console.error("RoomService: Error processing transcription for translation:", error);
        return { success: false, error: "Failed to process or translate transcription" };
    }
}

function getMessageTranslations(roomId, messageId, targetDeepLLang) {
    const room = findRoomById(roomId);
    if (!room) return { error: "Room not found" };

    const message = room.messages.find(msg => msg.id === messageId);
    if (!message) return { error: "Message not found" };

    if (message.translations && message.translations[targetDeepLLang] && !message.translations[targetDeepLLang].error) {
        return {
            originalMessageId: messageId,
            translatedText: message.translations[targetDeepLLang].text,
            targetLang: targetDeepLLang // This is DeepL target lang
        };
    } else if (message.translations && message.translations[targetDeepLLang] && message.translations[targetDeepLLang].error) {
         return { error: `Translation to ${targetDeepLLang} previously failed: ${message.translations[targetDeepLLang].error}` };
    }
    return { error: `Translation not available or not found for ${targetDeepLLang}` };
}

function handleUserDisconnect(socketId) {
    let changedRoomId = null;
    let wasSpeaker = false;
    let roomDeleted = false;

    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.speakerSocketId === socketId) {
            console.log(`RoomService: Speaker ${socketId} left room ${roomId}.`);
            // Option 1: Room becomes available (speaker slot opens)
            room.speakerSocketId = null;
            // Option 2: Delete the room
            // delete rooms[roomId];
            // roomDeleted = true;
            // console.log(`RoomService: Room ${roomId} deleted.`);
            changedRoomId = roomId;
            wasSpeaker = true;
            break;
        } else if (room.viewers.has(socketId)) {
            room.viewers.delete(socketId);
            console.log(`RoomService: Viewer ${socketId} left room ${roomId}. Count: ${room.viewers.size}`);
            changedRoomId = roomId;
            break;
        }
    }
    return { changedRoomId, wasSpeaker, roomDeleted, updatedViewerCount: changedRoomId && !roomDeleted ? rooms[changedRoomId]?.viewers.size : undefined };
}


module.exports = {
    // initializeNewRoom, // Expose if explicit creation is still desired
    attemptSpeakerJoin,
    addViewer,
    addMessageToRoom,
    getMessageTranslations,
    handleUserDisconnect,
    getRoomListSnapshot,
    findRoomById, // For direct checks if needed
};
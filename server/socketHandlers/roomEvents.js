// server/socketHandlers/roomEvents.js
const roomService = require('../services/roomService');
const serverConfig = require('../config/serverConfig'); // To get ROOM_CREATION_ADMIN_SECRET


function handleJoinRoom(socket, io, data, callback) {
    const { roomId, password, isSpeaker, adminSecret: clientAdminSecret } = data; // Expect clientAdminSecret
    let result;

    if (isSpeaker) {
        console.log(`SERVER: handleJoinRoom - Speaker attempt. Room: ${roomId}, HasAdminSecret: ${!!clientAdminSecret}`);
        result = roomService.attemptSpeakerJoin(
            roomId,
            password, // This is the room's password (to be set or checked)
            socket.id,
            clientAdminSecret, // Secret provided by client
            serverConfig.ROOM_CREATION_ADMIN_SECRET // Actual secret from server config
        );
    } else {
        result = roomService.addViewer(roomId, socket.id);
    }

    if (result && result.success) {
        socket.join(result.room.id);
        callback({
            success: true,
            roomId: result.room.id,
            isSpeaker: result.isSpeaker,
            messages: result.room.messages || [], // Ensure messages is always an array
            message: result.message
        });
        if (result.justCreated || typeof result.isSpeaker === 'boolean') { // If room created or speaker status potentially changed
            io.emit('rooms_updated', roomService.getRoomListSnapshot());
        }
    } else {
        callback({ success: false, message: result ? result.message : 'Unknown error processing join request' });
    }
}


// If you still want an explicit create_room endpoint separate from join_room for speakers
function handleCreateRoom(socket, io, data, callback) {
    const { roomId, password } = data;
    // This would just pre-initialize a room's metadata, without assigning a speaker yet
    const roomExists = roomService.findRoomById(roomId);
    if (roomExists) {
        return callback({ success: false, message: 'Room ID already exists. Try joining as speaker.' });
    }
    // For this simple "create" to only set password, not speaker
    const result = roomService.initializeNewRoom(roomId, password, null);

    if (result.success) {
        callback({ success: true, roomId: result.room.id });
        io.emit('rooms_updated', roomService.getRoomListSnapshot());
    } else {
        callback({ success: false, message: result.message });
    }
}


function handleGetRooms(callback) { // socket not strictly needed if just getting list
    const roomList = roomService.getRoomListSnapshot();
    callback(roomList);
}

module.exports = {
    handleJoinRoom,
    handleCreateRoom, // Export if you keep the explicit create_room event
    handleGetRooms,
};
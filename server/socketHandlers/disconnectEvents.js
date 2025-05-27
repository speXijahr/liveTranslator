// server/socketHandlers/disconnectEvents.js
const roomService = require('../services/roomService');

function handleDisconnect(socket, io) {
    console.log('User disconnected:', socket.id);
    const { changedRoomId, wasSpeaker, roomDeleted, updatedViewerCount } = roomService.handleUserDisconnect(socket.id);

    if (changedRoomId) {
        if (wasSpeaker) {
            // If room was deleted, it's gone. If not, it means speaker slot is open.
            const message = roomDeleted ? 'The speaker has left and the room has been closed.' : 'The speaker has left. The room is awaiting a new speaker.';
            io.to(changedRoomId).emit('speaker_left', { message });
            if (roomDeleted) {
                 // Make everyone leave the Socket.IO room if server deleted the room data
                 try {
                     const socketsInRoom = io.sockets.adapter.rooms.get(changedRoomId);
                     if (socketsInRoom) {
                         socketsInRoom.forEach(socketIdInRoom => {
                             io.sockets.sockets.get(socketIdInRoom)?.leave(changedRoomId);
                         });
                     }
                 } catch (e) { console.error("Error making sockets leave deleted room:", e); }
            }
        }
        // Always emit rooms_updated if any change (speaker left, viewer left, room deleted)
        io.emit('rooms_updated', roomService.getRoomListSnapshot());
    }
}

module.exports = { handleDisconnect };
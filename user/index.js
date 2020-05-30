var Room = require('../room'),
  Conversation = require('../conversation'),
  error = require('../utils/error');

exports.onConnect = (socket) => {
  console.log(socket.id, 'a user connected');
};

exports.onDisconnect = (socket) => {
  if (socket.roomName) {
    console.log(socket.id, 'user disconnected', socket.roomName);
    Room.getRoom(socket.roomName, (room) => {
      if (room) {
        let participant = room.participants.find(p => p.id === socket.id);
        if (participant) {
          Room.removeParticipantFromRoom(room, participant);
          Conversation.removeEmptyConvos(room);
          if (room.conversations && room.conversations.length === 1) {
            if (room.participants.some(p => p.primaryConvoNumber === room.conversations[0].convoNumber)) {
              Room.emitRoom(room);
            } else {
              Room.deleteRoom(room);
            }
          } else {
            Room.deleteRoom(room);
          }
        } else {
          error.log('user disconnected but couldn\'t find participant');
        }
      }
    });
  } else {
    console.log(socket.id, 'user disconnected no roomname');
  }
};

exports.onError = (error, socket) => {
  error.log(`${socket.id} socket error`, error);
};
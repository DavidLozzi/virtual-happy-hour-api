var
  Room = require('../room'),
  uuidv4 = require('uuid').v4,
  error = require('../utils/error');

exports.onSendMessage = (roomName, to, message, action, socket) => {
  console.log(socket.id, 'SendMessage', to, message, action);
  if (to && message) {
    Room.getRoom(roomName, (room) => {
      if (room) {
        const messages = room.messages || [];
        messages.push({
          messageId: uuidv4(),
          to,
          message,
          action,
          date: new Date()
        });
        room.messages = messages.sort((a, b) => new Date(b.date) - new Date(a.date));
        Room.emitRoom(room);
      }
    });
  } else {
    error.log('onSendMessage, message sent with invalid to or message');
  }
};

exports.onSendMessageToAll = (roomName, toAll, message, action, socket) => {
  console.log(socket.id, 'SendMessageToAll', roomName, toAll, message, action);
  if (toAll && message) {
    Room.getRoom(roomName, (room) => {
      if (room) {
        toAll.forEach(to => {
          const messages = room.messages || [];
          messages.push({
            messageId: uuidv4(),
            to,
            message,
            action,
            date: new Date()
          });
          room.messages = messages.sort((a, b) => new Date(b.date) - new Date(a.date));
        });
        Room.emitRoom(room);
      }
    });
  } else {
    error.log('onSendMessageToAll, message sent with invalid toall or message');
  }
};

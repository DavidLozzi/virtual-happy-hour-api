var
  Room = require('../room'),
  Participant = require('../participant'),
  error = require('../utils/error');

exports.onNewConvo = (convo, participant, callback, socket) => {
  try {
    console.log(socket.id, 'newconvo', convo.convoNumber, convo.roomTitle);
    Room.getRoom(convo.roomName, (room) => {
      if (room) {
        if (!room.conversations.some(c => c.convoNumber === convo.convoNumber)) {
          room.conversations.push(convo);
        }
        room.participants = Participant.updatePrimaryConvoAndConfirm(room.participants, participant, convo.convoNumber);

        Room.emitRoom(room);
        if (callback) callback();
      }
    });
  } catch (e) {
    error.log(`${socket.id} onNewConvo`, e);
  }
};

exports.onNewMultiConvo = (roomName, conversations, assigned, socket) => {
  console.log(socket.id, 'newmulticonvo', roomName);
  Room.getRoom(roomName, (room) => {
    if (room && conversations && conversations.length > 0 && assigned && assigned.length > 0) {
      console.log(socket.id, 'adding convos', conversations.length);
      if(room.conversations.some(c => c.convoNumber === conversations[0].convoNumber)) {
        conversations.forEach(c => c.convoNumber = c.convoNumber + 50);
      }
      room.conversations = room.conversations.concat(conversations);

      assigned.forEach(p => {
        room.participants = Participant.updatePrimaryConvo(room.participants,p, p.primaryConvoNumber);
      });

      Room.emitRoom(room);
    }
  });
};

exports.removeEmptyConvos = (room) => {
  console.log('remove empty convos');
  try {
    if (room) {
      room.conversations = room.conversations.filter(c => {
        if (c.convoNumber === Room.lobbyNumber) return c;
        if (room.participants.some(p => p.primaryConvoNumber === c.convoNumber)) return c;
      });
    } else {
      error.log('removeEmptyConvos received an empty room');
    }
  } catch (e) {
    error.log('removeEmptyConvos', e);
  }
  return room;
};
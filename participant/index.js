var
  Room = require('../room'),
  error = require('../utils/error');

exports.onAddParticipant = (roomName, convoNumber, participant, callback, socket) => {
  console.log(socket.id, 'addparticipant', roomName, convoNumber, participant.name);
  Room.getRoom(roomName, (room) => {
    if (room) {
      if (participant && participant.userId && participant.name) {
        room.participants = this.updatePrimaryConvoAndConfirm(room.participants, participant, convoNumber);
      } else {
        error.log('AddParticipant not a valid participant');
      }
      Room.emitRoom(room);
      if (callback) callback();
    }
  });
};

exports.onAddHost = (roomName, participant, callBack, socket) => {
  console.log(socket.id, 'addhost', roomName, participant.name);
  Room.getRoom(roomName, (room) => {
    if (room) {
      if (participant && participant.userId && participant.name) {
        room.hosts = this.addParticipantToList(room.hosts, participant);
      } else {
        error.log('AddHost: not a valid participant');
      }
      Room.emitRoom(room);
      if (callBack) callBack();
    }
  });
};

exports.onRemoveHost = (roomName, participant, socket) => {
  console.log(socket.id, 'removehost', roomName, participant.name);
  Room.getRoom(roomName, (room) => {
    if (room) {
      if (participant && participant.userId && participant.name) {
        room.hosts = room.hosts.filter(h => h.userId !== participant.userId);
      } else {
        error.log('RemoveHost: not a valid participant');
      }
      Room.emitRoom(room);
    }
  });
};

exports.addParticipantToList = (participants, participant) => {
  let newPartis = participants ? [...participants] : [];
  newPartis = newPartis.filter(p => p.userId !== participant.userId);
  newPartis.push(participant);
  return newPartis;
};

exports.updatePrimaryConvo = (participants, participant, convoNumber) => {
  const newPartis = [...participants];
  if (newPartis.some(p => p.userId === participant.userId)) {
    newPartis.find(p => p.userId === participant.userId).primaryConvoNumber = convoNumber;
  } else {
    error.log('updatePrimaryConvo userId not in list');
  }
  return newPartis;
};

exports.updatePrimaryConvoAndConfirm = (participants, participant, convoNumber) => {
  let newPartis = participants ? [...participants] : [];
  newPartis = this.addParticipantToList(newPartis, participant);
  newPartis = this.updatePrimaryConvo(newPartis, participant, convoNumber);
  return newPartis;
};
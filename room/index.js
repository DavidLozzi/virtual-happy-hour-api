const Cache = require('../cache'),
  Conversation = require('../conversation'),
  error = require('../utils/error'),
  Socket = require('../socket');

exports.lobbyNumber = 0;
exports.defaultRoom = (roomName) => ({
  roomName,
  enableConvo: true,
  conversations: [],
  participants: [],
  hosts: [],
  messages: [],
  created: new Date(),
  updated: new Date()
});
exports.onSetRoom = (roomName, socket) => {
  try {
    if (roomName) {
      console.log(socket.id, 'setroom', roomName);
      socket.roomName = roomName;
      socket.join(roomName);
      this.getRoom(roomName, (room) => {
        if (room) {
          this.emitRoom(room);
        }
      });
    } else {
      console.error('setroom', 'no roomName provided');
    }
  }
  catch (ex) {
    console.error('SetRoom error', ex);
  }
};

exports.onUpdateRoomProperty = (roomName, property, value, socket) => {
  console.log(socket.id, 'UpdateRoomProperty', property, value);
  this.getRoom(roomName, (room) => {
    if (room) {
      if (property) {
        room[property] = value;
      }
      this.emitRoom(room);
    }
  });
};

exports.emitRoom = (room) => {
  const cleanRoom = Conversation.removeEmptyConvos(room);
  Cache.set(room.roomName, JSON.stringify({ ...cleanRoom, updated: new Date() }));
  console.log('emitting room', cleanRoom.roomName);
  console.log('');
  // console.log(room);
  Socket.io().to(room.roomName).emit('RoomDetails', cleanRoom);
  // console.log('sent room', room.roomName, Date.now());
};

exports.getRoom = (roomName, callback) => {
  let room;
  console.log('getRoom', roomName);
  try {
    if (roomName) {
      Cache.get(roomName, (err, result) => {
        if (err) {
          error.log('get Cache error', err);
        } else {
          if (result) {
            room = JSON.parse(result);
          } else {
            console.log(roomName, 'setting new room in redis');
            room = this.defaultRoom(roomName);
            Cache.set(roomName, JSON.stringify(room));
          }
        }
        if (callback) callback(room);
      });
    } else {
      throw new Error('getRoom: no room name provided');
    }
  } catch (e) {
    error.log('getRoom', e);
    return null;
  }
};

exports.removeParticipantFromRoom = (room, participant) => {
  console.log('removing from room', participant.name, room.participants.length, room.hosts.length);
  try {
    if (room.participants.some(p => p.userId === participant.userId)) {
      room.participants = room.participants.filter(p => p.userId !== participant.userId);
    }
    if (room.hosts.some(h => h.userId === participant.userId)) {
      room.hosts= room.hosts.filter(p => p.userId !== participant.userId);
    }
    console.log('removed from room', participant.name, room.participants.length, room.hosts.length);
    room.hosts = this.checkForHost(room);
  } catch (e) {
    error.log('removeParticipantFromRoom', e);
  }
};

exports.checkForHost = (room) => {
  console.log('checking for host', room.roomName);
  const newHosts = room.hosts || [];
  if(!room.hosts || room.hosts.length === 0) {
    if(room.participants.length > 0) {
      console.log('new host added', room.roomName, room.participants[0].name);
      newHosts.push(room.participants[0]);
    }
  }
  return newHosts;
};

exports.deleteRoom = (room) => {
  try {
    console.log('deleting room', room.roomName);
    Cache.del(room.roomName);
  } catch (e) {
    error.log('deleteRoom', e);
  }
};
var
  Room = require('../room'),
  Participant = require('../participant'),
  Conversation = require('../conversation'),
  Message = require('../message'),
  User = require('../user'),
  SocketIo = require('socket.io');

let io;

exports.connect = (server) => {
  io = SocketIo(server);
  io.on('connection', function (socket) {
    User.onConnect(socket);

    socket.on('error', (error) => User.onError(error, socket));

    socket.on('SetRoom', (roomName) => Room.onSetRoom(roomName, socket));
    socket.on('UpdateRoomProperty', ({ roomName, property, value }) => Room.onUpdateRoomProperty(roomName, property, value, socket));

    socket.on('NewConvo', ({ conversation, participant }, callback) => Conversation.onNewConvo(conversation, participant, callback, socket));
    socket.on('NewMultiConvo', ({ roomName, conversations, assigned }) => Conversation.onNewMultiConvo(roomName, conversations, assigned, socket));
    socket.on('UpdateConvoProperty', ({ convo, property, value }) => Conversation.onUpdateConvoProperty(convo, property, value, socket));

    socket.on('AddParticipant', ({ roomName, convoNumber, participant }, callback) => Participant.onAddParticipant(roomName, convoNumber, participant, callback, socket));
    socket.on('AddHost', ({ roomName, participant }, callBack) => Participant.onAddHost(roomName, participant, callBack, socket));
    socket.on('RemoveHost', ({ roomName, participant }) => Participant.onRemoveHost(roomName, participant, socket));
  
    socket.on('SendMessage', ({ roomName, to, message, action }) => Message.onSendMessage(roomName, to, message, action, socket));
    socket.on('SendMessageToAll', ({ roomName, toAll, message, action }) => Message.onSendMessageToAll(roomName, toAll, message, action, socket));

    socket.on('disconnect', () => User.onDisconnect(socket));
  });
};

exports.io = () => io;
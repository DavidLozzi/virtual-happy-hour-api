var app = require('express')(),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  http = require('http').createServer(app),
  io = require('socket.io')(http);

// TODO refactor this mess

// TODO move to use a real cache

app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', function(req, res){
  res.send({ response: "here we go", req }).status(200)
});

var rooms = {};

const removeEmptyConvos = (room) => {
  if(room) room.conversations = room.conversations.filter(c => c.participants && c.participants.length > 0);
}

const getRoom = (roomName) => {
  if(rooms[roomName]) return rooms[roomName];
  console.log('creating room', roomName);
  rooms = {...rooms, [roomName]: { roomName, conversations: [], created: new Date() } }
  return rooms[roomName];
};

let interval;
io.on('connection', function(socket){
  var room = '';
  console.log('a user connected');

  socket.on('SetRoom', (roomName, sendBack) => {
    console.log('setroom', roomName);
    room = getRoom(roomName);
    console.log('room', room);
    if(sendBack) sendBack(room);
  });

  if (interval) {
    clearInterval(interval);
  }

  interval = setInterval(() => {
    // console.log('emitting', room);
    removeEmptyConvos(room);
    socket.emit('RoomDetails', room);
  }, 500);

  socket.on('NewConvo', (data, sendBack) => {
    console.log('newconvo', data);
    room.conversations.push(data);
    if(sendBack) sendBack(room.conversations);
  });

  socket.on('AddParticipant', (data, sendBack) => {
    console.log('addparticipant', data);
    room.conversations
      .filter(c => c.roomName === data.roomName)[0]
      .participants.push(data.participant);
      // .forEach(convo => convo.participants.push(data.participant));

    console.log('addparticipant room', room);
    if(sendBack) sendBack(room.conversations);
  });

  socket.on('RemoveFromOtherConvos', (data, sendBack) => {
    console.log('removefromotherconvos', data);
    console.log('  room', room);
    room.conversations
      .filter(c => c.roomName !== data.roomName && c.convoNumber !== 0 && c.participants.find(p => p === data.participant)) // lobby is 0
      .forEach(convo =>  {
        convo.participants.splice(convo.participants.indexOf(data.participant),1)
      });
    
      if(sendBack) sendBack(room.conversations);
  })

  socket.on('ClearConvos', () => {
    console.log('clearing convos', room);
    room.conversations = [];
  })

  socket.on('ClearRoom', () => {
    console.log('clearing room', room);
    rooms[room.roomName] = null;
    room = null;
  })
  
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

http.listen(3001, function(){
  console.log('listening on *:3001');
});
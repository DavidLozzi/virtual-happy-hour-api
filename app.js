var app = require('express')(),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  protocol = process.env.PROTOCOL || 'https', // https://blog.usejournal.com/securing-node-js-apps-with-ssl-tls-b3570dbf84a5
  http = require('http'),
  // io = require('socket.io')(http),
  fs = require('fs');

// TODO refactor this mess

// TODO move to use a real cache
// app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'DELETE, GET, POST, PUT, OPTIONS');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header('Access-Control-Allow-Credentials', true);
  next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let server;
let port;
if (protocol === 'https') {
  console.log('creating https');
  const { execSync } = require( 'child_process' );
	const execOptions = { encoding: 'utf-8', windowsHide: true };
	let key = './certs/api.virtualhappyhour.app.key';
	let certificate = './certs/api_virtualhappyhour_app.crt';
	
	if ( ! fs.existsSync( key ) || ! fs.existsSync( certificate ) ) {
		try {
			execSync( 'openssl version', execOptions );
			execSync(
				`openssl req -x509 -newkey rsa:2048 -keyout ./certs/key.tmp.pem -out ${ certificate } -days 365 -nodes -subj "/C=US/ST=MA/L=Boston/O=Lozzi/CN=localhost"`,
				execOptions
			);
			execSync( `openssl rsa -in ./certs/key.tmp.pem -out ${ key }`, execOptions );
			execSync( 'rm ./certs/key.tmp.pem', execOptions );
      key = './certs/key.pem';
      certificate = './certs/certificate.pem';
		} catch ( error ) {
			console.error( error );
		}
	}

	const options = {
    key: fs.readFileSync( key ),
    cert: fs.readFileSync( certificate ),
    passphrase : 'password'
  };
    
  server = require('https').createServer( options, app );
  port = 443;
} else {
  console.log('creating http');
  server = http.createServer(app)
  port = 80;
}

app.get('/', function (req, res) {
  console.log('getting /');

  res.send('Head to virtualhappyhour.app').status(200)
});

var rooms = {};

const removeEmptyConvos = (room) => {
  if (room) room.conversations = room.conversations.filter(c => c.participants && c.participants.length > 0);
}

const getRoom = (roomName) => {
  if (rooms[roomName]) return rooms[roomName];
  console.log('creating room', roomName);
  rooms = { ...rooms, [roomName]: { roomName, conversations: [], created: new Date() } }
  return rooms[roomName];
};

const updateRoom = (room) => {
  rooms = {...rooms, [room.roomName]: room};
};

const emitRoom = (room, io) => {
  removeEmptyConvos(room);
  io.to(room.roomName).emit('RoomDetails', room);
  console.log('sent room', room.roomName, Date.now());
}

// should refactor to remove confusion
// room.roomName is the /roomName from URL
// convo.lobbyName is the /roomName from URL
// convo.roomName is the unique room name for jitsi
const io = require('socket.io')(server);
io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('error', (error) => {
    console.log(error);
  });

  socket.on('SetRoom', (roomName) => {
    console.log('setroom', roomName);
    socket.join(roomName);
    const room = getRoom(roomName);
    console.log('room', room.roomName);
    emitRoom(room, io);
  });

  socket.on('NewConvo', (data) => {
    console.log('newconvo', data);
    const room = getRoom(data.lobbyName);
    room.conversations.push(data);
    emitRoom(room, io);
  });

  socket.on('AddParticipant', ({ roomName, convoNumber, participant }) => {
    console.log('addparticipant', roomName, convoNumber, participant);
    const room = getRoom(roomName);
    const convos = room.conversations
      .map(c => {
        if(c.convoNumber === convoNumber) {
          return { ...c, participants: [...c.participants, participant]}
        } else {
          return c;
        }
      });
    room.conversations = convos;
    updateRoom(room);
    console.log('addparticipant room', room.roomName, convoNumber);
    console.log(room);
    emitRoom(room, io);
  });

  socket.on('RemoveFromOtherConvos', (data) => {
    console.log('removefromotherconvos', data);
    console.log('  room', room);
    room.conversations
      .filter(c => c.roomName !== data.roomName && c.convoNumber !== 0 && c.participants.find(p => p === data.participant)) // lobby is 0
      .forEach(convo => {
        convo.participants.splice(convo.participants.indexOf(data.participant), 1)
      });

    emitRoom(room, io);
  })

  socket.on('ClearConvos', () => {
    console.log('clearing convos', room);
    room.conversations = [];
    emitRoom(room, io);
  })

  socket.on('ClearRoom', () => {
    console.log('clearing room', room);
    rooms[room.roomName] = null;
    room = null;
    emitRoom(room, io);
  })

  socket.on('disconnect', function () {
    console.log('user disconnected');
  });
});

server.listen(port);
console.log(`Virtual Happy Hour API has started on ${port} at ${Date()}`);
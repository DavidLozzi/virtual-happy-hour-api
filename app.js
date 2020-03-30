var app = require('express')(),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  protocol = process.env.PROTOCOL || 'https', // https://blog.usejournal.com/securing-node-js-apps-with-ssl-tls-b3570dbf84a5
  http = require('http'),
  // io = require('socket.io')(http),
  fs = require('fs');

// TODO refactor this mess

// TODO move to use a real cache


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

app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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

let interval;

const io = require('socket.io')(server);
io.on('connection', function (socket) {
  var room = '';
  console.log('a user connected');

  socket.on('SetRoom', (roomName, sendBack) => {
    console.log('setroom', roomName);
    socket.join(roomName);
    room = getRoom(roomName);
    console.log('room', room);
    if (sendBack) sendBack(room);
  });

  if (interval) {
    clearInterval(interval);
  }

  interval = setInterval(() => {
    // console.log('emitting', room);
    removeEmptyConvos(room);
    socket.to(room.roomName).emit('RoomDetails', room);
    // console.log('send', Date.now());
  }, 500);

  socket.on('NewConvo', (data, sendBack) => {
    console.log('newconvo', data);
    room.conversations.push(data);
    if (sendBack) sendBack(room.conversations);
  });

  socket.on('AddParticipant', (data, sendBack) => {
    console.log('addparticipant', data);
    room.conversations && room.conversations
      .filter(c => c.roomName === data.roomName)[0]
      .participants.push(data.participant);
    // .forEach(convo => convo.participants.push(data.participant));

    console.log('addparticipant room', room);
    if (sendBack) sendBack(room.conversations);
  });

  socket.on('RemoveFromOtherConvos', (data, sendBack) => {
    console.log('removefromotherconvos', data);
    console.log('  room', room);
    room.conversations
      .filter(c => c.roomName !== data.roomName && c.convoNumber !== 0 && c.participants.find(p => p === data.participant)) // lobby is 0
      .forEach(convo => {
        convo.participants.splice(convo.participants.indexOf(data.participant), 1)
      });

    if (sendBack) sendBack(room.conversations);
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

  socket.on('disconnect', function () {
    console.log('user disconnected');
  });
});

server.listen(port);
console.log(`Virtual Happy Hour API has started on ${port} at ${Date()}`);
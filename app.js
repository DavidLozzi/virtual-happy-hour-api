var app = require('express')(),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  protocol = process.env.PROTOCOL || 'https', // https://blog.usejournal.com/securing-node-js-apps-with-ssl-tls-b3570dbf84a5
  http = require('http'),
  fs = require('fs'),
  Redis = require('ioredis'),
  CONFIG = require('./config');

// TODO refactor this mess

console.log('cache connecting to', CONFIG.CACHE_URL);
var redis = new Redis(CONFIG.CACHE_URL);
console.log('cache connected');

// app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.use(function (req, res, next) {
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
  const { execSync } = require('child_process');
  const execOptions = { encoding: 'utf-8', windowsHide: true };
  let key = './certs/api.virtualhappyhour.app.key'; // these are my cert files for AWS, code should create local temp ones if needed
  let certificate = './certs/api_virtualhappyhour_app.crt';

  if (!fs.existsSync(key) || !fs.existsSync(certificate)) {
    try {
      execSync('openssl version', execOptions);
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout ./certs/key.tmp.pem -out ${certificate} -days 365 -nodes -subj "/C=US/ST=MA/L=Boston/O=Lozzi/CN=localhost"`,
        execOptions
      );
      execSync(`openssl rsa -in ./certs/key.tmp.pem -out ${key}`, execOptions);
      execSync('rm ./certs/key.tmp.pem', execOptions);
    } catch (error) {
      console.error(error);
    }
  }

  const options = {
    key: fs.readFileSync(key),
    cert: fs.readFileSync(certificate),
    passphrase: 'password'
  };

  server = require('https').createServer(options, app);
  port = 443;
} else {
  console.log('creating http');
  server = http.createServer(app)
  port = 80;
}

app.get('/', function (req, res) {
  console.log('getting /', Date.now());

  res.send('Head to virtualhappyhour.app').status(200)
});

const lobbyNumber = 0;
const defaultRoom = (roomName) => ({
  roomName,
  enableConvo: true,
  conversations: [],
  created: new Date(),
  updated: new Date()
});
// TODO can this define the default structure of a convo and send to FE to create? I think SetRoom could call back and send empty objects?

const removeEmptyConvos = (room) => {
  if (room) {
    // const convoCount = room.conversations.length;
    // room.conversations.forEach(c => console.log(c));
    room.conversations = room.conversations.filter(c => c.participants && c.participants.length > 0);
    // console.log('removeEmptyConvos, started at ', convoCount, ' now to ', room.conversations.length);
  }
}

// TODO refactor this to use awaits/asyncs
const getRoom = (roomName, callback) => {
  let room;
  console.log('getRoom', roomName);
  try {
    redis.get(roomName, (err, result) => {
      if (err) {
        console.log('get cache error', err);
      } else {
        if (result) {
          console.log('cache result', result);
          room = JSON.parse(result);
        } else {
          console.log('no cache', roomName);
          room = defaultRoom(roomName);
          redis.set(roomName, JSON.stringify(room));
        }
      }
      if (callback) callback(room);
      console.log('getRoom done');
    });
  } catch (ex) {
    console.log('getRoom error', ex.toString());
  }
};

const emitRoom = (room, io) => { // TODO can we remove io from the params?
  console.log('');
  console.log('emitting room');
  console.log(room);
  removeEmptyConvos(room);
  redis.set(room.roomName, JSON.stringify({ ...room, updated: new Date() }));
  io.to(room.roomName).emit('RoomDetails', room);
  console.log('sent room', room.roomName, Date.now());
};

// TODO add call backs to each .on to help redux handle states
const io = require('socket.io')(server);
io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('error', (error) => {
    console.log(error);
  });

  // roomName = "string"
  socket.on('SetRoom', (roomName) => {
    try {
      if (roomName) {
        console.log('setroom', roomName);
        socket.join(roomName);
        console.log('setroom joined socket', roomName)
        getRoom(roomName, (room) => {
          console.log('room', room.roomName);
          emitRoom(room, io);
        });
      } else {
        console.log('setroom', 'no roomName provided')
      }
    }
    catch (ex) {
      console.log('SetRoom error', ex.toString());
    }
  });

  // data = { ...converstation, participants: [{ name: '', email: '' }], hosts: [{ { name: '', email: '' } }] }
  socket.on('NewConvo', (data) => {
    console.log('newconvo', data);
    getRoom(data.roomName, (room) => {
      if (!room.conversations.some(c => c.convoNumber === data.convoNumber)) {
        room.conversations.push(data);
      }
      emitRoom(room, io);
    });
  });

  socket.on('AddParticipant', ({ roomName, convoNumber, participant }) => {
    console.log('addparticipant', roomName, convoNumber, participant);
    getRoom(roomName, (room) => {
      if (participant && participant.email && participant.name) {
        const convos = room.conversations
          .map(c => {
            if (c.convoNumber === convoNumber) {
              return { ...c, participants: [...c.participants, participant] }
            } else {
              return c;
            }
          });
        room.conversations = convos;
      } else {
        console.log('AddParticipant', 'not a valid participant');
      }
      emitRoom(room, io);
    });
  });

  socket.on('RemoveFromOtherConvos', ({ roomName, convoNumber, participant }) => {
    console.log('removefromotherconvos', roomName, convoNumber, participant);
    getRoom(roomName, (room) => {
      const newConvos = room.conversations
        .map(convo => {
          if (convo.convoNumber !== lobbyNumber && convo.convoNumber !== convoNumber && convo.participants.some(p => p.email === participant.email)) {
            convo.participants.splice(convo.participants.indexOf(participant), 1);
          }
          return convo
        });
      room.conversations = newConvos;
      emitRoom(room, io);
    });
  });

  socket.on('RemoveMeFromThisConvo', ({ roomName, convoNumber, participant }) => {
    console.log('RemoveMeFromThisConvo', convoNumber, participant);
    getRoom(roomName, (room) => {
      const newConvos = room.conversations
        .map(convo => {
          if (convo.convoNumber === convoNumber && convo.participants.some(p => p.email === participant.email)) {
            convo.participants.splice(convo.participants.indexOf(participant), 1);
          }
          return convo
        });

      room.conversations = newConvos;
      emitRoom(room, io);
    });
  });

  socket.on('UpdateRoomProperty', ({ roomName, property, value }) => {
    console.log('UpdateRoomProperty', property, value);
    getRoom(roomName, (room) => {
      if (property) {
        room[property] = value;
      }
      emitRoom(room, io);
    });
  });

  socket.on('disconnect', function () { // TODO remove from the room and convos
    console.log('user disconnected');
  });
});

server.listen(port);
console.log(`Virtual Happy Hour API has started on ${port} at ${Date()}`);
var app = require('express')(),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  protocol = process.env.PROTOCOL || 'https', // https://blog.usejournal.com/securing-node-js-apps-with-ssl-tls-b3570dbf84a5
  http = require('http'),
  fs = require('fs'),
  Redis = require('ioredis'),
  CONFIG = require('./config'),
  uuidv4 = require('uuid').v4;

// TODO refactor this mess

// TODO error handle everything
const logError = (message, error) => {
  console.error(message);
  if (error) console.error(error.toString());
}

try {
  console.log('cache connecting to', CONFIG.CACHE_URL);
  var redis = new Redis(CONFIG.CACHE_URL);
  console.log('cache connected');
} catch (e) {
  logError('can\'t connect to cache', e);
}
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
  console.log('GET /', Date.now());

  res.send('Head to virtualhappyhour.app').status(200)
});

const lobbyNumber = 0;
const defaultRoom = (roomName) => ({
  roomName,
  enableConvo: true,
  conversations: [],
  participants: [],
  hosts: [],
  messages: [],
  created: new Date(),
  updated: new Date()
});
// TODO can this define the default structure of a convo and send to FE to create? I think SetRoom could call back and send empty objects?

const removeEmptyConvos = (room) => {
  console.log('remove empty convos');
  try {
    if (room) {
      room.conversations = room.conversations.filter(c => {
        if (c.convoNumber === lobbyNumber) return c;
        if (c.participants && c.participants.length > 0) return c;
      });
    } else {
      logError('removeEmptyConvos received an empty room');
    }
  } catch (e) {
    logError('removeEmptyConvos', e);
  }
}

const deleteRoom = (room) => {
  try {
    redis.del(room.roomName);
  } catch (e) {
    logError('deleteRoom', e);
  }
}

// TODO refactor this to use awaits/asyncs
const getRoom = (roomName, callback) => {
  let room;
  console.log('getRoom', roomName);
  try {
    if (roomName) {
      redis.get(roomName, (err, result) => {
        if (err) {
          logError('get cache error', err);
        } else {
          if (result) {
            room = JSON.parse(result);
          } else {
            room = defaultRoom(roomName);
            redis.set(roomName, JSON.stringify(room), 'EX', 300);
          }
        }
        if (callback) callback(room);
      });
    } else {
      logError('getRoom: no room name provided');
    }
  } catch (e) {
    logError('getRoom error', e);
  }
};

const addParticipantToList = (participants, participant) => {
  if (!participants.some(p => p.email === participant.email)) {
    participants.push(participant);
  } else if (!participants.some(p => p.id === participant.id)) {
    // email exits but the id doesn't, let's refresh the participant
    const oldParti = participants.find(p => p.email === participant.email);
    participants.splice(participants.indexOf(oldParti), 1);
    participants.push(participant);
  }
};

const addParticipantsToRoom = (room, participants) => {
  participants.forEach(p => addParticipantToList(room.participants, p));
};

const removeParticipantFromRoom = (room, participant) => {
  console.log('removing from room', participant);
  try {
    if (room.participants.some(p => p.email === participant.email)) {
      room.participants.splice(room.participants.indexOf(participant), 1);
    }
    if (room.hosts.some(h => h.email === participant.email)) {
      room.hosts.splice(room.hosts.indexOf(participant), 1);
    }
    const newConvos = room.conversations
      .map(convo => {
        if (convo.participants.some(p => p.email === participant.email)) {
          convo.participants.splice(convo.participants.indexOf(participant), 1);
        }
        return convo
      });
    room.conversations = newConvos;
  } catch (e) {
    logError('removeParticipantFromRoom', e);
  }
}

const emitRoom = (room, io) => { // TODO can we remove io from the params?
  removeEmptyConvos(room);
  redis.set(room.roomName, JSON.stringify({ ...room, updated: new Date() }), 'EX', 300);
  console.log('');
  console.log('emitting room');
  console.log(room);
  io.to(room.roomName).emit('RoomDetails', room);
  // console.log('sent room', room.roomName, Date.now());
};

// TODO add call backs to each .on to help redux handle states
const io = require('socket.io')(server);
io.on('connection', function (socket) {
  console.log('a user connected', socket.id);
  socket.on('error', (error) => {
    console.log(error);
  });

  // roomName = "string"
  socket.on('SetRoom', (roomName) => {
    try {
      if (roomName) {
        console.log('setroom', roomName);
        socket.roomName = roomName;
        socket.join(roomName);
        getRoom(roomName, (room) => {
          emitRoom(room, io);
        });
      } else {
        console.error('setroom', 'no roomName provided')
      }
    }
    catch (ex) {
      console.error('SetRoom error', ex);
    }
  });

  // data = converstation
  socket.on('NewConvo', (data, callback) => {
    console.log('newconvo', data);
    getRoom(data.roomName, (room) => {
      if (!room.conversations.some(c => c.convoNumber === data.convoNumber)) {
        room.conversations.push(data);
      }
      addParticipantsToRoom(room, data.participants);
      emitRoom(room, io);
      if (callback) callback();
    });
  });

  socket.on('AddParticipant', ({ roomName, convoNumber, participant }, callback) => {
    console.log('addparticipant', roomName, convoNumber, participant);
    getRoom(roomName, (room) => {
      if (participant && participant.email && participant.name) {
        const convos = room.conversations
          .map(c => {
            if (c.convoNumber === convoNumber) {
              addParticipantToList(c.participants, participant)
            }
            return c;
          });
        room.conversations = convos;
        addParticipantToList(room.participants, participant);
      } else {
        console.error('AddParticipant', 'not a valid participant');
      }
      emitRoom(room, io);
      if (callback) callback();
    });
  });

  socket.on('AddHost', ({ roomName, participant }) => {
    console.log('addhost', roomName, participant);
    getRoom(roomName, (room) => {
      if (participant && participant.email && participant.name) {
        if (!room.hosts.some(h => h.email === participant.email)) {
          room.hosts.push(participant);
        }
      } else {
        logError('AddHost: not a valid participant');
      }
      emitRoom(room, io);
    });
  });

  socket.on('RemoveHost', ({ roomName, participant }) => {
    console.log('removehost', roomName, participant);
    getRoom(roomName, (room) => {
      if (participant && participant.email && participant.name) {
        const host = room.hosts.find(h => h.email === participant.email);
        room.hosts.splice(room.hosts.indexOf(host), 1);
      } else {
        logError('RemoveHost: not a valid participant');
      }
      emitRoom(room, io);
    });
  });

  socket.on('RemoveFromOtherConvos', ({ roomName, convoNumber, participant }) => {
    console.log('removefromotherconvos', roomName, convoNumber, participant);
    getRoom(roomName, (room) => {
      const newConvos = room.conversations
        .map(convo => {
          if (convo.convoNumber !== convoNumber && convo.participants.some(p => p.email === participant.email)) {
            convo.participants = convo.participants.filter(p => p.email !== participant.email);
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

  // TODO should we move this into a separate data object per person?
  socket.on('SendMessage', ({ roomName, to, message, action }) => {
    console.log('SendMessage', to, message, action);
    if (to && message) {
      getRoom(roomName, (room) => {
        const messages = room.messages || [];
        messages.push({
          messageId: uuidv4(),
          to,
          message,
          action,
          date: new Date()
        });
        room.messages = messages.sort((a, b) => new Date(b.date) - new Date(a.date));
        emitRoom(room, io);
      })
    }
  });

  socket.on('SendMessageToAll', ({ roomName, toAll, message, action }) => {
    console.log('SendMessageToAll', roomName, toAll, message, action);
    if (toAll && message) {
      getRoom(roomName, (room) => {
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
        })
        emitRoom(room, io);
      })
    }
  });

  socket.on('disconnect', function () { // TODO remove from the room and convos
    console.log('user disconnected', socket.id);
    getRoom(socket.roomName, (room) => {
      let participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        removeParticipantFromRoom(room, participant);
        removeEmptyConvos(room);
        if (room.conversations && room.conversations.length === 1) {
          if (room.conversations[0].participants.length > 0) {
            // TODO if no host is in convo 0 pick one
            emitRoom(room, io);
          } else {
            deleteRoom(room);
          }
        } else {
          // assumption is no one is left in this room, let's remove it permanently
          deleteRoom(room);
        }
      } else {
        logError('user disconnected but couldn\'t find participant');
      }
    });
  });
});

server.listen(port);
console.log(`Virtual Happy Hour API has started on ${port} at ${Date()}`);
var app = require('express')(),
  Cache = require('./cache'),
  Socket = require('./socket'),
  createServer = require('./utils/server');

Cache.connect();

var [server, port] = createServer(app);

Socket.connect(server);

app.get('/', function (req, res) {
  // console.log('GET /', Date.now());
  res.send('Oops, how did you get here? Go to <a href="https://remoteparty.social">remoteparty.social</a> to use it.').status(200);
});

server.listen(port);
console.log(`Virtual Happy Hour API has started on ${port} at ${Date()}`);

var
  http = require('http'),
  fs = require('fs'),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  CONFIG = require('../config'),
  error = require('../utils/error').default,
  protocol = process.env.PROTOCOL || 'https'; // https://blog.usejournal.com/securing-node-js-apps-with-ssl-tls-b3570dbf84a5


const createServer = (app) => {
  app.use(cors({ origin: CONFIG.CORS, optionsSuccessStatus: 200 }));
  // app.use(function (req, res, next) {
  //   res.header("Access-Control-Allow-Origin", CONFIG.CORS);
  //   res.header('Access-Control-Allow-Methods', 'DELETE, GET, POST, PUT, OPTIONS');
  //   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  //   res.header('Access-Control-Allow-Credentials', true);
  //   next();
  // });
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  let server, port;
  try {
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

    return [server, port];
  } catch (e) {
    error.log('cant make server', e);
  }
}

module.exports = createServer;
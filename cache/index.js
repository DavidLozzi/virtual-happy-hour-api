var Redis = require('ioredis'),
  CONFIG = require('../config'),
  error = require('../utils/error');

let connection;

const Cache = {
  connect: () => {
    try {
      console.log('cache connecting to', CONFIG.CACHE_URL);
      connection = new Redis(CONFIG.CACHE_URL);
      console.log('cache connected');
    } catch (e) {
      error.log('can\'t connect to cache', e);
    }
  },
  get: (key, callback) => {
    connection.get(key, callback);
  },
  set: (key, value) => {
    connection.set(key, value, 'EX', 3600);
  },
  del: (key) => {
    connection.del(key);
  }
};

module.exports = Cache;
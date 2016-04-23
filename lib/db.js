const HOST = process.env.RETHINK_HOST;
const PORT = process.env.RETHINK_PORT;
const DB_NAME = process.env.RETHINK_NAME;
const SSL_KEY = process.env.SSL_KEY;
const AUTH_KEY = process.env.AUTH_KEY;

// var r = require('rethinkdbdash')({db: DB_NAME, servers: [{host: HOST, port: PORT}]});

var r = require('rethinkdbdash')({
  host: HOST,
  port: PORT,
  ssl:
  {
    ca: [ SSL_KEY ]
  },
  authKey: AUTH_KEY,
  db: DB_NAME,
  timeoutError: 60000,
  buffer: 5,
  max: 1000,
  timeoutGb: 60 * 60 * 1000
});

module.exports = r;

const _ = require('lodash');
const event = require('../controllers/event.js');

const errHandlerFactory = res => {
  return err => {
    console.error('route error', err.message);
    res.status(500);
    res.json(err);
  }
};

const respond = res => body => {
  if (!body.result && !body.found) {
    res.status(404);
    return Promise.resolve(res.json({err: 'Not found'}));
  }
  return Promise.resolve(res.json(body));
};

module.exports = {
  http: app => {
    app.get('/events', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      event.get(req.query)
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });

    app.get('/events/:id', (req, res) => {
      event.get(_.assign({id: req.params.id}, req.query))
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });

    app.post('/events', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      console.log('reqbody', req.body);
      if (_.isObject(req.body)) {
        var hotBod = true;
        event.create(req.body, hotBod)
        .then(respond(res))
        .catch( errHandlerFactory(res) );
      } else if (req.body.match(/rating/)) {
        console.log('found a rating');
        event.create(req.body)
        .then(respond(res))
        .catch( errHandlerFactory(res) );
      } else {
        var ret = {};
        req.body.split('&').forEach(function(line) {
          var l = line.split('=');
          if (l[0] === "event") {
            ret[l[0]] = l[1];
          } else {
            ret[l[0]] = Number.parseFloat(l[1]);
          }
        });
        ret.timeStamp = Date.now();
        var day = 1000 * 60 * 60 * 24;
        console.log('res.long', ret.longitude, 'ret.lat', ret.latitude, 'tstamp', ret.timeStamp);
        var query = {and: [
          {longitude: {ge: ret.longitude - 0.5}},
          {longitude: {le: ret.longitude - 0.5}},
          {latitude: {ge: ret.latitude - 0.5}},
          {latitude: {le: ret.latitude - 0.5}},
          {timeStamp: {ge: ret.timeStamp - day}}
        ]};
        var preFilter = true;
        event.get(query, preFilter)
        .then(respond(res))
        .catch( errHandlerFactory(res) )
      }
    });

    app.put('/events/:id', (req, res) => {
      event.update(req.body)
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });

    app.del('/events/:id', (req, res) => {
      event.delete(req.params.id)
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });
  },
  ws: io => {
    const nsp = io.of('/events');
    nsp.on('connection', socket => {
      event.watch(socket.handshake.query)
      .then(cursor => {
        cursor.each((err, data) => {
          if (!data) return;
          if (data.state) return socket.emit('state', data);
          socket.emit('record', data);
        });
      });
    });
  }
};

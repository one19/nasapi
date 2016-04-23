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
      console.log('reqbody', req.body);
      console.log('resheaders', res.headers());
      if (req.body.match(/rating/)) {
        console.log('found a rating');
        res.setHeader('Access-Control-Allow-Origin', '*');
        event.create(req.body)
        .then(respond(res))
        .catch( errHandlerFactory(res) );
      } else {
        console.log('req query', req.query);
        event.get(req.query)
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

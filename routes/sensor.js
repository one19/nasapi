const _ = require('lodash');
const sensor = require('../controllers/sensor.js');

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
    app.get('/sensors', (req, res) => {
      sensor.get(req.query)
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });

    app.get('/sensors/:id', (req, res) => {
      sensor.get(_.assign({id: req.params.id}, req.query))
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });

    app.post('/sensors', (req, res) => {
      sensor.create(req.body)
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });

    app.put('/sensors/:id', (req, res) => {
      sensor.update(req.body)
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });

    app.del('/sensors/:id', (req, res) => {
      sensor.delete(req.params.id)
      .then(respond(res))
      .catch( errHandlerFactory(res) )
    });
  },
  ws: io => {
    const nsp = io.of('/sensors');
    nsp.on('connection', socket => {
      sensor.watch(socket.handshake.query)
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

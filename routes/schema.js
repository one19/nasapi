const schema = require('root/schema');

module.exports = {
  http: app => {
    app.set('views', __dirname + '/views');
    app.get('/schema', (req, res) => {
      res.json(schema);
    });
    app.get('/', (req, res) => {
      res.render('index');
    })
  },
  ws: () => {}
};

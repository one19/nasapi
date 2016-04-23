const schema = require('root/schema');

module.exports = {
  http: app => {
    app.get('/schema', (req, res) => {
      res.json(schema);
    });
    app.get('/', (req, res) => {
      res.render('views/index.html');
    })
  },
  ws: () => {}
};

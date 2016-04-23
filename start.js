const setup = require('./setup');
const app = require('./index');

setup()
.then(() => {
  const server = app.listen(process.env.PORT, () => {
    const host = server.address().address;
    const port = server.address().port;

    console.log('nsapi API listening at http://%s:%s', host, port);
  });
});

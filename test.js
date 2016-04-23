const walkdir = require('walkdir');
const path = require('path');
const test = require('blue-tape');

const setup = require('root/setup');
const app = require('root/index');
const r = require('root/lib/db');

const server = app.listen(process.env.PORT, () => {
  setup()
  .then(() => {
    walkdir.sync('./tests').filter(function(file) {
      if (file.indexOf('swp') > -1) return false;
      return file.indexOf('.js') > -1;
    }).forEach(function(file) {
      require(file);
    });
  })
  .then(() => {
    test('teardown', () => r.dbDrop('nsapi'));
    test('teardown', () => r.getPoolMaster().drain());
    test('teardown', () => {
      return Promise.resolve(app.close())
    });
  });
});

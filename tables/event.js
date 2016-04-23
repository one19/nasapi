const r = require('../lib/db.js');

module.exports = () => {
  return r.tableCreate('events').run()
  .catch((err) => {
    if (err.message.split('\n')[0] === 'Table `'+process.env.RETHINK_NAME+'.events` already exists in:') return;
    throw err;
  })
  .then(() => {
    r.table('events').wait().run()
  })
  //.then(() => r.table('events').indexCreate('name').run())
  //.catch(err => {
  //  if (err.message.indexOf('Index `name` already exists') > -1 )return;
  //  throw err;
  //})
}

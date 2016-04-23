const r = require('../lib/db.js');

module.exports = () => {
  return r.tableCreate('sensors').run()
  .catch((err) => {
    if (err.message.split('\n')[0] === 'Table `'+process.env.RETHINK_NAME+'.sensors` already exists in:') return;
    throw err;
  })
  .then(() => {
    r.table('sensors').wait().run()
  })
  //.then(() => r.table('sensors').indexCreate('name').run())
  //.catch(err => {
  //  if (err.message.indexOf('Index `name` already exists') > -1 )return;
  //  throw err;
  //})
}

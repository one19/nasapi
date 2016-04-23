const r = require('../lib/db.js');

module.exports = () => {
  return r.tableCreate('symptoms').run()
  .catch((err) => {
    if (err.message.split('\n')[0] === 'Table `'+process.env.RETHINK_NAME+'.symptoms` already exists in:') return;
    throw err;
  })
  .then(() => {
    r.table('symptoms').wait().run()
  })
  //.then(() => r.table('symptoms').indexCreate('name').run())
  //.catch(err => {
  //  if (err.message.indexOf('Index `name` already exists') > -1 )return;
  //  throw err;
  //})
}

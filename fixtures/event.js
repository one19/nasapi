const bandname = require('bandname');
const generate = require('json-schema-faker');
const schema = require('../schema.js').event;

module.exports = {
  valid: () => {
    return generate(schema);
  }
};

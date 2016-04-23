const bandname = require('bandname');
const generate = require('json-schema-faker');
const schema = require('../schema.js').sensor;

module.exports = {
  valid: () => {
    return generate(schema);
  }
};

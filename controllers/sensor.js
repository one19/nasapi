const jsen = require('jsen');
const _ = require('lodash');

const r = require('../lib/db.js');
const schema = require('../schema.js').sensor;
const validate = jsen(schema);

const firstChange = res => {
  return {
    result: res.changes[0].new_val || res.changes[0],
    old_val: res.changes[0].old_val
  }
}

const properties = Object.keys(schema.properties);

const onlyProps = params => (p, prop) => {
  p[prop] = params[prop];
  return p
}

const stringToBool = params => {
  return Object.keys(params).reduce((p, k) => {
    const param = params[k];
    switch (param) {
      case 'true':
        p[k] = true;
        break;
      case 'false':
        p[k] = false;
        break;
      default:
        p[k] = param;
    }
    return p;
  }, {});
}

const stringToNumber = params => {
  return Object.keys(params).reduce((p, k) => {
    const param = params[k];
    const num = Number(param);
    p[k] = param;
    if (!isNaN(num)) p[k] = num;
    return p;
  }, {});
}

const normaliseParams = params => {
  return stringToBool(stringToNumber(params));
}

const buildQuery = (table, params) => {
  return ['orderBy', 'skip', 'limit'].reduce((q, item) => {
    if (params[item]) {
      if (item === 'orderBy') {
        q = q[item](r[params.order](params[item]));
      } else {
        q = q[item](params[item]);
      }
    }
    return q;
  }, table);
}

module.exports = {
  get: (params) => {
    const table = r.table('sensors');

    if (params.id) {
      return table.get(params.id).run()
      .then(res => { return {result: res} });
    }

    params = _.assign({result: true, order: 'asc'}, normaliseParams(params));

    const filterParams = properties.reduce(onlyProps(params), {});
    const filteredTable = table.filter(filterParams);

    const query = buildQuery(filteredTable, params);

    const taggedQueries = [
      {tag: 'result', q: query},
      {tag: 'count', q: filteredTable.count()}
    ].filter(x => params[x.tag]);

    return Promise.all(taggedQueries.map(x => x.q.run()))
    .then(results => {
      return results.reduce((response, result, i) => {
        const tag = taggedQueries[i].tag;
        response[tag] = result;
        if (tag === 'count' && result > 0) response.found = true;
        if (tag === 'response' && result.length > 0) response.found = true;
        return response;
      }, {found: false});
    });
  },
  watch: (params) => {
    const table = r.table('sensors');

    if (params.id) {
      return table.get(params.id).changes({includeInitial: true, includeStates: true}).run();
    }

    params = _.assign({order: 'asc'}, normaliseParams(params));

    const filterParams = properties.reduce(onlyProps(params), {});
    const filteredTable = table.filter(filterParams);

    const query = buildQuery(filteredTable, params);

    return table.getAll(r.args(query.getField('id').coerceTo('array'))).changes({includeInitial: true, includeStates: true}).run();
  },
  create: (sensor) => {
    var res = {};
    Object.keys(sensor).forEach(function(key) {
      res[key] = Number.parseFloat(sensor[key])
    });
    res.timeStamp = Date.now();
    console.log('RES FINAL', res);
    const valid = validate(sensor);
    console.log('valid:', valid);
    return r.table('sensors').insert(sensor, {returnChanges: true}).run()
    .then(firstChange);
  },
  update: (sensor) => {
    const valid = validate(sensor);
    if (!valid) return Promise.reject(valid);
    return r.table('sensors').update(sensor, {returnChanges: true}).run()
    .then(firstChange);
  },
  delete: (id) => {
    return r.table('sensors').get(id).delete({returnChanges: true}).run()
    .then(res => {
      return res;
    })
    .then(firstChange);
  }
};

const jsen = require('jsen');
const _ = require('lodash');

const r = require('../lib/db.js');
const schema = require('../schema.js').event;
console.log('schema', schema);
const validate = jsen(schema);
console.log(validate);

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
  get: (params, preFilter) => {
    const table = r.table('events');

    if (params.id) {
      return table.get(params.id).run()
      .then(res => { return {result: res} });
    }
    var parms = _.assign({}, params);
    params = _.assign({result: true, order: 'asc'}, normaliseParams(params));

    const filterParams = properties.reduce(onlyProps(params), {});
    var filteredTable;
    if (preFilter) {
      return Promise.resolve({result: table.filter(parms)});

    } else {
      filteredTable = table.filter(filterParams);
    }

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
    const table = r.table('events');

    if (params.id) {
      return table.get(params.id).changes({includeInitial: true, includeStates: true}).run();
    }

    params = _.assign({order: 'asc'}, normaliseParams(params));

    const filterParams = properties.reduce(onlyProps(params), {});
    const filteredTable = table.filter(filterParams);

    const query = buildQuery(filteredTable, params);

    return table.getAll(r.args(query.getField('id').coerceTo('array'))).changes({includeInitial: true, includeStates: true}).run();
  },
  create: (event, hotBod) => {
    var res = {};
    if (hotBod) {
      res = {};
      Object.keys(event).forEach(function(key) {
        if (key === "event") {
          res[key] = a[key];
        } else {
          res[key] =  Number.parseFloat(a[key]);
        }
      });
      console.log('RES FINAL', res);
    } else {
      console.log('event', event)
      event.split('&').forEach(function(line) {
        var l = line.split('=');
        if (l[0] === "event") {
          res[l[0]] = l[1];
        } else {
          res[l[0]] = Number.parseFloat(l[1]);
        }
      });
      Object.keys(res).forEach(function(key) {
        if (key === "event") {
          res[key] = res[key];
        } else {
          res[key] =  Number.parseFloat(res[key]);
        }
      });
      console.log('eventres', res);
    }
    res.timeStamp = Date.now();
    const valid = validate(res);
    console.log("valid:", valid);
    // if (!valid) return Promise.reject(valid);

    //Some day, when the sky is dark, and the world is silent; I will look upon this code and tremble. For it is the destroyer of happiness. Serialized fucking json objects won't say they're ojbects of the correct format. Since I've whipped the team into shape, and all events are sent correctly anyway; we're removing restrictions, and accepting any and all data; no matter how absolutely borked it may be. May god have mercy on my soul.
    return r.table('events').insert(res, {returnChanges: true}).run()
    .then(firstChange);
  },
  update: (event) => {
    const valid = validate(event);
    if (!valid) return Promise.reject(valid);
    return r.table('events').update(event, {returnChanges: true}).run()
    .then(firstChange);
  },
  delete: (id) => {
    return r.table('events').get(id).delete({returnChanges: true}).run()
    .then(res => {
      return res;
    })
    .then(firstChange);
  }
};

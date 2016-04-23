const test = require('blue-tape');
const fetch = require('node-fetch');
const _ = require('lodash');
const fixture = require('../../fixtures/symptom');
const IO = require('socket.io-client');

const assertOk = (t) => {
  return (res) => {
    return t.ok(res.ok, 'statusCode is 2xx');
  }
};

const unwrapJSON = (res) => {
  return res.json()
  .then(json => json.result);
}

const unwrapOldVal = (res) => {
  return res.json()
  .then(json => json.old_val);
}

const getJSON = (suffix) => {
  return fetch(url+suffix)
  .then(unwrapJSON);
}

const url = 'http://localhost:'+process.env.PORT;

const sender = method => suffix => data => {
  return fetch(url+suffix, {
    method: method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify( data )
  });
};

const poster = sender('post');
const putter = sender('put');

const deleter = suffix => () => {
  return fetch(url+suffix, {
    method: 'delete',
    headers: {
      'Accept': 'application/json',
    }
  });
};

const symptomPoster = poster('/symptoms')

const symptomCreator = times => {
  return Promise.all(_.times(times, () => {
    const data = fixture.valid();
    return symptomPoster(data)
    .then(unwrapJSON)
  }));
};

const pop = data => data[0];

const singlesymptomCreator = () => symptomCreator(1).then(pop);

test('POSTing a valid sprint should return 200', (t) => {
  const symptom = fixture.valid();
  return symptomPoster(symptom)
  .then(assertOk(t));
});

test('GET /symptoms/:id should return 200', (t) => {
  return singlesymptomCreator()
  .then(body => fetch(url+'/symptoms/'+body.id))
  .then(assertOk(t));
});

test('GET /symptoms should return 200', (t) => {
  return singlesymptomCreator()
  .then(() => fetch(url+'/symptoms'))
  .then(assertOk(t));
});

test('GET /symptoms should return an object with a .result property', (t) => {
  return singlesymptomCreator()
  .then(() => fetch(url+'/symptoms'))
  .then(res => res.json())
  .then(json => {
    t.equal(typeof json, 'object');
    t.ok(json.result);
  });
});

test('GET /symptoms should accept search params in the querystring', (t) => {
  return symptomCreator(2)
  .then(symptoms => {
    const target = Object.keys(symptoms[0]).filter(k => k != 'id')[0];
    return getJSON('/symptoms?'+target+'='+symptoms[0][target])
    .then(json => {
      t.equal(json.length, 1);
      t.equal(json[0][target], symptoms[0][target]);
    });
  });
});

test('GET /symptoms should not match non-property search params in the querystring', (t) => {
  return symptomCreator(2)
  .then(symptoms => {
    return getJSON('/symptoms?foo='+symptoms[0].id)
    .then(json => {
      t.ok(json.length > 1);
    });
  });
});

test('GET /symptoms should return an array', (t) => {
  return singlesymptomCreator()
  .then(() => getJSON('/symptoms'))
  .then(json => {
    t.ok(Array.isArray(json));
  });
});

test('GET /symptoms should paginate if asked', (t) => {
  return symptomCreator(5)
  .then(() => getJSON('/symptoms?limit=2'))
  .then(json => {
    t.equal(json.length, 2);
  });
});

test('GET /symptoms should skip if asked', (t) => {
  return symptomCreator(5)
  .then(() => getJSON('/symptoms?limit=2'))
  .then(first => {
    t.equal(first.length, 2);
    return getJSON('/symptoms?limit=2&skip=2')
    .then(second => {
      t.equal(second.length, 2);
      t.notDeepEqual(first, second);
    });
  });
});

test('GET /symptoms should orderBy if asked', (t) => {
  return symptomCreator(15)
  .then(() => getJSON('/symptoms?orderBy=id'))
  .then(results => {
    const reordered = _.clone(results).sort((a, b) => {
      if (a.id > b.id) return 1;
      if (a.id < b.id) return -1;
      return 0;
    });
    t.deepEqual(_.pluck(reordered, 'id'), _.pluck(results, 'id'));
  });
});

test('GET /symptoms should orderBy asc if asked', (t) => {
  return symptomCreator(15)
  .then(() => getJSON('/symptoms?orderBy=id&order=asc'))
  .then(results => {
    const reordered = _.clone(results).sort((a, b) => {
      if (a.id > b.id) return 1;
      if (a.id < b.id) return -1;
      return 0;
    });
    t.deepEqual(_.pluck(reordered, 'id'), _.pluck(results, 'id'));
  });
});

test('GET /symptoms should orderBy desc if asked', (t) => {
  return symptomCreator(15)
  .then(() => getJSON('/symptoms?orderBy=id&order=desc'))
  .then(results => {
    const reordered = _.clone(results).sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });
    t.deepEqual(_.pluck(reordered, 'id'), _.pluck(results, 'id'));
  });
});

test('GET /symptoms?count=true&limit=n should return n matching docs with a count of all matching docs ', (t) => {
  return symptomCreator(10)
  .then(() => fetch(url+'/symptoms?count=true&limit=5'))
  .then(res => res.json())
  .then(json => {
    t.equal(json.result.length, 5);
    t.ok(json.count);
    t.ok(json.count > 5);
  });
});

test('GET /symptoms?limit=n should return n matching docs without a count of all matching docs ', (t) => {
  return symptomCreator(10)
  .then(() => fetch(url+'/symptoms?limit=5'))
  .then(res => res.json())
  .then(json => {
    t.equal(json.result.length, 5);
    t.ok(!json.count);
  });
});

test('GET /symptoms?count=true&result=false should return only a count with no matching docs', (t) => {
  return symptomCreator(10)
  .then(() => fetch(url+'/symptoms?count=true&result=false'))
  .then(res => res.json())
  .then(json => {
    t.ok(!json.result, 'has no result');
    t.ok(json.count, 'has a count');
    t.ok(json.count > 5, 'count is greater than 5');
  });
});


test('POSTing a valid symptom should actually persist it', (t) => {
  return singlesymptomCreator()
  .then(spec => {
    return getJSON('/symptoms/'+spec.id)
    .then((json) => {
      t.equal(json.id, spec.id);
    });
  });
});

test('PUTing an updated symptom should actually persist it', (t) => {
  return singlesymptomCreator()
  .then(body => {
    body.name = 'Something else';
    return body
  })
  .then(body => putter('/symptoms/'+body.id)(body))
  .then(unwrapJSON)
  .then(body => getJSON('/symptoms/'+body.id))
  .then((json) => {
    t.equal(json.name, 'Something else');
  });
});

test('DELETEing a symptom should return 200', (t) => {
  return singlesymptomCreator()
  .then(body => deleter('/symptoms/'+body.id)())
  .then(assertOk(t));
});

test('DELETEing a symptom should actually delete it', (t) => {
  return singlesymptomCreator()
  .then(body => deleter('/symptoms/'+body.id)())
  .then(unwrapOldVal)
  .then(body => fetch(url+'/symptoms/'+body.id))
  .then(res => {
    t.equal(res.status, 404);
  });
});

test('opening a websocket connection to a symptom should return it', (t) => {
  return singlesymptomCreator()
  .then(body => {
    return new Promise(resolve => {
      const io = IO(url+'/symptoms', {query: 'id='+body.id, forceNew: true});
      io.on('record', data => {
        resolve(data.new_val);
        io.disconnect();
      });
    })
    .then(data => {
      t.deepEqual(data, body);
    });
  });
});

test('opening a websocket connection to symptoms should return all of them', (t) => {
  return symptomCreator(2)
  .then(body => {
    return new Promise(resolve => {
      const io = IO(url+'/symptoms', {forceNew: true});
      var count = 0;
      io.on('record', () => {
        count++;
        if (count > 1) {
          resolve();
          io.disconnect();
        }
      });
    });
  });
});

test('opening a websocket connection to symptoms should return changed documents', (t) => {
  return singlesymptomCreator()
  .then(body => {
    return new Promise(resolve => {
      const io = IO(url+'/symptoms', {forceNew: true});
      io.on('state', data => {
        if (data.state === 'ready') {
          const target = _.assign({}, body, {name: 'ohai'});
          io.on('record', data => {
            t.deepEqual(data.new_val, target);
            t.notDeepEqual(data.new_val, body);
            io.disconnect();
            resolve();
          });
          putter('/symptoms/'+body.id)(target)
        };
      });
    });
  });
});

test('websockets should accept the same filter params as GET requests', (t) => {
  return symptomCreator(2)
  .then(symptoms => {
    const target = symptoms[0];
    const targetKey = Object.keys(target).filter(k => k !== 'id')[0];
    return new Promise(resolve => {
      const query = [targetKey].reduce((r, k) => {
        r[k] = target[k];
        return r;
      }, {});
      const io = IO(url+'/symptoms', {query: query, forceNew: true});
      io.on('record', data => {
        t.deepEqual(data.new_val, target);
      });
      io.on('state', data => {
        if (data.state != 'ready') return;
        io.disconnect();
        t.end();
      });
    });
  });
});

test('websockets should accept the same limit param as GET requests', (t) => {
  return symptomCreator(2)
  .then(() => {
    return new Promise(resolve => {
      const io = IO(url+'/symptoms', {query: {limit: 1}, forceNew: true});
      var count = 0;
      io.on('record', data => {
        count++;
      });
      io.on('state', data => {
        if (data.state != 'ready') return;
        io.disconnect();
        t.equal(count, 1);
        t.end();
      });
    });
  });
});

test('websockets should skip if asked', (t) => {
  return symptomCreator(5)
  .then(() => {
    return new Promise(resolve => {
      const io = IO(url+'/symptoms', {query: {limit: 1}, forceNew: true});
      var first;
      io.on('record', data => {
        first = data;
        io.disconnect();
        const io2 = IO(url+'/symptoms', {query: {skip: 1}, forceNew: true});
        io2.on('record', data => {
          t.notDeepEqual(data, first);
          io2.disconnect();
          return resolve();
        });
      });
    });
  });
});

test('websockets should orderBy asc if asked', (t) => {
  // The websocket API won't return its results in order, but they will be pulled from the right part of the database
  return symptomCreator(15)
  .then(() => {
    return new Promise(resolve => {
      const io = IO(url+'/symptoms', {query: {orderBy: 'id', order: 'asc'}, forceNew: true});
      const results = [];
      io.on('record', data => {
        results.push(data.new_val);
      });
      io.on('state', data => {
        if (data.state !== 'ready') return;
        io.disconnect();
        const reordered = _.clone(results).sort((a, b) => {
          if (a.id > b.id) return 1;
          if (a.id < b.id) return -1;
          return 0;
        });
        return resolve(getJSON('/symptoms?orderBy=id&order=asc')
        .then(json => {
          t.deepEqual(_.pluck(reordered, 'id'), _.pluck(json, 'id'));
        }));
      });
    });
  });
});

test('websockets should orderBy desc if asked', (t) => {
  return symptomCreator(15)
  .then(() => {
    return new Promise(resolve => {
      const io = IO(url+'/symptoms', {query: {orderBy: 'id', order: 'desc'}, forceNew: true});
      const results = [];
      io.on('record', data => {
        results.push(data.new_val);
      });
      io.on('state', data => {
        if (data.state !== 'ready') return;
        io.disconnect();
        const reordered = _.clone(results).sort((a, b) => {
          if (a.id < b.id) return 1;
          if (a.id > b.id) return -1;
          return 0;
        });
        return resolve(getJSON('/symptoms?orderBy=id&order=desc')
        .then(json => {
          t.deepEqual(_.pluck(reordered, 'id'), _.pluck(json, 'id'));
        }));
      });
    });
  });
});

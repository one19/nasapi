const test = require('blue-tape');
const fetch = require('node-fetch');
const _ = require('lodash');
const fixture = require('../../fixtures/event');
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

const eventPoster = poster('/events')

const eventCreator = times => {
  return Promise.all(_.times(times, () => {
    const data = fixture.valid();
    return eventPoster(data)
    .then(unwrapJSON)
  }));
};

const pop = data => data[0];

const singleeventCreator = () => eventCreator(1).then(pop);

test('POSTing a valid sprint should return 200', (t) => {
  const event = fixture.valid();
  return eventPoster(event)
  .then(assertOk(t));
});

test('GET /events/:id should return 200', (t) => {
  return singleeventCreator()
  .then(body => fetch(url+'/events/'+body.id))
  .then(assertOk(t));
});

test('GET /events should return 200', (t) => {
  return singleeventCreator()
  .then(() => fetch(url+'/events'))
  .then(assertOk(t));
});

test('GET /events should return an object with a .result property', (t) => {
  return singleeventCreator()
  .then(() => fetch(url+'/events'))
  .then(res => res.json())
  .then(json => {
    t.equal(typeof json, 'object');
    t.ok(json.result);
  });
});

test('GET /events should accept search params in the querystring', (t) => {
  return eventCreator(2)
  .then(events => {
    const target = Object.keys(events[0]).filter(k => k != 'id')[0];
    return getJSON('/events?'+target+'='+events[0][target])
    .then(json => {
      t.equal(json.length, 1);
      t.equal(json[0][target], events[0][target]);
    });
  });
});

test('GET /events should not match non-property search params in the querystring', (t) => {
  return eventCreator(2)
  .then(events => {
    return getJSON('/events?foo='+events[0].id)
    .then(json => {
      t.ok(json.length > 1);
    });
  });
});

test('GET /events should return an array', (t) => {
  return singleeventCreator()
  .then(() => getJSON('/events'))
  .then(json => {
    t.ok(Array.isArray(json));
  });
});

test('GET /events should paginate if asked', (t) => {
  return eventCreator(5)
  .then(() => getJSON('/events?limit=2'))
  .then(json => {
    t.equal(json.length, 2);
  });
});

test('GET /events should skip if asked', (t) => {
  return eventCreator(5)
  .then(() => getJSON('/events?limit=2'))
  .then(first => {
    t.equal(first.length, 2);
    return getJSON('/events?limit=2&skip=2')
    .then(second => {
      t.equal(second.length, 2);
      t.notDeepEqual(first, second);
    });
  });
});

test('GET /events should orderBy if asked', (t) => {
  return eventCreator(15)
  .then(() => getJSON('/events?orderBy=id'))
  .then(results => {
    const reordered = _.clone(results).sort((a, b) => {
      if (a.id > b.id) return 1;
      if (a.id < b.id) return -1;
      return 0;
    });
    t.deepEqual(_.pluck(reordered, 'id'), _.pluck(results, 'id'));
  });
});

test('GET /events should orderBy asc if asked', (t) => {
  return eventCreator(15)
  .then(() => getJSON('/events?orderBy=id&order=asc'))
  .then(results => {
    const reordered = _.clone(results).sort((a, b) => {
      if (a.id > b.id) return 1;
      if (a.id < b.id) return -1;
      return 0;
    });
    t.deepEqual(_.pluck(reordered, 'id'), _.pluck(results, 'id'));
  });
});

test('GET /events should orderBy desc if asked', (t) => {
  return eventCreator(15)
  .then(() => getJSON('/events?orderBy=id&order=desc'))
  .then(results => {
    const reordered = _.clone(results).sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });
    t.deepEqual(_.pluck(reordered, 'id'), _.pluck(results, 'id'));
  });
});

test('GET /events?count=true&limit=n should return n matching docs with a count of all matching docs ', (t) => {
  return eventCreator(10)
  .then(() => fetch(url+'/events?count=true&limit=5'))
  .then(res => res.json())
  .then(json => {
    t.equal(json.result.length, 5);
    t.ok(json.count);
    t.ok(json.count > 5);
  });
});

test('GET /events?limit=n should return n matching docs without a count of all matching docs ', (t) => {
  return eventCreator(10)
  .then(() => fetch(url+'/events?limit=5'))
  .then(res => res.json())
  .then(json => {
    t.equal(json.result.length, 5);
    t.ok(!json.count);
  });
});

test('GET /events?count=true&result=false should return only a count with no matching docs', (t) => {
  return eventCreator(10)
  .then(() => fetch(url+'/events?count=true&result=false'))
  .then(res => res.json())
  .then(json => {
    t.ok(!json.result, 'has no result');
    t.ok(json.count, 'has a count');
    t.ok(json.count > 5, 'count is greater than 5');
  });
});


test('POSTing a valid event should actually persist it', (t) => {
  return singleeventCreator()
  .then(spec => {
    return getJSON('/events/'+spec.id)
    .then((json) => {
      t.equal(json.id, spec.id);
    });
  });
});

test('PUTing an updated event should actually persist it', (t) => {
  return singleeventCreator()
  .then(body => {
    body.name = 'Something else';
    return body
  })
  .then(body => putter('/events/'+body.id)(body))
  .then(unwrapJSON)
  .then(body => getJSON('/events/'+body.id))
  .then((json) => {
    t.equal(json.name, 'Something else');
  });
});

test('DELETEing a event should return 200', (t) => {
  return singleeventCreator()
  .then(body => deleter('/events/'+body.id)())
  .then(assertOk(t));
});

test('DELETEing a event should actually delete it', (t) => {
  return singleeventCreator()
  .then(body => deleter('/events/'+body.id)())
  .then(unwrapOldVal)
  .then(body => fetch(url+'/events/'+body.id))
  .then(res => {
    t.equal(res.status, 404);
  });
});

test('opening a websocket connection to a event should return it', (t) => {
  return singleeventCreator()
  .then(body => {
    return new Promise(resolve => {
      const io = IO(url+'/events', {query: 'id='+body.id, forceNew: true});
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

test('opening a websocket connection to events should return all of them', (t) => {
  return eventCreator(2)
  .then(body => {
    return new Promise(resolve => {
      const io = IO(url+'/events', {forceNew: true});
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

test('opening a websocket connection to events should return changed documents', (t) => {
  return singleeventCreator()
  .then(body => {
    return new Promise(resolve => {
      const io = IO(url+'/events', {forceNew: true});
      io.on('state', data => {
        if (data.state === 'ready') {
          const target = _.assign({}, body, {name: 'ohai'});
          io.on('record', data => {
            t.deepEqual(data.new_val, target);
            t.notDeepEqual(data.new_val, body);
            io.disconnect();
            resolve();
          });
          putter('/events/'+body.id)(target)
        };
      });
    });
  });
});

test('websockets should accept the same filter params as GET requests', (t) => {
  return eventCreator(2)
  .then(events => {
    const target = events[0];
    const targetKey = Object.keys(target).filter(k => k !== 'id')[0];
    return new Promise(resolve => {
      const query = [targetKey].reduce((r, k) => {
        r[k] = target[k];
        return r;
      }, {});
      const io = IO(url+'/events', {query: query, forceNew: true});
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
  return eventCreator(2)
  .then(() => {
    return new Promise(resolve => {
      const io = IO(url+'/events', {query: {limit: 1}, forceNew: true});
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
  return eventCreator(5)
  .then(() => {
    return new Promise(resolve => {
      const io = IO(url+'/events', {query: {limit: 1}, forceNew: true});
      var first;
      io.on('record', data => {
        first = data;
        io.disconnect();
        const io2 = IO(url+'/events', {query: {skip: 1}, forceNew: true});
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
  return eventCreator(15)
  .then(() => {
    return new Promise(resolve => {
      const io = IO(url+'/events', {query: {orderBy: 'id', order: 'asc'}, forceNew: true});
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
        return resolve(getJSON('/events?orderBy=id&order=asc')
        .then(json => {
          t.deepEqual(_.pluck(reordered, 'id'), _.pluck(json, 'id'));
        }));
      });
    });
  });
});

test('websockets should orderBy desc if asked', (t) => {
  return eventCreator(15)
  .then(() => {
    return new Promise(resolve => {
      const io = IO(url+'/events', {query: {orderBy: 'id', order: 'desc'}, forceNew: true});
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
        return resolve(getJSON('/events?orderBy=id&order=desc')
        .then(json => {
          t.deepEqual(_.pluck(reordered, 'id'), _.pluck(json, 'id'));
        }));
      });
    });
  });
});

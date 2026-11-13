'use strict';

// Ensure mysql2 returns DATETIME/TIMESTAMP columns as strings. The existing
// API normalizes MySQL DATETIME values with String(...).replace(...), which
// must not receive a JavaScript Date object.
const Module = require('module');
const originalLoad = Module._load;

Module._load = function loadWithDateStrings(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);
  if (request !== 'mysql2/promise' || !loaded || loaded.__dateStringsEnabled) {
    return loaded;
  }

  const createPool = loaded.createPool.bind(loaded);
  loaded.createPool = (config, ...args) => createPool({ ...config, dateStrings: true }, ...args);
  Object.defineProperty(loaded, '__dateStringsEnabled', { value: true });
  return loaded;
};

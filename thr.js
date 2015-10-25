(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var request = require('superagent');
var LRU = require('storage-lru').StorageLRU;
var asyncify = require('storage-lru').asyncify;
var cache = new LRU(asyncify(localStorage));

/**
 * Initialize.
 */

function THR() {
  if (!(this instanceof THR)) return new THR();
  this.addr = 'https://znbtd4y5ii.execute-api.us-east-1.amazonaws.com/prod/';
};

/**
 * Username of the user whose rotation you want to fetch.
 */

THR.prototype.user = function(user) {
  this.user = user;
  return this;
}

/**
 * Selector to append the icon images to.
 */

THR.prototype.sel = function(sel) {
  this.sel = sel;
  return this;
}

/**
 * Fetch and set the images.
 */

THR.prototype.fetch = function(cb) {
  if (!cb) cb = function(){};
  var self = this;

  cache.getItem(key(self.user), { json: true }, function (err, imgs) {
    if (imgs) {
      self.setImgs(imgs);
      return cb(imgs);
    }

    request
      .post(self.addr)
      .send({ username: self.user })
      .end(function(err, res) {
        if (err) return cb(err);
        cache.setItem(key(self.user), res.body, {
          json: true, cacheControl:'max-age=86400'
        });
        self.setImgs(res.body);
        cb(res.body);
      });
  });

}

/**
 * Add imgs to dom.
 */

THR.prototype.setImgs = function(imgs) {
  var node = document.querySelector(this.sel);
  imgs.forEach(function (e) {
    var img = document.createElement("img");
    img.src = e.icon;
    node.appendChild(img);
  });
}

/**
 * Key for given `username`.
 */

function key(username) {
  return 'thr:' + username;
}

window.THR = THR;

},{"storage-lru":2,"superagent":7}],2:[function(require,module,exports){
/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
module.exports = {
        StorageLRU: require('./src/StorageLRU'),
        asyncify: require('./src/asyncify')
    }

},{"./src/StorageLRU":5,"./src/asyncify":6}],3:[function(require,module,exports){
(function (process){
module.exports = function (arr, iterator, callback) {
  callback = callback || function () {};
  if (!Array.isArray(arr) || !arr.length) {
      return callback();
  }
  var completed = 0;
  var iterate = function () {
    iterator(arr[completed], function (err) {
      if (err) {
        callback(err);
        callback = function () {};
      }
      else {
        ++completed;
        if (completed >= arr.length) { callback(); }
        else { nextTick(iterate); }
      }
    });
  };
  iterate();
};

function nextTick (cb) {
  if (typeof setImmediate === 'function') {
    setImmediate(cb);
  } else {
    process.nextTick(cb);
  }
}
}).call(this,require('_process'))
},{"_process":10}],4:[function(require,module,exports){
(function (process,global){
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var setImmediate;

    function addFromSetImmediateArguments(args) {
        tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
        return nextHandle++;
    }

    // This function accepts the same arguments as setImmediate, but
    // returns a function that requires no arguments.
    function partiallyApplied(handler) {
        var args = [].slice.call(arguments, 1);
        return function() {
            if (typeof handler === "function") {
                handler.apply(undefined, args);
            } else {
                (new Function("" + handler))();
            }
        };
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    task();
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function installNextTickImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            process.nextTick(partiallyApplied(runIfPresent, handle));
            return handle;
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            global.postMessage(messagePrefix + handle, "*");
            return handle;
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            channel.port2.postMessage(handle);
            return handle;
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
            return handle;
        };
    }

    function installSetTimeoutImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
            return handle;
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":10}],5:[function(require,module,exports){
/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
'use strict';

var ERR_DISABLED = {code: 1, message: 'disabled'};
var ERR_DESERIALIZE = {code: 2, message: 'cannot deserialize'};
var ERR_SERIALIZE = {code: 3, message: 'cannot serialize'};
var ERR_CACHECONTROL = {code: 4, message: 'bad cacheControl'};
var ERR_INVALIDKEY = {code: 5, message: 'invalid key'};
var ERR_NOTENOUGHSPACE = {code: 6, message: 'not enough space'};
var ERR_REVALIDATE = {code: 7, message: 'revalidate failed'};
    // cache control fields
var MAX_AGE = 'max-age';
var STALE_WHILE_REVALIDATE = 'stale-while-revalidate';
var DEFAULT_KEY_PREFIX = '';
var DEFAULT_PRIORITY = 3;
var DEFAULT_PURGE_LOAD_INCREASE = 500;
var DEFAULT_PURGE_ATTEMPTS = 2;
var CUR_VERSION = '1';

var asyncEachSeries = require('async-each-series');
require('setimmediate');

 
function isDefined (x) { return x !== undefined; }

function getIntegerOrDefault (x, defaultVal) {
    if ((typeof x !== 'number') || (x % 1 !== 0)) {
        return defaultVal;
    }
    return x;
}

function cloneError (err, moreInfo) {
    var message = err.message;
    if (moreInfo) {
        message += ': ' + moreInfo;
    }
    return {code: err.code, message: message};
}

function merge () {
    var merged = {};
    for (var i = 0, len = arguments.length; i < len; i++) {
        var obj = arguments[i];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                merged[key] = obj[key];
            }
        }
    }
    return merged;
}

function nowInSec () {
    return Math.floor(new Date().getTime() / 1000);
}

/*
 * Use this to sort meta records array.  Item to be purged first
 * should be the first in the array after sort.
 */
function defaultPurgeComparator (meta1, meta2) {
    // purge bad entries first
    if (meta1.bad !== meta2.bad) {
        return meta1.bad ? -1 : 1;
    }
    // purge truly stale one first
    var now = nowInSec();
    var stale1 = now >= (meta1.expires + meta1.stale);
    var stale2 = now >= (meta2.expires + meta2.stale);
    if (stale1 !== stale2) {
        return stale1 ? -1 : 1;
    }

    // both fetchable (not truly staled); purge lowest priority one first
    if (meta1.priority !== meta2.priority) {
        return (meta1.priority > meta2.priority) ? -1 : 1;
    }

    // same priority; purge least access one first
    if (meta1.access !== meta2.access) {
        return (meta1.access < meta2.access) ? -1 : 1;
    }
    // compare size. big ones go first.
    if (meta1.size > meta2.size) {
        return -1;
    } else if (meta1.size === meta2.size) {
        return 0;
    } else {
        return 1;
    }
}

function Meta (storageInterface, parser, options) {
    this.storage = storageInterface;
    this.parser = parser;
    this.options = options || {};
    this.records = [];
}

Meta.prototype.getMetaFromItem = function (key, item) {
    var meta;
    try {
        meta = this.parser.parse(item).meta;
        meta.key = key;
    } catch (ignore) {
        // ignore
        meta = {key: key, bad: true, size: item.length};
    }
    return meta;
};

Meta.prototype.updateMetaRecord = function (key, callback) {
    var self = this;

    self.storage.getItem(key, function getItemCallback (err, item) {
        if (!err) {
            self.records.push(self.getMetaFromItem(key, item));
        }
        callback && callback();
    });
};

Meta.prototype.generateRecordsHash = function () {
    var self = this;
    var retval = {};
    self.records.forEach(function recordsIterator (record) {
        retval[record.key] = true;
    });
    return retval;
};

Meta.prototype.init = function (scanSize, callback) {
    // expensive operation
    // go through all items in storage, get meta data
    var self = this;
    var storage = self.storage;
    var keyPrefix = self.options.keyPrefix;
    var doneInserting = 0;
    if (scanSize <= 0) {
        callback && callback();
        return;
    }

    storage.keys(scanSize, function getKeysCallback (err, keys) {
        var numKeys = keys.length;
        if (numKeys <= 0) {
            callback && callback();
            return;
        }
        // generate the records hash
        var recordsHash = self.generateRecordsHash();
        keys.forEach(function keyIterator (key) {
            // if the keyPrefix is different from the current options or we already have a record, ignore this key
            if (!recordsHash[key] && (!keyPrefix || key.indexOf(keyPrefix) === 0)) {
                self.updateMetaRecord(key, function updateMetaRecordCallback () {
                    doneInserting += 1;
                    recordsHash[key] = true;
                    if (doneInserting === numKeys) {
                       callback && callback();
                    }
                });
            } else {
                doneInserting += 1;
                if (doneInserting === numKeys) {
                    callback && callback();
                }
            }
        });
    });
};

Meta.prototype.sort = function (comparator) {
    this.records.sort(comparator);
};
Meta.prototype.update = function (key, meta) {
    for (var i = 0, len = this.records.length; i < len; i++) {
        var record = this.records[i];
        if (record.key === key) {
            record.bad = false; // in case it was a bad record before
            this.records[i] = merge(record, meta);
            return this.records[i];
        }
    }
    // record does not exist. create a new one.
    meta = merge(meta, {key: key});
    this.records.push(meta);
    return meta;
};
Meta.prototype.remove = function (key) {
    for (var i = 0, len = this.records.length; i < len; i++) {
        if (this.records[i].key === key) {
            this.records.splice(i, 1);
            return;
        }
    }
};
Meta.prototype.numRecords = function () {
    return this.records.length;
};

function Parser () {}
Parser.prototype.format = function (meta, value) {
    if (meta && meta.access > 0 && meta.expires > 0 && meta.stale >= 0 && meta.priority > 0 && meta.maxAge > 0) {
        return '[' + [CUR_VERSION, meta.access, meta.expires, meta.maxAge, meta.stale, meta.priority].join(':') + ']' + value;
    }
    throw new Error('invalid meta');
};
Parser.prototype.parse = function (item) {
    // format is:
    // [<version>:<access_time_in_sec>:<expires_time_in_sec>:<max_age_in_sec>:<stale_time_in_sec>:<priority>]<value_string_can_be_very_long>
    // in the future, parse version out first; then fields depending on version
    var pos = item && item.indexOf(']');
    if (!pos) {
        throw new Error('missing meta');
    }
    var meta = item.substring(1, pos).split(':');
    if (meta.length !== 6) {
        throw new Error('invalid number of meta fields');
    }
    meta = {
        version: meta[0],
        access: parseInt(meta[1], 10),
        expires: parseInt(meta[2], 10),
        maxAge: parseInt(meta[3], 10),
        stale: parseInt(meta[4], 10),
        priority: parseInt(meta[5], 10),
        size: item.length
    };
    if (isNaN(meta.access) || isNaN(meta.expires) || isNaN(meta.maxAge) || isNaN(meta.stale) || meta.access <= 0 || meta.expires <= 0 || meta.maxAge <= 0 || meta.stale < 0 || meta.priority <= 0) {
        throw new Error('invalid meta fields');
    }
    return {
        meta: meta,
        value: item.substring(pos + 1)
    };
};

function Stats (meta) {
    this.hit = 0;
    this.miss = 0;
    this.stale = 0;
    this.error = 0;
    this.revalidateSuccess = 0;
    this.revalidateFailure = 0;
}
Stats.prototype.toJSON = function () {
    var stats = {
        hit: this.hit,
        miss: this.miss,
        stale: this.stale,
        error: this.error,
        revalidateSuccess: this.revalidateSuccess,
        revalidateFailure: this.revalidateFailure
    };
    return stats;
};

/**
 * @class StorageLRU
 * @constructor
 * @param {Object} storageInterface  A storage object (such as window.localStorage, but not limited to localStorage)
 *                   that conforms to the localStorage API.
 * @param {Object} [options]
 * @param {Number} [options.recheckDelay=-1]  If the underline storage is disabled, this option defines the delay time interval
 *                   for re-checking whether the underline storage is re-enabled.  Default value is -1, which
 *                   means no re-checking.
 * @param {String} [options.keyPrefix=''] Storage key prefix.
 * @param {Number} [options.purgeFactor=1]  Extra space to purge. E.g. if space needed for a new item is 1000 characters, LRU will actually
 *                   try to purge (1000 + 1000 * purgeFactor) characters.
 * @param {Number} [options.maxPurgeAttempts=2] The number of times to load 'purgeLoadIncrease' more keys if purge cannot initially
 *                    find enough space.
 * @param {Number} [options.purgeLoadIncrease=500] The number of extra keys to load with each purgeLoadAttempt when purge cannot initially
 *                    find enough space.
 * @param {Function} [options.purgedFn] The callback function to be executed, if an item is purged.  *Note* This function will be
 *                   asynchronously called, meaning, you won't be able to cancel the purge.
 * @param {Function} [options.purgeComparator] If you really want to, you can customize the comparator used to determine items'
 *                   purge order.  The default comparator purges in this precendence order (from high to low):
 *                      bad entry (invalid meta info),
 *                      truly stale (passed stale-while-revaliate window),
 *                      lowest priority,
 *                      least recently accessed,
 *                      bigger byte size
 * @param {Function} [options.revalidateFn] The function to be executed to refetch the item if it becomes expired but still
 *                   in the stale-while-revalidate window.
 */
function StorageLRU (storageInterface, options) {
    var self = this;
    options = options || {};
    var callback = options.onInit;
    self.options = {};
    self.options.recheckDelay = isDefined(options.recheckDelay) ? options.recheckDelay : -1;
    self.options.keyPrefix = options.keyPrefix || DEFAULT_KEY_PREFIX;
    self.options.purgeLoadIncrease = getIntegerOrDefault(options.purgeLoadIncrease, DEFAULT_PURGE_LOAD_INCREASE);
    self.options.maxPurgeAttempts = getIntegerOrDefault(options.maxPurgeAttempts, DEFAULT_PURGE_ATTEMPTS);
    self.options.purgedFn = options.purgedFn;
    var metaOptions = {
        keyPrefix: self.options.keyPrefix
    };
    self._storage = storageInterface;
    self._purgeComparator = options.purgeComparator || defaultPurgeComparator;
    self._revalidateFn = options.revalidateFn;
    self._parser = new Parser();
    self._meta = new Meta(self._storage, self._parser, metaOptions);
    self._stats = new Stats();
    self._enabled = true;
}

/**
 * Reports statistics information.
 * @method stats
 * @return {Object} statistics information, including:
 *   - hit: Number of cache hits
 *   - miss: Number of cache misses
 *   - error: Number of errors occurred during getItem
 *   - stale: Number of occurrances where stale items were returned (cache hit with data that
 *            expired but still within stale-while-revalidate window)
 */
StorageLRU.prototype.stats = function () {
    return this._stats.toJSON();
};

/**
 * Gets a number of the keys of the items in the underline storage
 * @method keys
 * @param {Number} the number of keys to return
 * @param {Funtion} callback
 */
StorageLRU.prototype.keys = function (num, callback) {
    return this._storage.keys(num, callback);
};

/**
 * Gets the item with the given key in the underline storage.  Note that if the item has exipired but
 * is still in stale-while-revalidate window, its value will be revalidated if revalidateFn is provided
 * when the StorageLRU instance was created.
 * @method getItem
 * @param {String} key  The key string
 * @param {Object} options
 * @param {Boolean} [options.json=false]  Whether the value should be deserialized to a JSON object.
 * @param {Function} callback The callback function.
 * @param {Object} callback.error The error object (an object with code, message fields) if get failed.
 * @param {String|Object} callback.value The value.
 * @param {Object} callback.meta Meta information. Containing isStale field.  isStale=true means this
 *                    item has expired (max-age reached), but still within stale-while-revalidate window.
 *                    isStale=false means this item has not reached its max-age.
 */
StorageLRU.prototype.getItem = function (key, options, callback) {
    if (!key) {
        callback && callback(cloneError(ERR_INVALIDKEY, key));
        return;
    }
    var self = this;
    var prefixedKey = self._prefix(key);
    self._storage.getItem(prefixedKey, function getItemCallback (err, value) {
        if (err || value === null || value === undefined) {
            self._stats.miss++;
            self._meta.remove(prefixedKey);
            callback(cloneError(ERR_INVALIDKEY, key));
            return;
        }

        var deserialized;
        try {
            deserialized = self._deserialize(value, options);
        } catch (e) {
            self._stats.error++;
            callback(cloneError(ERR_DESERIALIZE, e.message));
            return;
        }
        var meta = deserialized.meta,
            now = nowInSec();

        if ((meta.expires + meta.stale) < now) {
            // item exists, but expired and passed stale-while-revalidate window.
            // count as hit miss.
            self._stats.miss++;
            self.removeItem(key);
            callback();
            return;
        }

        // this is a cache hit
        self._stats.hit++;

        // update the access timestamp in the underline storage
        try {
            meta.access = now;
            var serializedValue = self._serialize(deserialized.value, meta, options);
            self._storage.setItem(prefixedKey, serializedValue, function setItemCallback (err) {
                if (!err) {
                    meta = self._meta.update(prefixedKey, meta);
                }
            });
        } catch (ignore) {}

        // is the item already expired but still in the stale-while-revalidate window?
        var isStale = meta.expires < now;
        if (isStale) {
            self._stats.stale++;
            try {
                self._revalidate(key, meta, {json: !!(options && options.json)});
            } catch (ignore) {}
        }
        callback(null, deserialized.value, {isStale: isStale});
    });
};

/**
 * Calls the revalidateFn to fetch a fresh copy of a stale item.
 * @method _revalidate
 * @param {String} key The item key
 * @param {Object} meta  The meta record for this item
 * @param {Object} options
 * @param {Boolean} [options.json=false]  Whether the value is a JSON object.
 * @param {Function} [callback]
 * @param {Object} callback.error The error object (an object with code, message fields) if revalidateFn failed to fetch the item.
 * @private
 */
StorageLRU.prototype._revalidate = function (key, meta, options, callback) {
    var self = this;

    // if revalidateFn is defined, refetch item and save it to storage
    if ('function' !== typeof self._revalidateFn) {
        callback && callback();
        return;
    }

    self._revalidateFn(key, function revalidated (err, value) {
        if (err) {
            self._stats.revalidateFailure++;
            callback && callback(cloneError(ERR_REVALIDATE, err.message));
            return;
        }
        try {
            var now = nowInSec();

            // update the size and expires fields, and inherit other fields.
            // Especially, do not update access timestamp.
            var newMeta = {
                access: meta.access,
                maxAge: meta.maxAge,
                expires: now + meta.maxAge,
                stale: meta.stale,
                priority: meta.priority
            };

            // save into the underline storage and update meta record
            var serializedValue = self._serialize(value, newMeta, options);
            var prefixedKey = self._prefix(key);
            self._storage.setItem(prefixedKey, serializedValue, function setItemCallback (err) {
                if (!err) {
                    newMeta.size = serializedValue.length;
                    self._meta.update(prefixedKey, newMeta);

                    self._stats.revalidateSuccess++;
                } else {
                    self._stats.revalidateFailure++;
                }
            });
        } catch (e) {
            self._stats.revalidateFailure++;
            callback && callback(cloneError(ERR_REVALIDATE, e.message));
            return;
        }
        callback && callback();
    });
};

/**
 * Saves the item with the given key in the underline storage
 * @method setItem
 * @param {String} key  The key string
 * @param {String|Object} value  The value string or JSON object
 * @param {Object} options
 * @param {Boolean} options.cacheControl  Required.  Use the syntax as HTTP Cache-Control header.  To be
 *                   able to use LRU, you need to have a positive "max-age" value (in seconds), e.g. "max-age=300".
 *                   Another very useful field is "stale-while-revalidate", e.g. "max-age=300,stale-while-revalidate=6000".
 *                   If an item has expired (max-age reached), but still within stale-while-revalidate window,
 *                   LRU will allow retrieval the item, but tag it with isStale=true in the callback.
 *                   **Note**:
 *                    - LRU does not try to refetch the item when it is stale-while-revaliate.
 *                    - Having "no-cache" or "no-store" will abort the operation with invalid cache control error. 
 * @param {Boolean} [options.json=false]  Whether the value should be serialized to a string before saving.
 * @param {Number} [options.priority=3]  The priority of the item.  Items with lower priority will be purged before
 *                    items with higher priority, assuming other conditions are the same.
 * @param {Function} [callback] The callback function.
 * @param {Object} callback.error The error object (an object with code, message fields) if setItem failed.
 */
StorageLRU.prototype.setItem = function (key, value, options, callback) {
    if (!key) {
        callback && callback(cloneError(ERR_INVALIDKEY, key));
        return;
    }

    var self = this;
    if (!self._enabled) {
        callback && callback(cloneError(ERR_DISABLED));
        return;
    }

    // parse cache control
    var cacheControl = self._parseCacheControl(options && options.cacheControl);
    if (cacheControl['no-cache'] || cacheControl['no-store'] || !cacheControl[MAX_AGE] || cacheControl[MAX_AGE] <= 0) {
        callback && callback(cloneError(ERR_CACHECONTROL));
        return;
    }

    // serialize value (along with meta data)
    var now = nowInSec();
    var priority = (options && options.priority) || DEFAULT_PRIORITY;
    var meta = {
        expires: now + cacheControl[MAX_AGE],
        maxAge: cacheControl[MAX_AGE],
        stale: cacheControl[STALE_WHILE_REVALIDATE] || 0,
        priority: priority,
        access: now
    };
    var serializedValue;
    try {
        serializedValue = self._serialize(value, meta, options);
    } catch (serializeError) {
        callback && callback(cloneError(ERR_SERIALIZE));
        return;
    }

    // save into the underline storage and update meta record
    var prefixedKey = self._prefix(key);
    self._storage.setItem(prefixedKey, serializedValue, function setItemCallback (err) {
        if (!err) {
            meta.size = serializedValue.length;
            self._meta.update(prefixedKey, meta);
            callback && callback();
            return;
        } else {
            //check to see if there is at least 1 valid key
            self.keys(1, function getKeysCallback (err, keysArr) {
                if (keysArr.length === 0) {
                    // if numItems is 0, private mode is on or storage is disabled.
                    // callback with error and return
                    self._markAsDisabled();
                    callback && callback(cloneError(ERR_DISABLED));
                    return;
                }
                // purge and save again
                var spaceNeeded = serializedValue.length;
                self.purge(spaceNeeded, function purgeCallback (err) {
                    if (err) {
                        // not enough space purged
                        callback && callback(cloneError(ERR_NOTENOUGHSPACE));
                        return;
                    }
                    // purged enough space, now try to save again
                    self._storage.setItem(prefixedKey, serializedValue, function setItemCallback (err) {
                        if (err) {
                            callback && callback(cloneError(ERR_NOTENOUGHSPACE));
                        } else {
                            self._meta.update(prefixedKey, meta);
                            // setItem succeeded after the purge
                            callback && callback();
                        }
                    });
                });
            });
        }
    });
};

/**
 * @method removeItem
 * @param {String} key  The key string
 * @param {Function} [callback] The callback function.
 * @param {Object} callback.error The error object (an object with code, message fields) if removeItem failed.
 */
StorageLRU.prototype.removeItem = function (key, callback) {
    if (!key) {
        callback && callback(cloneError(ERR_INVALIDKEY, key));
        return;
    }
    var self = this;
    key = self._prefix(key);
    self._storage.removeItem(key, function removeItemCallback (err) {
        if (err) {
            callback && callback(cloneError(ERR_INVALIDKEY, key));
            return;
        }
        self._meta.remove(key);
        callback && callback();
    });
};

/**
 * @method _parseCacheControl
 * @param {String} str  The cache control string, following HTTP Cache-Control header syntax.
 * @return {Object} 
 * @private
 */
StorageLRU.prototype._parseCacheControl = function (str) {
    var cacheControl = {};
    if (str) {
        var parts = str.toLowerCase().split(',');
        for (var i = 0, len = parts.length; i < len; i++) {
            var kv = parts[i].split('=');
            if (kv.length === 2) {
                cacheControl[kv[0]] = kv[1];
            } else if (kv.length === 1) {
                cacheControl[kv[0]] = true;
            }
        }
        if (cacheControl[MAX_AGE]) {
            cacheControl[MAX_AGE] = parseInt(cacheControl[MAX_AGE], 10) || 0;
        }
        if (cacheControl[STALE_WHILE_REVALIDATE]) {
            cacheControl[STALE_WHILE_REVALIDATE] = parseInt(cacheControl[STALE_WHILE_REVALIDATE], 10) || 0;
        }
    }
    return cacheControl;
};

/**
 * Prefix the item key with the keyPrefix defined in "options" when LRU instance was created.
 * @method _prefix
 * @param {String} key  The item key.
 * @return {String} The prefixed key.
 * @private
 */
StorageLRU.prototype._prefix = function (key) {
    return this.options.keyPrefix + key;
};

/**
 * Remove the prefix from the prefixed item key.
 * The keyPrefix is defined in "options" when LRU instance was created.
 * @method _deprefix
 * @param {String} prefixedKey  The prefixed item key.
 * @return {String} The item key.
 * @private
 */
StorageLRU.prototype._deprefix = function (prefixedKey) {
    var prefix = this.options.keyPrefix;
    return prefix ? prefixedKey.substring(prefix.length) : prefixedKey;
};

/**
 * Mark the storage as disabled.  For example, when in Safari private mode, localStorage
 * is disabled.  During setItem(), LRU will check whether the underline storage
 * is disabled.
 * If the LRU was created with a recheckDelay option, LRU will re-check whether the underline
 * storage is disabled. after the specified delay time.
 * @method _markAsDisabled
 * @private
 */
StorageLRU.prototype._markAsDisabled = function () {
    var self = this;
    self._enabled = false;
    // set a timeout to mark the cache back to enabled so that status can be checked again
    var recheckDelay = self.options.recheckDelay;
    if (recheckDelay > 0) {
        setTimeout(function reEnable() {
            self._enabled = true;
        }, recheckDelay);
    }
};

/**
 * Serializes the item value and meta info into a string.
 * @method _serialize
 * @param {String|Object} value
 * @param {Object} meta  Meta info for this item, such as access ts, expire ts, stale-while-revalidate window size
 * @param {Object} options
 * @param {Boolean} [options.json=false]
 * @return {String} the serialized string to store in underline storage
 * @private
 * @throw Error
 */
StorageLRU.prototype._serialize = function (value, meta, options) {
    var v = (options && options.json) ? JSON.stringify(value) : value;
    return this._parser.format(meta, v);
};

/**
 * De-serializes the stored string into item value and meta info.
 * @method _deserialize
 * @param {String} str The stored string
 * @param {Object} options
 * @param {Boolean} [options.json=false]
 * @return {Object} An object containing "value" (for item value) and "meta" (Meta data object for this item, such as access ts, expire ts, stale-while-revalidate window size).
 * @private
 * @throw Error
 */
StorageLRU.prototype._deserialize = function (str, options) {
    var parsed = this._parser.parse(str);
    return {
        meta: parsed.meta,
        value: options.json? JSON.parse(parsed.value) : parsed.value
    };
};

/**
 * Purge the underline storage to make room for new data.  If options.purgedFn is defined
 * when LRU instance was created, this function will invoke it with the array if purged keys asynchronously.
 * If the meta data for all objects has not yet been built, then it will occur in this function.
 * @method purge
 * @param {Number} spaceNeeded The char count of space needed for the new data.  Note that
 *                   if options.purgeFactor is defined when LRU instance was created, extra space
 *                   will be purged. E.g. if spaceNeeded is 1000 characters, LRU will actually
 *                   try to purge (1000 + 1000 * purgeFactor) characters.
 * @param {Boolean} forcePurge True if we want to ignore un-initialized records, else false;
 * @param {Function} callback  
 * @param {Error} callback.error  if the space that we were able to purge was less than spaceNeeded.
 */
StorageLRU.prototype.purge = function (spaceNeeded, callback) {
    var self = this;
    var factor = Math.max(0, self.options.purgeFactor) || 1;
    var padding = Math.round(spaceNeeded * factor);

    var removeData = {
        purged: [],
        recordsToRemove: [],
        size: spaceNeeded + padding
    };

    var attempts = [];
    for (var i = 0; i < self.options.maxPurgeAttempts; i++) {
        attempts.push((i + 1) * self.options.purgeLoadIncrease);
    }

    asyncEachSeries(attempts, function purgeAttempt(loadSize, attemptDone) {
        removeData.recordsToRemove = [];
        removeData.purged = [];

        self._meta.init(loadSize, function doneInit() {
            self._meta.sort(self._purgeComparator);
            asyncEachSeries(self._meta.records, function removeItem(record, cb) {
                // mark record to remove, to remove in batch later for performance
                record.remove = true;
                removeData.purged.push(self._deprefix(record.key)); // record purged key
                self._storage.removeItem(record.key, function removeItemCallback (err) {
                    // if there was an error removing, remove the record but assume we still need some space
                    if (!err) {
                        removeData.size = removeData.size - record.size;
                    }
                    if (removeData.size > 0) {
                        cb(); // keep removing
                    } else {
                        cb(true); // done removing
                    }
                });
            }, function itemsRemoved(ignore) {
                // remove records that were marked to remove
                self._meta.records = self._meta.records.filter(function shouldKeepRecord(record) {
                    return record.remove !== true;
                });

                // invoke purgedFn if it is defined
                var purgedCallback = self.options.purgedFn;
                var purged = removeData.purged;
                if (purgedCallback && purged.length > 0) {
                    // execute the purged callback asynchronously to prevent library users
                    // from potentially slow down the purge process by executing long tasks
                    // in this callback.
                    setImmediate(function purgeTimeout() {
                        purgedCallback(purged);
                    });
                }

                if (removeData.size <= padding) {
                    // removed enough space, stop subsequent purge attempts
                    attemptDone(true);
                } else {
                    attemptDone();
                }
            });
        });
    }, function attemptsDone() {
        // async series reached the end, either because all attempts were tried,
        // or enough space was already freed.

        // if enough space was made for spaceNeeded, consider purge as success
        if (callback) {
            if (removeData.size <= padding) {
                callback();
            } else {
                callback(new Error('still need ' + (removeData.size - padding)));
            }
        }
    });
};

module.exports = StorageLRU;
},{"async-each-series":3,"setimmediate":4}],6:[function(require,module,exports){
/**
 * 
 * A simple mixin to go around syncronous storage interfaces (such as html5 local storage).
 * 
 * @param {Object} syncObject The syncronous storage object.
 */
function asyncify (syncObject) {
    var retval = {
        getItem: function (key, callback) {
            callback(null, syncObject.getItem(key));
        },
        setItem: function (key, value, callback) {
            try {
                syncObject.setItem(key, value);
            } catch (e) {
                callback(e);
                return;
            }
            callback(null, value);
        },
        removeItem: function (key, callback) {
            syncObject.removeItem(key);
            callback();
        }
    };
     // be smart about wrapping local storage
    if (!syncObject.keys && (typeof syncObject.length === 'number')) {
        retval.keys = function getKeylistFromIndices (num, callback) {
            var arr = [];
            var limit = (num > syncObject.length) ? syncObject.length : num;
            for (var i = 0, len = limit; i < len; i++) {
                arr.push(syncObject.key(i));
            }
            callback(null, arr);
        };
    }
    return retval;
}

module.exports = asyncify;
},{}],7:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Emitter = require('emitter');
var reduce = require('reduce');

/**
 * Root reference for iframes.
 */

var root;
if (typeof window !== 'undefined') { // Browser window
  root = window;
} else if (typeof self !== 'undefined') { // Web Worker
  root = self;
} else { // Other environments
  root = this;
}

/**
 * Noop.
 */

function noop(){};

/**
 * Check if `obj` is a host object,
 * we don't want to serialize these :)
 *
 * TODO: future proof, move to compoent land
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isHost(obj) {
  var str = {}.toString.call(obj);

  switch (str) {
    case '[object File]':
    case '[object Blob]':
    case '[object FormData]':
      return true;
    default:
      return false;
  }
}

/**
 * Determine XHR.
 */

request.getXHR = function () {
  if (root.XMLHttpRequest
      && (!root.location || 'file:' != root.location.protocol
          || !root.ActiveXObject)) {
    return new XMLHttpRequest;
  } else {
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
  }
  return false;
};

/**
 * Removes leading and trailing whitespace, added to support IE.
 *
 * @param {String} s
 * @return {String}
 * @api private
 */

var trim = ''.trim
  ? function(s) { return s.trim(); }
  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
  return obj === Object(obj);
}

/**
 * Serialize the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function serialize(obj) {
  if (!isObject(obj)) return obj;
  var pairs = [];
  for (var key in obj) {
    if (null != obj[key]) {
      pairs.push(encodeURIComponent(key)
        + '=' + encodeURIComponent(obj[key]));
    }
  }
  return pairs.join('&');
}

/**
 * Expose serialization method.
 */

 request.serializeObject = serialize;

 /**
  * Parse the given x-www-form-urlencoded `str`.
  *
  * @param {String} str
  * @return {Object}
  * @api private
  */

function parseString(str) {
  var obj = {};
  var pairs = str.split('&');
  var parts;
  var pair;

  for (var i = 0, len = pairs.length; i < len; ++i) {
    pair = pairs[i];
    parts = pair.split('=');
    obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
  }

  return obj;
}

/**
 * Expose parser.
 */

request.parseString = parseString;

/**
 * Default MIME type map.
 *
 *     superagent.types.xml = 'application/xml';
 *
 */

request.types = {
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  urlencoded: 'application/x-www-form-urlencoded',
  'form': 'application/x-www-form-urlencoded',
  'form-data': 'application/x-www-form-urlencoded'
};

/**
 * Default serialization map.
 *
 *     superagent.serialize['application/xml'] = function(obj){
 *       return 'generated xml here';
 *     };
 *
 */

 request.serialize = {
   'application/x-www-form-urlencoded': serialize,
   'application/json': JSON.stringify
 };

 /**
  * Default parsers.
  *
  *     superagent.parse['application/xml'] = function(str){
  *       return { object parsed from str };
  *     };
  *
  */

request.parse = {
  'application/x-www-form-urlencoded': parseString,
  'application/json': JSON.parse
};

/**
 * Parse the given header `str` into
 * an object containing the mapped fields.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseHeader(str) {
  var lines = str.split(/\r?\n/);
  var fields = {};
  var index;
  var line;
  var field;
  var val;

  lines.pop(); // trailing CRLF

  for (var i = 0, len = lines.length; i < len; ++i) {
    line = lines[i];
    index = line.indexOf(':');
    field = line.slice(0, index).toLowerCase();
    val = trim(line.slice(index + 1));
    fields[field] = val;
  }

  return fields;
}

/**
 * Return the mime type for the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function type(str){
  return str.split(/ *; */).shift();
};

/**
 * Return header field parameters.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function params(str){
  return reduce(str.split(/ *; */), function(obj, str){
    var parts = str.split(/ *= */)
      , key = parts.shift()
      , val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
};

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * Examples:
 *
 *  Aliasing `superagent` as `request` is nice:
 *
 *      request = superagent;
 *
 *  We can use the promise-like API, or pass callbacks:
 *
 *      request.get('/').end(function(res){});
 *      request.get('/', function(res){});
 *
 *  Sending data can be chained:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' })
 *        .end(function(res){});
 *
 *  Or passed to `.send()`:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' }, function(res){});
 *
 *  Or passed to `.post()`:
 *
 *      request
 *        .post('/user', { name: 'tj' })
 *        .end(function(res){});
 *
 * Or further reduced to a single call for simple cases:
 *
 *      request
 *        .post('/user', { name: 'tj' }, function(res){});
 *
 * @param {XMLHTTPRequest} xhr
 * @param {Object} options
 * @api private
 */

function Response(req, options) {
  options = options || {};
  this.req = req;
  this.xhr = this.req.xhr;
  // responseText is accessible only if responseType is '' or 'text' and on older browsers
  this.text = ((this.req.method !='HEAD' && (this.xhr.responseType === '' || this.xhr.responseType === 'text')) || typeof this.xhr.responseType === 'undefined')
     ? this.xhr.responseText
     : null;
  this.statusText = this.req.xhr.statusText;
  this.setStatusProperties(this.xhr.status);
  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
  // getResponseHeader still works. so we get content-type even if getting
  // other headers fails.
  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
  this.setHeaderProperties(this.header);
  this.body = this.req.method != 'HEAD'
    ? this.parseBody(this.text ? this.text : this.xhr.response)
    : null;
}

/**
 * Get case-insensitive `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Response.prototype.get = function(field){
  return this.header[field.toLowerCase()];
};

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype.setHeaderProperties = function(header){
  // content-type
  var ct = this.header['content-type'] || '';
  this.type = type(ct);

  // params
  var obj = params(ct);
  for (var key in obj) this[key] = obj[key];
};

/**
 * Force given parser
 * 
 * Sets the body parser no matter type.
 * 
 * @param {Function}
 * @api public
 */

Response.prototype.parse = function(fn){
  this.parser = fn;
  return this;
};

/**
 * Parse the given body `str`.
 *
 * Used for auto-parsing of bodies. Parsers
 * are defined on the `superagent.parse` object.
 *
 * @param {String} str
 * @return {Mixed}
 * @api private
 */

Response.prototype.parseBody = function(str){
  var parse = this.parser || request.parse[this.type];
  return parse && str && (str.length || str instanceof Object)
    ? parse(str)
    : null;
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype.setStatusProperties = function(status){
  // handle IE9 bug: http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
  if (status === 1223) {
    status = 204;
  }

  var type = status / 100 | 0;

  // status / class
  this.status = this.statusCode = status;
  this.statusType = type;

  // basics
  this.info = 1 == type;
  this.ok = 2 == type;
  this.clientError = 4 == type;
  this.serverError = 5 == type;
  this.error = (4 == type || 5 == type)
    ? this.toError()
    : false;

  // sugar
  this.accepted = 202 == status;
  this.noContent = 204 == status;
  this.badRequest = 400 == status;
  this.unauthorized = 401 == status;
  this.notAcceptable = 406 == status;
  this.notFound = 404 == status;
  this.forbidden = 403 == status;
};

/**
 * Return an `Error` representative of this response.
 *
 * @return {Error}
 * @api public
 */

Response.prototype.toError = function(){
  var req = this.req;
  var method = req.method;
  var url = req.url;

  var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
  var err = new Error(msg);
  err.status = this.status;
  err.method = method;
  err.url = url;

  return err;
};

/**
 * Expose `Response`.
 */

request.Response = Response;

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String} url
 * @api public
 */

function Request(method, url) {
  var self = this;
  Emitter.call(this);
  this._query = this._query || [];
  this.method = method;
  this.url = url;
  this.header = {};
  this._header = {};
  this.on('end', function(){
    var err = null;
    var res = null;

    try {
      res = new Response(self);
    } catch(e) {
      err = new Error('Parser is unable to parse the response');
      err.parse = true;
      err.original = e;
      return self.callback(err);
    }

    self.emit('response', res);

    if (err) {
      return self.callback(err, res);
    }

    if (res.status >= 200 && res.status < 300) {
      return self.callback(err, res);
    }

    var new_err = new Error(res.statusText || 'Unsuccessful HTTP response');
    new_err.original = err;
    new_err.response = res;
    new_err.status = res.status;

    self.callback(new_err, res);
  });
}

/**
 * Mixin `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Allow for extension
 */

Request.prototype.use = function(fn) {
  fn(this);
  return this;
}

/**
 * Set timeout to `ms`.
 *
 * @param {Number} ms
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.timeout = function(ms){
  this._timeout = ms;
  return this;
};

/**
 * Clear previous timeout.
 *
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.clearTimeout = function(){
  this._timeout = 0;
  clearTimeout(this._timer);
  return this;
};

/**
 * Abort the request, and clear potential timeout.
 *
 * @return {Request}
 * @api public
 */

Request.prototype.abort = function(){
  if (this.aborted) return;
  this.aborted = true;
  this.xhr.abort();
  this.clearTimeout();
  this.emit('abort');
  return this;
};

/**
 * Set header `field` to `val`, or multiple fields with one object.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.set = function(field, val){
  if (isObject(field)) {
    for (var key in field) {
      this.set(key, field[key]);
    }
    return this;
  }
  this._header[field.toLowerCase()] = val;
  this.header[field] = val;
  return this;
};

/**
 * Remove header `field`.
 *
 * Example:
 *
 *      req.get('/')
 *        .unset('User-Agent')
 *        .end(callback);
 *
 * @param {String} field
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.unset = function(field){
  delete this._header[field.toLowerCase()];
  delete this.header[field];
  return this;
};

/**
 * Get case-insensitive header `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api private
 */

Request.prototype.getHeader = function(field){
  return this._header[field.toLowerCase()];
};

/**
 * Set Content-Type to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.xml = 'application/xml';
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
  this.set('Content-Type', request.types[type] || type);
  return this;
};

/**
 * Set Accept to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.json = 'application/json';
 *
 *      request.get('/agent')
 *        .accept('json')
 *        .end(callback);
 *
 *      request.get('/agent')
 *        .accept('application/json')
 *        .end(callback);
 *
 * @param {String} accept
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.accept = function(type){
  this.set('Accept', request.types[type] || type);
  return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass){
  var str = btoa(user + ':' + pass);
  this.set('Authorization', 'Basic ' + str);
  return this;
};

/**
* Add query-string `val`.
*
* Examples:
*
*   request.get('/shoes')
*     .query('size=10')
*     .query({ color: 'blue' })
*
* @param {Object|String} val
* @return {Request} for chaining
* @api public
*/

Request.prototype.query = function(val){
  if ('string' != typeof val) val = serialize(val);
  if (val) this._query.push(val);
  return this;
};

/**
 * Write the field `name` and `val` for "multipart/form-data"
 * request bodies.
 *
 * ``` js
 * request.post('/upload')
 *   .field('foo', 'bar')
 *   .end(callback);
 * ```
 *
 * @param {String} name
 * @param {String|Blob|File} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.field = function(name, val){
  if (!this._formData) this._formData = new root.FormData();
  this._formData.append(name, val);
  return this;
};

/**
 * Queue the given `file` as an attachment to the specified `field`,
 * with optional `filename`.
 *
 * ``` js
 * request.post('/upload')
 *   .attach(new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
 *   .end(callback);
 * ```
 *
 * @param {String} field
 * @param {Blob|File} file
 * @param {String} filename
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.attach = function(field, file, filename){
  if (!this._formData) this._formData = new root.FormData();
  this._formData.append(field, file, filename);
  return this;
};

/**
 * Send `data`, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // querystring
 *       request.get('/search')
 *         .end(callback)
 *
 *       // multiple data "writes"
 *       request.get('/search')
 *         .send({ search: 'query' })
 *         .send({ range: '1..5' })
 *         .send({ order: 'desc' })
 *         .end(callback)
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"})
 *         .end(callback)
 *
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // defaults to x-www-form-urlencoded
  *      request.post('/user')
  *        .send('name=tobi')
  *        .send('species=ferret')
  *        .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.send = function(data){
  var obj = isObject(data);
  var type = this.getHeader('Content-Type');

  // merge
  if (obj && isObject(this._data)) {
    for (var key in data) {
      this._data[key] = data[key];
    }
  } else if ('string' == typeof data) {
    if (!type) this.type('form');
    type = this.getHeader('Content-Type');
    if ('application/x-www-form-urlencoded' == type) {
      this._data = this._data
        ? this._data + '&' + data
        : data;
    } else {
      this._data = (this._data || '') + data;
    }
  } else {
    this._data = data;
  }

  if (!obj || isHost(data)) return this;
  if (!type) this.type('json');
  return this;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
  var fn = this._callback;
  this.clearTimeout();
  fn(err, res);
};

/**
 * Invoke callback with x-domain error.
 *
 * @api private
 */

Request.prototype.crossDomainError = function(){
  var err = new Error('Origin is not allowed by Access-Control-Allow-Origin');
  err.crossDomain = true;
  this.callback(err);
};

/**
 * Invoke callback with timeout error.
 *
 * @api private
 */

Request.prototype.timeoutError = function(){
  var timeout = this._timeout;
  var err = new Error('timeout of ' + timeout + 'ms exceeded');
  err.timeout = timeout;
  this.callback(err);
};

/**
 * Enable transmission of cookies with x-domain requests.
 *
 * Note that for this to work the origin must not be
 * using "Access-Control-Allow-Origin" with a wildcard,
 * and also must set "Access-Control-Allow-Credentials"
 * to "true".
 *
 * @api public
 */

Request.prototype.withCredentials = function(){
  this._withCredentials = true;
  return this;
};

/**
 * Initiate request, invoking callback `fn(res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
  var self = this;
  var xhr = this.xhr = request.getXHR();
  var query = this._query.join('&');
  var timeout = this._timeout;
  var data = this._formData || this._data;

  // store callback
  this._callback = fn || noop;

  // state change
  xhr.onreadystatechange = function(){
    if (4 != xhr.readyState) return;

    // In IE9, reads to any property (e.g. status) off of an aborted XHR will
    // result in the error "Could not complete the operation due to error c00c023f"
    var status;
    try { status = xhr.status } catch(e) { status = 0; }

    if (0 == status) {
      if (self.timedout) return self.timeoutError();
      if (self.aborted) return;
      return self.crossDomainError();
    }
    self.emit('end');
  };

  // progress
  var handleProgress = function(e){
    if (e.total > 0) {
      e.percent = e.loaded / e.total * 100;
    }
    self.emit('progress', e);
  };
  if (this.hasListeners('progress')) {
    xhr.onprogress = handleProgress;
  }
  try {
    if (xhr.upload && this.hasListeners('progress')) {
      xhr.upload.onprogress = handleProgress;
    }
  } catch(e) {
    // Accessing xhr.upload fails in IE from a web worker, so just pretend it doesn't exist.
    // Reported here:
    // https://connect.microsoft.com/IE/feedback/details/837245/xmlhttprequest-upload-throws-invalid-argument-when-used-from-web-worker-context
  }

  // timeout
  if (timeout && !this._timer) {
    this._timer = setTimeout(function(){
      self.timedout = true;
      self.abort();
    }, timeout);
  }

  // querystring
  if (query) {
    query = request.serializeObject(query);
    this.url += ~this.url.indexOf('?')
      ? '&' + query
      : '?' + query;
  }

  // initiate request
  xhr.open(this.method, this.url, true);

  // CORS
  if (this._withCredentials) xhr.withCredentials = true;

  // body
  if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
    // serialize stuff
    var contentType = this.getHeader('Content-Type');
    var serialize = request.serialize[contentType ? contentType.split(';')[0] : ''];
    if (serialize) data = serialize(data);
  }

  // set header fields
  for (var field in this.header) {
    if (null == this.header[field]) continue;
    xhr.setRequestHeader(field, this.header[field]);
  }

  // send stuff
  this.emit('request', this);
  xhr.send(data);
  return this;
};

/**
 * Faux promise support
 *
 * @param {Function} fulfill
 * @param {Function} reject
 * @return {Request}
 */

Request.prototype.then = function (fulfill, reject) {
  return this.end(function(err, res) {
    err ? reject(err) : fulfill(res);
  });
}

/**
 * Expose `Request`.
 */

request.Request = Request;

/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(method, url) {
  // callback
  if ('function' == typeof url) {
    return new Request('GET', method).end(url);
  }

  // url first
  if (1 == arguments.length) {
    return new Request('GET', method);
  }

  return new Request(method, url);
}

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.get = function(url, data, fn){
  var req = request('GET', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.query(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * HEAD `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.head = function(url, data, fn){
  var req = request('HEAD', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * DELETE `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.del = function(url, fn){
  var req = request('DELETE', url);
  if (fn) req.end(fn);
  return req;
};

/**
 * PATCH `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.patch = function(url, data, fn){
  var req = request('PATCH', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * POST `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.post = function(url, data, fn){
  var req = request('POST', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * PUT `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.put = function(url, data, fn){
  var req = request('PUT', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * Expose `request`.
 */

module.exports = request;

},{"emitter":8,"reduce":9}],8:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],9:[function(require,module,exports){

/**
 * Reduce `arr` with `fn`.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @param {Mixed} initial
 *
 * TODO: combatible error handling?
 */

module.exports = function(arr, fn, initial){  
  var idx = 0;
  var len = arr.length;
  var curr = arguments.length == 3
    ? initial
    : arr[idx++];

  while (idx < len) {
    curr = fn.call(null, curr, arr[idx], ++idx, arr);
  }
  
  return curr;
};
},{}],10:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);

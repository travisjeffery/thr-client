var request = require('superagent');
var LRU = require('storage-lru').StorageLRU;
var asyncify = require('storage-lru').asyncify;
var cache = new LRU(asyncify(localStorage));

/**
 * Initialize.
 */

function THR() {
  if (!(this instanceof THR)) return new THR();
  this._addr = 'https://znbtd4y5ii.execute-api.us-east-1.amazonaws.com/prod/';
  this._size = 10;
  this._user = null;
  this._sel = null;
};

/**
 * Username of the user whose rotation you want to fetch.
 */

THR.prototype.user = function(user) {
  this._user = user;
  return this;
}

/**
 * Selector to append the images to.
 */

THR.prototype.sel = function(sel) {
  this._sel = sel;
  return this;
}

/**
 * Number of images to show.
 */

THR.prototype.size = function(n) {
  this._size = n;
  return this;
}

/**
 * Fetch and set the images.
 */

THR.prototype.fetch = function(cb) {
  if (!cb) cb = function(){};
  var self = this;

  cache.getItem(key(self._user), { json: true }, function (err, imgs) {
    if (imgs) {
      self.setImgs(imgs);
      return cb(imgs);
    }

    request
      .post(self._addr)
      .send({ username: self._user })
      .end(function(err, res) {
        if (err) return cb(err);
        cache.setItem(key(self._user), res.body, {
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
  var node = document.querySelector(this._sel);
  imgs = imgs.slice(0, this._size)
  imgs.forEach(function (e) {
    var img = document.createElement('img');
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

module.exports = window.THR = THR;

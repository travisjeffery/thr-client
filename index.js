var request = require('superagent');

/**
 * Initialize.
 */

function THR() {
  if (!(this instanceof THR)) return new THR();
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
  var self = this;
  request
    .get('http://localhost:3000/' + self.user)
    .end(function(err, res) {
      if (err) return cb(err);
      var node = document.querySelector(self.sel);
      res.body.forEach(function (e) {
        var img = document.createElement("img");
        img.src = e.icon;
        node.appendChild(img);
      });
    });
}

window.THR = THR;

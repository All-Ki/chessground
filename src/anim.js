var forIn = require('lodash-node/modern/objects/forIn');
var clone = require('lodash-node/modern/objects/clone');
var partial = require('lodash-node/modern/functions/partial');
var m = require('mithril');
var util = require('./util');

function makePiece(k, piece, invert) {
  var key = invert ? util.invertKey(k) : k;
  return {
    key: key,
    pos: util.key2pos(key),
    role: piece.role,
    color: piece.color
  };
}

function samePiece(p1, p2) {
  return p1.role === p2.role && p1.color === p2.color;
}

function closer(piece, pieces) {
  return pieces.sort(function(p1, p2) {
    return util.distance(piece.pos, p1.pos) - util.distance(piece.pos, p2.pos);
  })[0];
}

function compute(prev, current) {
  var size = current.bounds().width / 8,
    anims = {},
    missings = [],
    news = [],
    invert = prev.orientation !== current.orientation,
    prePieces = {};
  util.allKeys.forEach(function(k) {
    if (prev.pieces[k]) {
      var piece = makePiece(k, prev.pieces[k], invert);
      prePieces[piece.key] = piece;
    }
  });
  util.allKeys.forEach(function(k) {
    if (k !== current.movable.dropped) {
      var curP = current.pieces[k];
      var preP = prePieces[k];
      if (curP) {
        if (preP) {
          if (!samePiece(curP, preP)) {
            missings.push(preP);
            news.push(makePiece(k, curP, false));
          }
        } else
          news.push(makePiece(k, curP, false));
      } else if (preP)
        missings.push(preP);
    }
  });
  news.forEach(function(newP) {
    var preP = closer(newP, missings.filter(partial(samePiece, newP)));
    if (preP) {
      var orig = current.orientation === 'white' ? preP.pos : newP.pos;
      var dest = current.orientation === 'white' ? newP.pos : preP.pos;
      var vector = [(orig[0] - dest[0]) * size, (dest[1] - orig[1]) * size];
      anims[newP.key] = [vector, vector];
    }
  });
  return anims;
}

function go(data) {
  if (!data.animation.current.start) return; // animation was canceled
  var rest = 1 - (new Date().getTime() - data.animation.current.start) / data.animation.current.duration;
  try {
    if (rest <= 0) {
      data.animation.current = {};
      data.render();
    } else {
      forIn(data.animation.current.anims, function(cfg, key) {
        data.animation.current.anims[key][1] = [cfg[0][0] * rest, cfg[0][1] * rest];
      });
      data.render();
      requestAnimationFrame(partial(go, data));
    }
  } catch (e) {
    // breaks if the DOM node was removed. Who cares.
    data.animation.current = {};
    data.render();
    console.log(e);
  }
}

function animate(transformation, data) {
  var prev = {
    orientation: data.orientation,
    pieces: clone(data.pieces, true)
  };
  var result = transformation();
  var anims = compute(prev, data);
  if (Object.getOwnPropertyNames(anims).length > 0) {
    var alreadyRunning = data.animation.current.start;
    data.animation.current = {
      start: new Date().getTime(),
      duration: data.animation.duration,
      anims: anims
    };
    if (!alreadyRunning) go(data);
  }
  return result;
}

// transformation is a function
// accepts board data and any number of arguments,
// and mutates the board.
module.exports = function(transformation, data) {
  return function() {
    var transformationArgs = [data].concat(Array.prototype.slice.call(arguments, 0));
    if (data.animation.enabled && data.animation.duration >= 10 && data.render)
      return animate(util.partialApply(transformation, transformationArgs), data);
    else
      return transformation.apply(null, transformationArgs);
  };
};
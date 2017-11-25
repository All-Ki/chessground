(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Chessground = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
function anim(mutation, state) {
    return state.animation.enabled ? animate(mutation, state) : render(mutation, state);
}
exports.anim = anim;
function render(mutation, state) {
    const result = mutation(state);
    state.dom.redraw();
    return result;
}
exports.render = render;
function makePiece(key, piece) {
    return {
        key: key,
        pos: util.key2pos(key),
        piece: piece
    };
}
function closer(piece, pieces) {
    return pieces.sort((p1, p2) => {
        return util.distanceSq(piece.pos, p1.pos) - util.distanceSq(piece.pos, p2.pos);
    })[0];
}
function computePlan(prevPieces, current) {
    const anims = {}, animedOrigs = [], fadings = {}, missings = [], news = [], prePieces = {};
    let curP, preP, i, vector;
    for (i in prevPieces) {
        prePieces[i] = makePiece(i, prevPieces[i]);
    }
    for (const key of util.allKeys) {
        curP = current.pieces[key];
        preP = prePieces[key];
        if (curP) {
            if (preP) {
                if (!util.samePiece(curP, preP.piece)) {
                    missings.push(preP);
                    news.push(makePiece(key, curP));
                }
            }
            else
                news.push(makePiece(key, curP));
        }
        else if (preP)
            missings.push(preP);
    }
    news.forEach(newP => {
        preP = closer(newP, missings.filter(p => util.samePiece(newP.piece, p.piece)));
        if (preP) {
            vector = [preP.pos[0] - newP.pos[0], preP.pos[1] - newP.pos[1]];
            anims[newP.key] = [vector, vector];
            animedOrigs.push(preP.key);
        }
    });
    missings.forEach(p => {
        if (!util.containsX(animedOrigs, p.key) &&
            !(current.items ? current.items(p.pos, p.key) : false))
            fadings[p.key] = p.piece;
    });
    return {
        anims: anims,
        fadings: fadings
    };
}
function step(state) {
    const cur = state.animation.current;
    if (!cur) {
        if (!state.dom.destroyed)
            state.dom.redrawNow();
        return;
    }
    const rest = 1 - (Date.now() - cur.start) / cur.duration;
    if (rest <= 0) {
        state.animation.current = undefined;
        state.dom.redrawNow();
    }
    else {
        const ease = easing(rest);
        for (let i in cur.plan.anims) {
            const cfg = cur.plan.anims[i];
            cfg[1] = [cfg[0][0] * ease, cfg[0][1] * ease];
        }
        state.dom.redrawNow(true);
        util.raf(() => step(state));
    }
}
function animate(mutation, state) {
    const prevPieces = Object.assign({}, state.pieces);
    const result = mutation(state);
    const plan = computePlan(prevPieces, state);
    if (!isObjectEmpty(plan.anims) || !isObjectEmpty(plan.fadings)) {
        const alreadyRunning = state.animation.current && state.animation.current.start;
        state.animation.current = {
            start: Date.now(),
            duration: state.animation.duration,
            plan: plan
        };
        if (!alreadyRunning)
            step(state);
    }
    else {
        state.dom.redraw();
    }
    return result;
}
function isObjectEmpty(o) {
    for (let _ in o)
        return false;
    return true;
}
function easing(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}
},{"./util":17}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board = require("./board");
const fen_1 = require("./fen");
const config_1 = require("./config");
const anim_1 = require("./anim");
const drag_1 = require("./drag");
const explosion_1 = require("./explosion");
function start(state, redrawAll) {
    function toggleOrientation() {
        board.toggleOrientation(state);
        redrawAll();
    }
    ;
    return {
        set(config) {
            if (config.orientation && config.orientation !== state.orientation)
                toggleOrientation();
            (config.fen ? anim_1.anim : anim_1.render)(state => config_1.configure(state, config), state);
        },
        state,
        getFen: () => fen_1.write(state.pieces),
        toggleOrientation,
        setPieces(pieces) {
            anim_1.anim(state => board.setPieces(state, pieces), state);
        },
        selectSquare(key, force) {
            if (key)
                anim_1.anim(state => board.selectSquare(state, key, force), state);
            else if (state.selected) {
                board.unselect(state);
                state.dom.redraw();
            }
        },
        move(orig, dest) {
            anim_1.anim(state => board.baseMove(state, orig, dest), state);
        },
        newPiece(piece, key) {
            anim_1.anim(state => board.baseNewPiece(state, piece, key), state);
        },
        playPremove() {
            if (state.premovable.current) {
                if (anim_1.anim(board.playPremove, state))
                    return true;
                state.dom.redraw();
            }
            return false;
        },
        playPredrop(validate) {
            if (state.predroppable.current) {
                const result = board.playPredrop(state, validate);
                state.dom.redraw();
                return result;
            }
            return false;
        },
        cancelPremove() {
            anim_1.render(board.unsetPremove, state);
        },
        cancelPredrop() {
            anim_1.render(board.unsetPredrop, state);
        },
        cancelMove() {
            anim_1.render(state => { board.cancelMove(state); drag_1.cancel(state); }, state);
        },
        stop() {
            anim_1.render(state => { board.stop(state); drag_1.cancel(state); }, state);
        },
        explode(keys) {
            explosion_1.default(state, keys);
        },
        setAutoShapes(shapes) {
            anim_1.render(state => state.drawable.autoShapes = shapes, state);
        },
        setShapes(shapes) {
            anim_1.render(state => state.drawable.shapes = shapes, state);
        },
        getKeyAtDomPos(pos) {
            return board.getKeyAtDomPos(pos, state.orientation === 'white', state.dom.bounds());
        },
        redrawAll,
        dragNewPiece(piece, event, force) {
            drag_1.dragNewPiece(state, piece, event, force);
        },
        destroy() {
            board.stop(state);
            state.dom.unbind && state.dom.unbind();
            state.dom.destroyed = true;
        }
    };
}
exports.start = start;
},{"./anim":1,"./board":3,"./config":5,"./drag":6,"./explosion":9,"./fen":10}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const premove_1 = require("./premove");
function callUserFunction(f, ...args) {
    if (f)
        setTimeout(() => f(...args), 1);
}
exports.callUserFunction = callUserFunction;
function toggleOrientation(state) {
    state.orientation = util_1.opposite(state.orientation);
    state.animation.current =
        state.draggable.current =
            state.selected = undefined;
}
exports.toggleOrientation = toggleOrientation;
function reset(state) {
    state.lastMove = undefined;
    unselect(state);
    unsetPremove(state);
    unsetPredrop(state);
}
exports.reset = reset;
function setPieces(state, pieces) {
    for (let key in pieces) {
        const piece = pieces[key];
        if (piece)
            state.pieces[key] = piece;
        else
            delete state.pieces[key];
    }
}
exports.setPieces = setPieces;
function setCheck(state, color) {
    if (color === true)
        color = state.turnColor;
    if (!color)
        state.check = undefined;
    else
        for (let k in state.pieces) {
            if (state.pieces[k].role === 'king' && state.pieces[k].color === color) {
                state.check = k;
            }
        }
}
exports.setCheck = setCheck;
function setPremove(state, orig, dest, meta) {
    unsetPredrop(state);
    state.premovable.current = [orig, dest];
    callUserFunction(state.premovable.events.set, orig, dest, meta);
}
function unsetPremove(state) {
    if (state.premovable.current) {
        state.premovable.current = undefined;
        callUserFunction(state.premovable.events.unset);
    }
}
exports.unsetPremove = unsetPremove;
function setPredrop(state, role, key) {
    unsetPremove(state);
    state.predroppable.current = {
        role: role,
        key: key
    };
    callUserFunction(state.predroppable.events.set, role, key);
}
function unsetPredrop(state) {
    const pd = state.predroppable;
    if (pd.current) {
        pd.current = undefined;
        callUserFunction(pd.events.unset);
    }
}
exports.unsetPredrop = unsetPredrop;
function tryAutoCastle(state, orig, dest) {
    if (!state.autoCastle)
        return false;
    const king = state.pieces[orig];
    if (king.role !== 'king')
        return false;
    const origPos = util_1.key2pos(orig);
    if (origPos[0] !== 5)
        return false;
    if (origPos[1] !== 1 && origPos[1] !== 8)
        return false;
    const destPos = util_1.key2pos(dest);
    let oldRookPos, newRookPos, newKingPos;
    if (destPos[0] === 7 || destPos[0] === 8) {
        oldRookPos = util_1.pos2key([8, origPos[1]]);
        newRookPos = util_1.pos2key([6, origPos[1]]);
        newKingPos = util_1.pos2key([7, origPos[1]]);
    }
    else if (destPos[0] === 3 || destPos[0] === 1) {
        oldRookPos = util_1.pos2key([1, origPos[1]]);
        newRookPos = util_1.pos2key([4, origPos[1]]);
        newKingPos = util_1.pos2key([3, origPos[1]]);
    }
    else
        return false;
    const rook = state.pieces[oldRookPos];
    if (rook.role !== 'rook')
        return false;
    delete state.pieces[orig];
    delete state.pieces[oldRookPos];
    state.pieces[newKingPos] = king;
    state.pieces[newRookPos] = rook;
    return true;
}
function baseMove(state, orig, dest) {
    if (orig === dest || !state.pieces[orig])
        return false;
    const captured = (state.pieces[dest] &&
        state.pieces[dest].color !== state.pieces[orig].color) ? state.pieces[dest] : undefined;
    if (dest == state.selected)
        unselect(state);
    callUserFunction(state.events.move, orig, dest, captured);
    if (!tryAutoCastle(state, orig, dest)) {
        state.pieces[dest] = state.pieces[orig];
        delete state.pieces[orig];
    }
    state.lastMove = [orig, dest];
    state.check = undefined;
    callUserFunction(state.events.change);
    return captured || true;
}
exports.baseMove = baseMove;
function baseNewPiece(state, piece, key, force) {
    if (state.pieces[key]) {
        if (force)
            delete state.pieces[key];
        else
            return false;
    }
    callUserFunction(state.events.dropNewPiece, piece, key);
    state.pieces[key] = piece;
    state.lastMove = [key];
    state.check = undefined;
    callUserFunction(state.events.change);
    state.movable.dests = undefined;
    state.turnColor = util_1.opposite(state.turnColor);
    return true;
}
exports.baseNewPiece = baseNewPiece;
function baseUserMove(state, orig, dest) {
    const result = baseMove(state, orig, dest);
    if (result) {
        state.movable.dests = undefined;
        state.turnColor = util_1.opposite(state.turnColor);
        state.animation.current = undefined;
    }
    return result;
}
function userMove(state, orig, dest) {
    if (canMove(state, orig, dest)) {
        const result = baseUserMove(state, orig, dest);
        if (result) {
            const holdTime = state.hold.stop();
            unselect(state);
            const metadata = {
                premove: false,
                ctrlKey: state.stats.ctrlKey,
                holdTime: holdTime
            };
            if (result !== true)
                metadata.captured = result;
            callUserFunction(state.movable.events.after, orig, dest, metadata);
            return true;
        }
    }
    else if (canPremove(state, orig, dest)) {
        setPremove(state, orig, dest, {
            ctrlKey: state.stats.ctrlKey
        });
        unselect(state);
    }
    else if (isMovable(state, dest) || isPremovable(state, dest)) {
        setSelected(state, dest);
        state.hold.start();
    }
    else
        unselect(state);
    return false;
}
exports.userMove = userMove;
function dropNewPiece(state, orig, dest, force) {
    if (canDrop(state, orig, dest) || force) {
        const piece = state.pieces[orig];
        delete state.pieces[orig];
        baseNewPiece(state, piece, dest, force);
        callUserFunction(state.movable.events.afterNewPiece, piece.role, dest, {
            predrop: false
        });
    }
    else if (canPredrop(state, orig, dest)) {
        setPredrop(state, state.pieces[orig].role, dest);
    }
    else {
        unsetPremove(state);
        unsetPredrop(state);
    }
    delete state.pieces[orig];
    unselect(state);
}
exports.dropNewPiece = dropNewPiece;
function selectSquare(state, key, force) {
    if (state.selected) {
        if (state.selected === key && !state.draggable.enabled) {
            unselect(state);
            state.hold.cancel();
        }
        else if ((state.selectable.enabled || force) && state.selected !== key) {
            if (userMove(state, state.selected, key))
                state.stats.dragged = false;
        }
        else
            state.hold.start();
    }
    else if (isMovable(state, key) || isPremovable(state, key)) {
        setSelected(state, key);
        state.hold.start();
    }
    callUserFunction(state.events.select, key);
}
exports.selectSquare = selectSquare;
function setSelected(state, key) {
    state.selected = key;
    if (isPremovable(state, key)) {
        state.premovable.dests = premove_1.default(state.pieces, key, state.premovable.castle);
    }
    else
        state.premovable.dests = undefined;
}
exports.setSelected = setSelected;
function unselect(state) {
    state.selected = undefined;
    state.premovable.dests = undefined;
    state.hold.cancel();
}
exports.unselect = unselect;
function isMovable(state, orig) {
    const piece = state.pieces[orig];
    return piece && (state.movable.color === 'both' || (state.movable.color === piece.color &&
        state.turnColor === piece.color));
}
function canMove(state, orig, dest) {
    return orig !== dest && isMovable(state, orig) && (state.movable.free || (!!state.movable.dests && util_1.containsX(state.movable.dests[orig], dest)));
}
exports.canMove = canMove;
function canDrop(state, orig, dest) {
    const piece = state.pieces[orig];
    return piece && dest && (orig === dest || !state.pieces[dest]) && (state.movable.color === 'both' || (state.movable.color === piece.color &&
        state.turnColor === piece.color));
}
function isPremovable(state, orig) {
    const piece = state.pieces[orig];
    return piece && state.premovable.enabled &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color;
}
function canPremove(state, orig, dest) {
    return orig !== dest &&
        isPremovable(state, orig) &&
        util_1.containsX(premove_1.default(state.pieces, orig, state.premovable.castle), dest);
}
function canPredrop(state, orig, dest) {
    const piece = state.pieces[orig];
    return piece && dest &&
        (!state.pieces[dest] || state.pieces[dest].color !== state.movable.color) &&
        state.predroppable.enabled &&
        (piece.role !== 'pawn' || (dest[1] !== '1' && dest[1] !== '8')) &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color;
}
function isDraggable(state, orig) {
    const piece = state.pieces[orig];
    return piece && state.draggable.enabled && (state.movable.color === 'both' || (state.movable.color === piece.color && (state.turnColor === piece.color || state.premovable.enabled)));
}
exports.isDraggable = isDraggable;
function playPremove(state) {
    const move = state.premovable.current;
    if (!move)
        return false;
    const orig = move[0], dest = move[1];
    let success = false;
    if (canMove(state, orig, dest)) {
        const result = baseUserMove(state, orig, dest);
        if (result) {
            const metadata = { premove: true };
            if (result !== true)
                metadata.captured = result;
            callUserFunction(state.movable.events.after, orig, dest, metadata);
            success = true;
        }
    }
    unsetPremove(state);
    return success;
}
exports.playPremove = playPremove;
function playPredrop(state, validate) {
    let drop = state.predroppable.current, success = false;
    if (!drop)
        return false;
    if (validate(drop)) {
        const piece = {
            role: drop.role,
            color: state.movable.color
        };
        if (baseNewPiece(state, piece, drop.key)) {
            callUserFunction(state.movable.events.afterNewPiece, drop.role, drop.key, {
                predrop: true
            });
            success = true;
        }
    }
    unsetPredrop(state);
    return success;
}
exports.playPredrop = playPredrop;
function cancelMove(state) {
    unsetPremove(state);
    unsetPredrop(state);
    unselect(state);
}
exports.cancelMove = cancelMove;
function stop(state) {
    state.movable.color =
        state.movable.dests =
            state.animation.current = undefined;
    cancelMove(state);
}
exports.stop = stop;
function getKeyAtDomPos(pos, asWhite, bounds) {
    let file = Math.ceil(8 * ((pos[0] - bounds.left) / bounds.width));
    if (!asWhite)
        file = 9 - file;
    let rank = Math.ceil(8 - (8 * ((pos[1] - bounds.top) / bounds.height)));
    if (!asWhite)
        rank = 9 - rank;
    return (file > 0 && file < 9 && rank > 0 && rank < 9) ? util_1.pos2key([file, rank]) : undefined;
}
exports.getKeyAtDomPos = getKeyAtDomPos;
},{"./premove":12,"./util":17}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("./api");
const config_1 = require("./config");
const state_1 = require("./state");
const wrap_1 = require("./wrap");
const events = require("./events");
const render_1 = require("./render");
const svg = require("./svg");
const util = require("./util");
function Chessground(element, config) {
    const state = state_1.defaults();
    config_1.configure(state, config || {});
    function redrawAll() {
        let prevUnbind = state.dom && state.dom.unbind;
        element.classList.add('cg-board-wrap');
        const bounds = util.memo(() => element.getBoundingClientRect());
        const relative = state.viewOnly && !state.drawable.visible;
        const elements = wrap_1.default(element, state, relative ? undefined : bounds());
        const redrawNow = (skipSvg) => {
            render_1.default(state);
            if (!skipSvg && elements.svg)
                svg.renderSvg(state, elements.svg);
        };
        state.dom = {
            elements: elements,
            bounds: bounds,
            redraw: debounceRedraw(redrawNow),
            redrawNow: redrawNow,
            unbind: prevUnbind,
            relative
        };
        state.drawable.prevSvgHash = '';
        redrawNow(false);
        events.bindBoard(state);
        if (!prevUnbind)
            state.dom.unbind = events.bindDocument(state, redrawAll);
    }
    redrawAll();
    const api = api_1.start(state, redrawAll);
    return api;
}
exports.Chessground = Chessground;
;
function debounceRedraw(redrawNow) {
    let redrawing = false;
    return () => {
        if (redrawing)
            return;
        redrawing = true;
        util.raf(() => {
            redrawNow();
            redrawing = false;
        });
    };
}
},{"./api":2,"./config":5,"./events":8,"./render":13,"./state":14,"./svg":15,"./util":17,"./wrap":18}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board_1 = require("./board");
const fen_1 = require("./fen");
function configure(state, config) {
    if (config.movable && config.movable.dests)
        state.movable.dests = undefined;
    merge(state, config);
    if (config.fen) {
        state.pieces = fen_1.read(config.fen);
        state.drawable.shapes = [];
    }
    if (config.hasOwnProperty('check'))
        board_1.setCheck(state, config.check || false);
    if (config.hasOwnProperty('lastMove') && !config.lastMove)
        state.lastMove = undefined;
    else if (config.lastMove)
        state.lastMove = config.lastMove;
    if (state.selected)
        board_1.setSelected(state, state.selected);
    if (!state.animation.duration || state.animation.duration < 100)
        state.animation.enabled = false;
    if (!state.movable.rookCastle && state.movable.dests) {
        const rank = state.movable.color === 'white' ? 1 : 8;
        const kingStartPos = 'e' + rank;
        const dests = state.movable.dests[kingStartPos];
        if (!dests || state.pieces[kingStartPos].role !== 'king')
            return;
        state.movable.dests[kingStartPos] = dests.filter(d => !((d === 'a' + rank) && dests.indexOf('c' + rank) !== -1) &&
            !((d === 'h' + rank) && dests.indexOf('g' + rank) !== -1));
    }
}
exports.configure = configure;
;
function merge(base, extend) {
    for (var key in extend) {
        if (isObject(base[key]) && isObject(extend[key]))
            merge(base[key], extend[key]);
        else
            base[key] = extend[key];
    }
}
function isObject(o) {
    return typeof o === 'object';
}
},{"./board":3,"./fen":10}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board = require("./board");
const util = require("./util");
const draw_1 = require("./draw");
const anim_1 = require("./anim");
function start(s, e) {
    if (e.button !== undefined && e.button !== 0)
        return;
    if (e.touches && e.touches.length > 1)
        return;
    e.preventDefault();
    const asWhite = s.orientation === 'white', bounds = s.dom.bounds(), position = util.eventPosition(e), orig = board.getKeyAtDomPos(position, asWhite, bounds);
    if (!orig)
        return;
    const piece = s.pieces[orig];
    const previouslySelected = s.selected;
    if (!previouslySelected && s.drawable.enabled && (s.drawable.eraseOnClick || (!piece || piece.color !== s.turnColor)))
        draw_1.clear(s);
    const hadPremove = !!s.premovable.current;
    const hadPredrop = !!s.predroppable.current;
    s.stats.ctrlKey = e.ctrlKey;
    if (s.selected && board.canMove(s, s.selected, orig)) {
        anim_1.anim(state => board.selectSquare(state, orig), s);
    }
    else {
        board.selectSquare(s, orig);
    }
    const stillSelected = s.selected === orig;
    const element = pieceElementByKey(s, orig);
    if (piece && element && stillSelected && board.isDraggable(s, orig)) {
        const squareBounds = computeSquareBounds(orig, asWhite, bounds);
        s.draggable.current = {
            orig: orig,
            origPos: util.key2pos(orig),
            piece: piece,
            rel: position,
            epos: position,
            pos: [0, 0],
            dec: s.draggable.centerPiece ? [
                position[0] - (squareBounds.left + squareBounds.width / 2),
                position[1] - (squareBounds.top + squareBounds.height / 2)
            ] : [0, 0],
            started: s.draggable.autoDistance && s.stats.dragged,
            element: element,
            previouslySelected: previouslySelected,
            originTarget: e.target
        };
        element.cgDragging = true;
        element.classList.add('dragging');
        const ghost = s.dom.elements.ghost;
        if (ghost) {
            ghost.className = `ghost ${piece.color} ${piece.role}`;
            util.translateAbs(ghost, util.posToTranslateAbs(bounds)(util.key2pos(orig), asWhite));
        }
        processDrag(s);
    }
    else {
        if (hadPremove)
            board.unsetPremove(s);
        if (hadPredrop)
            board.unsetPredrop(s);
    }
    s.dom.redraw();
}
exports.start = start;
function dragNewPiece(s, piece, e, force) {
    const key = 'a0';
    s.pieces[key] = piece;
    s.dom.redraw();
    const position = util.eventPosition(e), asWhite = s.orientation === 'white', bounds = s.dom.bounds(), squareBounds = computeSquareBounds(key, asWhite, bounds);
    const rel = [
        (asWhite ? 0 : 7) * squareBounds.width + bounds.left,
        (asWhite ? 8 : -1) * squareBounds.height + bounds.top
    ];
    s.draggable.current = {
        orig: key,
        origPos: util.key2pos(key),
        piece: piece,
        rel: rel,
        epos: position,
        pos: [position[0] - rel[0], position[1] - rel[1]],
        dec: [-squareBounds.width / 2, -squareBounds.height / 2],
        started: true,
        element: () => pieceElementByKey(s, key),
        originTarget: e.target,
        newPiece: true,
        force: force || false
    };
    processDrag(s);
}
exports.dragNewPiece = dragNewPiece;
function processDrag(s) {
    util.raf(() => {
        const cur = s.draggable.current;
        if (!cur)
            return;
        if (s.animation.current && s.animation.current.plan.anims[cur.orig])
            s.animation.current = undefined;
        const origPiece = s.pieces[cur.orig];
        if (!origPiece || !util.samePiece(origPiece, cur.piece))
            cancel(s);
        else {
            if (!cur.started && util.distanceSq(cur.epos, cur.rel) >= Math.pow(s.draggable.distance, 2))
                cur.started = true;
            if (cur.started) {
                if (typeof cur.element === 'function') {
                    const found = cur.element();
                    if (!found)
                        return;
                    cur.element = found;
                    cur.element.cgDragging = true;
                    cur.element.classList.add('dragging');
                }
                const asWhite = s.orientation === 'white', bounds = s.dom.bounds();
                cur.pos = [
                    cur.epos[0] - cur.rel[0],
                    cur.epos[1] - cur.rel[1]
                ];
                cur.over = board.getKeyAtDomPos(cur.epos, asWhite, bounds);
                const translation = util.posToTranslateAbs(bounds)(cur.origPos, asWhite);
                translation[0] += cur.pos[0] + cur.dec[0];
                translation[1] += cur.pos[1] + cur.dec[1];
                util.translateAbs(cur.element, translation);
                const overEl = s.dom.elements.over;
                if (overEl && cur.over && cur.over !== cur.overPrev) {
                    const dests = s.movable.dests;
                    if (s.movable.free ||
                        util.containsX(dests && dests[cur.orig], cur.over) ||
                        util.containsX(s.premovable.dests, cur.over)) {
                        const pos = util.key2pos(cur.over), vector = [
                            (asWhite ? pos[0] - 1 : 8 - pos[0]) * bounds.width / 8,
                            (asWhite ? 8 - pos[1] : pos[1] - 1) * bounds.height / 8
                        ];
                        util.translateAbs(overEl, vector);
                    }
                    else {
                        util.translateAway(overEl);
                    }
                    cur.overPrev = cur.over;
                }
            }
        }
        processDrag(s);
    });
}
function move(s, e) {
    if (s.draggable.current && (!e.touches || e.touches.length < 2)) {
        s.draggable.current.epos = util.eventPosition(e);
    }
}
exports.move = move;
function end(s, e) {
    const cur = s.draggable.current;
    if (!cur)
        return;
    if (e.type === 'touchend' && cur && cur.originTarget !== e.target && !cur.newPiece) {
        s.draggable.current = undefined;
        return;
    }
    board.unsetPremove(s);
    board.unsetPredrop(s);
    const eventPos = util.eventPosition(e) || cur.epos;
    const dest = board.getKeyAtDomPos(eventPos, s.orientation === 'white', s.dom.bounds());
    if (dest && cur.started) {
        if (cur.newPiece)
            board.dropNewPiece(s, cur.orig, dest, cur.force);
        else {
            s.stats.ctrlKey = e.ctrlKey;
            if (board.userMove(s, cur.orig, dest))
                s.stats.dragged = true;
        }
    }
    else if (cur.newPiece) {
        delete s.pieces[cur.orig];
    }
    else if (s.draggable.deleteOnDropOff) {
        delete s.pieces[cur.orig];
        board.callUserFunction(s.events.change);
    }
    if (cur && cur.orig === cur.previouslySelected && (cur.orig === dest || !dest))
        board.unselect(s);
    else if (!s.selectable.enabled)
        board.unselect(s);
    removeDragElements(s);
    s.draggable.current = undefined;
    s.dom.redraw();
}
exports.end = end;
function cancel(s) {
    const cur = s.draggable.current;
    if (cur) {
        if (cur.newPiece)
            delete s.pieces[cur.orig];
        s.draggable.current = undefined;
        board.unselect(s);
        removeDragElements(s);
        s.dom.redraw();
    }
}
exports.cancel = cancel;
function removeDragElements(s) {
    const e = s.dom.elements;
    if (e.over)
        util.translateAway(e.over);
    if (e.ghost)
        util.translateAway(e.ghost);
}
function computeSquareBounds(key, asWhite, bounds) {
    const pos = util.key2pos(key);
    if (!asWhite) {
        pos[0] = 9 - pos[0];
        pos[1] = 9 - pos[1];
    }
    return {
        left: bounds.left + bounds.width * (pos[0] - 1) / 8,
        top: bounds.top + bounds.height * (8 - pos[1]) / 8,
        width: bounds.width / 8,
        height: bounds.height / 8
    };
}
function pieceElementByKey(s, key) {
    let el = s.dom.elements.board.firstChild;
    while (el) {
        if (el.cgKey === key && el.tagName === 'PIECE')
            return el;
        el = el.nextSibling;
    }
    return undefined;
}
},{"./anim":1,"./board":3,"./draw":7,"./util":17}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board_1 = require("./board");
const util_1 = require("./util");
const brushes = ['green', 'red', 'blue', 'yellow'];
function start(state, e) {
    if (e.touches && e.touches.length > 1)
        return;
    e.stopPropagation();
    e.preventDefault();
    board_1.cancelMove(state);
    const position = util_1.eventPosition(e);
    const orig = board_1.getKeyAtDomPos(position, state.orientation === 'white', state.dom.bounds());
    if (!orig)
        return;
    state.drawable.current = {
        orig: orig,
        dest: orig,
        pos: position,
        brush: eventBrush(e)
    };
    processDraw(state);
}
exports.start = start;
function processDraw(state) {
    util_1.raf(() => {
        const cur = state.drawable.current;
        if (cur) {
            const dest = board_1.getKeyAtDomPos(cur.pos, state.orientation === 'white', state.dom.bounds());
            const newDest = (cur.orig === dest) ? undefined : dest;
            if (newDest !== cur.dest) {
                cur.dest = newDest;
                state.dom.redrawNow();
            }
            processDraw(state);
        }
    });
}
exports.processDraw = processDraw;
function move(state, e) {
    if (state.drawable.current)
        state.drawable.current.pos = util_1.eventPosition(e);
}
exports.move = move;
function end(state) {
    const cur = state.drawable.current;
    if (!cur)
        return;
    if (cur.dest && cur.dest !== cur.orig)
        addLine(state.drawable, cur, cur.dest);
    else
        addCircle(state.drawable, cur);
    cancel(state);
}
exports.end = end;
function cancel(state) {
    if (state.drawable.current) {
        state.drawable.current = undefined;
        state.dom.redraw();
    }
}
exports.cancel = cancel;
function clear(state) {
    if (state.drawable.shapes.length) {
        state.drawable.shapes = [];
        state.dom.redraw();
        onChange(state.drawable);
    }
}
exports.clear = clear;
function eventBrush(e) {
    const a = e.shiftKey && util_1.isRightButton(e) ? 1 : 0;
    const b = e.altKey ? 2 : 0;
    return brushes[a + b];
}
function not(f) {
    return (x) => !f(x);
}
function addCircle(drawable, cur) {
    const orig = cur.orig;
    const sameCircle = (s) => s.orig === orig && !s.dest;
    const similar = drawable.shapes.filter(sameCircle)[0];
    if (similar)
        drawable.shapes = drawable.shapes.filter(not(sameCircle));
    if (!similar || similar.brush !== cur.brush)
        drawable.shapes.push({
            brush: cur.brush,
            orig: orig
        });
    onChange(drawable);
}
function addLine(drawable, cur, dest) {
    const orig = cur.orig;
    const sameLine = (s) => {
        return !!s.dest && s.orig === orig && s.dest === dest;
    };
    const exists = drawable.shapes.filter(sameLine).length > 0;
    if (exists)
        drawable.shapes = drawable.shapes.filter(not(sameLine));
    else
        drawable.shapes.push({
            brush: cur.brush,
            orig: orig,
            dest: dest
        });
    onChange(drawable);
}
function onChange(drawable) {
    if (drawable.onChange)
        drawable.onChange(drawable.shapes);
}
},{"./board":3,"./util":17}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drag = require("./drag");
const draw = require("./draw");
const util_1 = require("./util");
function bindBoard(s) {
    if (s.viewOnly)
        return;
    const boardEl = s.dom.elements.board, onStart = startDragOrDraw(s);
    boardEl.addEventListener('touchstart', onStart);
    boardEl.addEventListener('mousedown', onStart);
    if (s.disableContextMenu || s.drawable.enabled) {
        boardEl.addEventListener('contextmenu', e => e.preventDefault());
    }
}
exports.bindBoard = bindBoard;
function bindDocument(s, redrawAll) {
    const unbinds = [];
    if (!s.dom.relative && s.resizable) {
        const onResize = () => {
            s.dom.bounds.clear();
            util_1.raf(redrawAll);
        };
        unbinds.push(unbindable(document.body, 'chessground.resize', onResize));
    }
    if (!s.viewOnly) {
        const onmove = dragOrDraw(s, drag.move, draw.move);
        const onend = dragOrDraw(s, drag.end, draw.end);
        ['touchmove', 'mousemove'].forEach(ev => unbinds.push(unbindable(document, ev, onmove)));
        ['touchend', 'mouseup'].forEach(ev => unbinds.push(unbindable(document, ev, onend)));
        const onScroll = () => s.dom.bounds.clear();
        unbinds.push(unbindable(window, 'scroll', onScroll, { passive: true }));
        unbinds.push(unbindable(window, 'resize', onScroll, { passive: true }));
    }
    return () => unbinds.forEach(f => f());
}
exports.bindDocument = bindDocument;
function unbindable(el, eventName, callback, options) {
    el.addEventListener(eventName, callback, options);
    return () => el.removeEventListener(eventName, callback);
}
function startDragOrDraw(s) {
    return e => {
        if (s.draggable.current)
            drag.cancel(s);
        else if (s.drawable.current)
            draw.cancel(s);
        else if (e.shiftKey || util_1.isRightButton(e)) {
            if (s.drawable.enabled)
                draw.start(s, e);
        }
        else if (!s.viewOnly)
            drag.start(s, e);
    };
}
function dragOrDraw(s, withDrag, withDraw) {
    return e => {
        if (e.shiftKey || util_1.isRightButton(e)) {
            if (s.drawable.enabled)
                withDraw(s, e);
        }
        else if (!s.viewOnly)
            withDrag(s, e);
    };
}
},{"./drag":6,"./draw":7,"./util":17}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function explosion(state, keys) {
    state.exploding = {
        stage: 1,
        keys: keys
    };
    state.dom.redraw();
    setTimeout(() => {
        setStage(state, 2);
        setTimeout(() => setStage(state, undefined), 120);
    }, 120);
}
exports.default = explosion;
function setStage(state, stage) {
    if (state.exploding) {
        if (stage)
            state.exploding.stage = stage;
        else
            state.exploding = undefined;
        state.dom.redraw();
    }
}
},{}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const cg = require("./types");
exports.initial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const roles = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };
const letters = { pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k' };
function read(fen) {
    if (fen === 'start')
        fen = exports.initial;
    const pieces = {};
    let row = 8;
    let col = 0;
    for (const c of fen) {
        switch (c) {
            case ' ': return pieces;
            case '/':
                --row;
                if (row === 0)
                    return pieces;
                col = 0;
                break;
            case '~':
                pieces[util_1.pos2key([col, row])].promoted = true;
                break;
            default:
                const nb = c.charCodeAt(0);
                if (nb < 57)
                    col += nb - 48;
                else {
                    ++col;
                    const role = c.toLowerCase();
                    pieces[util_1.pos2key([col, row])] = {
                        role: roles[role],
                        color: (c === role ? 'black' : 'white')
                    };
                }
        }
    }
    return pieces;
}
exports.read = read;
function write(pieces) {
    let piece, letter;
    return util_1.invRanks.map(y => cg.ranks.map(x => {
        piece = pieces[util_1.pos2key([x, y])];
        if (piece) {
            letter = letters[piece.role];
            return piece.color === 'white' ? letter.toUpperCase() : letter;
        }
        else
            return '1';
    }).join('')).join('/').replace(/1{2,}/g, s => s.length.toString());
}
exports.write = write;
},{"./types":16,"./util":17}],11:[function(require,module,exports){
module.exports = require("./chessground").Chessground;

},{"./chessground":4}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
function diff(a, b) {
    return Math.abs(a - b);
}
function pawn(color) {
    return (x1, y1, x2, y2) => diff(x1, x2) < 2 && (color === 'white' ? (y2 === y1 + 1 || (y1 <= 2 && y2 === (y1 + 2) && x1 === x2)) : (y2 === y1 - 1 || (y1 >= 7 && y2 === (y1 - 2) && x1 === x2)));
}
const knight = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return (xd === 1 && yd === 2) || (xd === 2 && yd === 1);
};
const bishop = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2);
};
const rook = (x1, y1, x2, y2) => {
    return x1 === x2 || y1 === y2;
};
const queen = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2);
};
function king(color, rookFiles, canCastle) {
    return (x1, y1, x2, y2) => (diff(x1, x2) < 2 && diff(y1, y2) < 2) || (canCastle && y1 === y2 && y1 === (color === 'white' ? 1 : 8) && ((x1 === 5 && (x2 === 3 || x2 === 7)) || util.containsX(rookFiles, x2)));
}
function rookFilesOf(pieces, color) {
    let piece;
    return Object.keys(pieces).filter(key => {
        piece = pieces[key];
        return piece && piece.color === color && piece.role === 'rook';
    }).map((key) => util.key2pos(key)[0]);
}
function premove(pieces, key, canCastle) {
    const piece = pieces[key], pos = util.key2pos(key);
    let mobility;
    switch (piece.role) {
        case 'pawn':
            mobility = pawn(piece.color);
            break;
        case 'knight':
            mobility = knight;
            break;
        case 'bishop':
            mobility = bishop;
            break;
        case 'rook':
            mobility = rook;
            break;
        case 'queen':
            mobility = queen;
            break;
        case 'king':
            mobility = king(piece.color, rookFilesOf(pieces, piece.color), canCastle);
            break;
    }
    return util.allKeys.map(util.key2pos).filter(pos2 => {
        return (pos[0] !== pos2[0] || pos[1] !== pos2[1]) && mobility(pos[0], pos[1], pos2[0], pos2[1]);
    }).map(util.pos2key);
}
exports.default = premove;
;
},{"./util":17}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const util = require("./util");
function render(s) {
    const asWhite = s.orientation === 'white', posToTranslate = s.dom.relative ? util.posToTranslateRel : util.posToTranslateAbs(s.dom.bounds()), translate = s.dom.relative ? util.translateRel : util.translateAbs, shouldRotate = s.rotate ? (s.orientation != s.turnColor) : false, boardEl = s.dom.elements.board, pieces = s.pieces, curAnim = s.animation.current, anims = curAnim ? curAnim.plan.anims : {}, fadings = curAnim ? curAnim.plan.fadings : {}, curDrag = s.draggable.current, squares = computeSquareClasses(s), samePieces = {}, sameSquares = {}, movedPieces = {}, movedSquares = {}, piecesKeys = Object.keys(pieces);
    let k, p, el, pieceAtKey, elPieceName, anim, fading, pMvdset, pMvd, sMvdset, sMvd;
    el = boardEl.firstChild;
    while (el) {
        k = el.cgKey;
        if (isPieceNode(el)) {
            pieceAtKey = pieces[k];
            anim = anims[k];
            fading = fadings[k];
            elPieceName = el.cgPiece;
            if (el.cgDragging && (!curDrag || curDrag.orig !== k)) {
                el.classList.remove('dragging');
                translate(el, posToTranslate(util_1.key2pos(k), asWhite), shouldRotate);
                el.cgDragging = false;
            }
            if (!fading && el.cgFading) {
                el.cgFading = false;
                el.classList.remove('fading');
            }
            if (pieceAtKey) {
                if (anim && el.cgAnimating && elPieceName === pieceNameOf(pieceAtKey)) {
                    const pos = util_1.key2pos(k);
                    pos[0] += anim[1][0];
                    pos[1] += anim[1][1];
                    el.classList.add('anim');
                    translate(el, posToTranslate(pos, asWhite), shouldRotate);
                }
                else if (el.cgAnimating) {
                    el.cgAnimating = false;
                    el.classList.remove('anim');
                    translate(el, posToTranslate(util_1.key2pos(k), asWhite), shouldRotate);
                    if (s.addPieceZIndex)
                        el.style.zIndex = posZIndex(util_1.key2pos(k), asWhite);
                }
                if (elPieceName === pieceNameOf(pieceAtKey) && (!fading || !el.cgFading)) {
                    samePieces[k] = true;
                }
                else {
                    if (fading && elPieceName === pieceNameOf(fading)) {
                        el.classList.add('fading');
                        el.cgFading = true;
                    }
                    else {
                        if (movedPieces[elPieceName])
                            movedPieces[elPieceName].push(el);
                        else
                            movedPieces[elPieceName] = [el];
                    }
                }
            }
            else {
                if (movedPieces[elPieceName])
                    movedPieces[elPieceName].push(el);
                else
                    movedPieces[elPieceName] = [el];
            }
        }
        else if (isSquareNode(el)) {
            const cn = el.className;
            if (squares[k] === cn)
                sameSquares[k] = true;
            else if (movedSquares[cn])
                movedSquares[cn].push(el);
            else
                movedSquares[cn] = [el];
        }
        el = el.nextSibling;
    }
    for (const sk in squares) {
        if (!sameSquares[sk]) {
            sMvdset = movedSquares[squares[sk]];
            sMvd = sMvdset && sMvdset.pop();
            const translation = posToTranslate(util_1.key2pos(sk), asWhite);
            if (sMvd) {
                sMvd.cgKey = sk;
                translate(sMvd, translation, shouldRotate);
            }
            else {
                const squareNode = util_1.createEl('square', squares[sk]);
                squareNode.cgKey = sk;
                translate(squareNode, translation, shouldRotate);
                boardEl.insertBefore(squareNode, boardEl.firstChild);
            }
        }
    }
    for (const j in piecesKeys) {
        k = piecesKeys[j];
        p = pieces[k];
        anim = anims[k];
        if (!samePieces[k]) {
            pMvdset = movedPieces[pieceNameOf(p)];
            pMvd = pMvdset && pMvdset.pop();
            if (pMvd) {
                pMvd.cgKey = k;
                if (pMvd.cgFading) {
                    pMvd.classList.remove('fading');
                    pMvd.cgFading = false;
                }
                const pos = util_1.key2pos(k);
                if (s.addPieceZIndex)
                    pMvd.style.zIndex = posZIndex(pos, asWhite);
                if (anim) {
                    pMvd.cgAnimating = true;
                    pMvd.classList.add('anim');
                    pos[0] += anim[1][0];
                    pos[1] += anim[1][1];
                }
                translate(pMvd, posToTranslate(pos, asWhite), shouldRotate);
            }
            else {
                const pieceName = pieceNameOf(p), pieceNode = util_1.createEl('piece', pieceName), pos = util_1.key2pos(k);
                pieceNode.cgPiece = pieceName;
                pieceNode.cgKey = k;
                if (anim) {
                    pieceNode.cgAnimating = true;
                    pos[0] += anim[1][0];
                    pos[1] += anim[1][1];
                }
                translate(pieceNode, posToTranslate(pos, asWhite), shouldRotate);
                if (s.addPieceZIndex)
                    pieceNode.style.zIndex = posZIndex(pos, asWhite);
                boardEl.appendChild(pieceNode);
            }
        }
    }
    for (const i in movedPieces)
        removeNodes(s, movedPieces[i]);
    for (const i in movedSquares)
        removeNodes(s, movedSquares[i]);
}
exports.default = render;
function isPieceNode(el) {
    return el.tagName === 'PIECE';
}
function isSquareNode(el) {
    return el.tagName === 'SQUARE';
}
function removeNodes(s, nodes) {
    for (const i in nodes)
        s.dom.elements.board.removeChild(nodes[i]);
}
function posZIndex(pos, asWhite) {
    let z = 2 + (pos[1] - 1) * 8 + (8 - pos[0]);
    if (asWhite)
        z = 67 - z;
    return z + '';
}
function pieceNameOf(piece) {
    return `${piece.color} ${piece.role}`;
}
function computeSquareClasses(s) {
    const squares = {};
    let i, k;
    if (s.lastMove && s.highlight.lastMove)
        for (i in s.lastMove) {
            addSquare(squares, s.lastMove[i], 'last-move');
        }
    if (s.check && s.highlight.check)
        addSquare(squares, s.check, 'check');
    if (s.selected) {
        addSquare(squares, s.selected, 'selected');
        if (s.movable.showDests) {
            const dests = s.movable.dests && s.movable.dests[s.selected];
            if (dests)
                for (i in dests) {
                    k = dests[i];
                    addSquare(squares, k, 'move-dest' + (s.pieces[k] ? ' oc' : ''));
                }
            const pDests = s.premovable.dests;
            if (pDests)
                for (i in pDests) {
                    k = pDests[i];
                    addSquare(squares, k, 'premove-dest' + (s.pieces[k] ? ' oc' : ''));
                }
        }
    }
    const premove = s.premovable.current;
    if (premove)
        for (i in premove)
            addSquare(squares, premove[i], 'current-premove');
    else if (s.predroppable.current)
        addSquare(squares, s.predroppable.current.key, 'current-premove');
    const o = s.exploding;
    if (o)
        for (i in o.keys)
            addSquare(squares, o.keys[i], 'exploding' + o.stage);
    return squares;
}
function addSquare(squares, key, klass) {
    if (squares[key])
        squares[key] += ' ' + klass;
    else
        squares[key] = klass;
}
},{"./util":17}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fen = require("./fen");
const util_1 = require("./util");
function defaults() {
    return {
        pieces: fen.read(fen.initial),
        orientation: 'white',
        turnColor: 'white',
        coordinates: true,
        autoCastle: true,
        rotate: true,
        viewOnly: false,
        disableContextMenu: false,
        resizable: true,
        addPieceZIndex: false,
        pieceKey: false,
        highlight: {
            lastMove: true,
            check: true
        },
        animation: {
            enabled: true,
            duration: 200
        },
        movable: {
            free: true,
            color: 'both',
            showDests: true,
            events: {},
            rookCastle: true
        },
        premovable: {
            enabled: true,
            showDests: true,
            castle: true,
            events: {}
        },
        predroppable: {
            enabled: false,
            events: {}
        },
        draggable: {
            enabled: true,
            distance: 3,
            autoDistance: true,
            centerPiece: true,
            showGhost: true,
            deleteOnDropOff: false
        },
        selectable: {
            enabled: true
        },
        stats: {
            dragged: !('ontouchstart' in window)
        },
        events: {},
        drawable: {
            enabled: true,
            visible: true,
            eraseOnClick: true,
            shapes: [],
            autoShapes: [],
            brushes: {
                green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
                red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
                blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
                yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
                paleBlue: { key: 'pb', color: '#003088', opacity: 0.4, lineWidth: 15 },
                paleGreen: { key: 'pg', color: '#15781B', opacity: 0.4, lineWidth: 15 },
                paleRed: { key: 'pr', color: '#882020', opacity: 0.4, lineWidth: 15 },
                paleGrey: { key: 'pgr', color: '#4a4a4a', opacity: 0.35, lineWidth: 15 }
            },
            pieces: {
                baseUrl: 'https://lichess1.org/assets/piece/cburnett/'
            },
            prevSvgHash: ''
        },
        hold: util_1.timer()
    };
}
exports.defaults = defaults;
},{"./fen":10,"./util":17}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
function createElement(tagName) {
    return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}
exports.createElement = createElement;
let isTrident;
function renderSvg(state, root) {
    const d = state.drawable, cur = d.current, arrowDests = {};
    d.shapes.concat(d.autoShapes).concat(cur ? [cur] : []).forEach(s => {
        if (s.dest)
            arrowDests[s.dest] = (arrowDests[s.dest] || 0) + 1;
    });
    const shapes = d.shapes.concat(d.autoShapes).map((s) => {
        return {
            shape: s,
            current: false,
            hash: shapeHash(s, arrowDests, false)
        };
    });
    if (cur)
        shapes.push({
            shape: cur,
            current: true,
            hash: shapeHash(cur, arrowDests, true)
        });
    const fullHash = shapes.map(sc => sc.hash).join('');
    if (fullHash === state.drawable.prevSvgHash)
        return;
    state.drawable.prevSvgHash = fullHash;
    const defsEl = root.firstChild;
    syncDefs(d, shapes, defsEl);
    syncShapes(state, shapes, d.brushes, arrowDests, root, defsEl);
}
exports.renderSvg = renderSvg;
function syncDefs(d, shapes, defsEl) {
    const brushes = {};
    let brush;
    shapes.forEach(s => {
        if (s.shape.dest) {
            brush = d.brushes[s.shape.brush];
            if (s.shape.modifiers)
                brush = makeCustomBrush(brush, s.shape.modifiers);
            brushes[brush.key] = brush;
        }
    });
    const keysInDom = {};
    let el = defsEl.firstChild;
    while (el) {
        keysInDom[el.getAttribute('cgKey')] = true;
        el = el.nextSibling;
    }
    for (let key in brushes) {
        if (!keysInDom[key])
            defsEl.appendChild(renderMarker(brushes[key]));
    }
}
function syncShapes(state, shapes, brushes, arrowDests, root, defsEl) {
    if (isTrident === undefined)
        isTrident = util_1.computeIsTrident();
    const bounds = state.dom.bounds(), hashesInDom = {}, toRemove = [];
    shapes.forEach(sc => { hashesInDom[sc.hash] = false; });
    let el = defsEl.nextSibling, elHash;
    while (el) {
        elHash = el.getAttribute('cgHash');
        if (hashesInDom.hasOwnProperty(elHash))
            hashesInDom[elHash] = true;
        else
            toRemove.push(el);
        el = el.nextSibling;
    }
    toRemove.forEach(el => root.removeChild(el));
    shapes.forEach(sc => {
        if (!hashesInDom[sc.hash])
            root.appendChild(renderShape(state, sc, brushes, arrowDests, bounds));
    });
}
function shapeHash({ orig, dest, brush, piece, modifiers }, arrowDests, current) {
    return [current, orig, dest, brush, dest && arrowDests[dest],
        piece && pieceHash(piece),
        modifiers && modifiersHash(modifiers)
    ].filter(x => x).join('');
}
function pieceHash(piece) {
    return [piece.color, piece.role, piece.scale].filter(x => x).join('');
}
function modifiersHash(m) {
    return '' + (m.lineWidth || '');
}
function renderShape(state, { shape, current, hash }, brushes, arrowDests, bounds) {
    let el;
    if (shape.piece)
        el = renderPiece(state.drawable.pieces.baseUrl, orient(util_1.key2pos(shape.orig), state.orientation), shape.piece, bounds);
    else {
        const orig = orient(util_1.key2pos(shape.orig), state.orientation);
        if (shape.orig && shape.dest) {
            let brush = brushes[shape.brush];
            if (shape.modifiers)
                brush = makeCustomBrush(brush, shape.modifiers);
            el = renderArrow(brush, orig, orient(util_1.key2pos(shape.dest), state.orientation), current, arrowDests[shape.dest] > 1, bounds);
        }
        else
            el = renderCircle(brushes[shape.brush], orig, current, bounds);
    }
    el.setAttribute('cgHash', hash);
    return el;
}
function renderCircle(brush, pos, current, bounds) {
    const o = pos2px(pos, bounds), width = circleWidth(current, bounds), radius = (bounds.width + bounds.height) / 32;
    return setAttributes(createElement('circle'), {
        stroke: brush.color,
        'stroke-width': width,
        fill: 'none',
        opacity: opacity(brush, current),
        cx: o[0],
        cy: o[1],
        r: radius - width / 2
    });
}
function renderArrow(brush, orig, dest, current, shorten, bounds) {
    const m = arrowMargin(bounds, shorten && !current), a = pos2px(orig, bounds), b = pos2px(dest, bounds), dx = b[0] - a[0], dy = b[1] - a[1], angle = Math.atan2(dy, dx), xo = Math.cos(angle) * m, yo = Math.sin(angle) * m;
    return setAttributes(createElement('line'), {
        stroke: brush.color,
        'stroke-width': lineWidth(brush, current, bounds),
        'stroke-linecap': 'round',
        'marker-end': isTrident ? undefined : 'url(#arrowhead-' + brush.key + ')',
        opacity: opacity(brush, current),
        x1: a[0],
        y1: a[1],
        x2: b[0] - xo,
        y2: b[1] - yo
    });
}
function renderPiece(baseUrl, pos, piece, bounds) {
    const o = pos2px(pos, bounds), size = bounds.width / 8 * (piece.scale || 1), name = piece.color[0] + (piece.role === 'knight' ? 'n' : piece.role[0]).toUpperCase();
    return setAttributes(createElement('image'), {
        className: `${piece.role} ${piece.color}`,
        x: o[0] - size / 2,
        y: o[1] - size / 2,
        width: size,
        height: size,
        href: baseUrl + name + '.svg'
    });
}
function renderMarker(brush) {
    const marker = setAttributes(createElement('marker'), {
        id: 'arrowhead-' + brush.key,
        orient: 'auto',
        markerWidth: 4,
        markerHeight: 8,
        refX: 2.05,
        refY: 2.01
    });
    marker.appendChild(setAttributes(createElement('path'), {
        d: 'M0,0 V4 L3,2 Z',
        fill: brush.color
    }));
    marker.setAttribute('cgKey', brush.key);
    return marker;
}
function setAttributes(el, attrs) {
    for (let key in attrs)
        el.setAttribute(key, attrs[key]);
    return el;
}
function orient(pos, color) {
    return color === 'white' ? pos : [9 - pos[0], 9 - pos[1]];
}
function makeCustomBrush(base, modifiers) {
    const brush = {
        color: base.color,
        opacity: Math.round(base.opacity * 10) / 10,
        lineWidth: Math.round(modifiers.lineWidth || base.lineWidth)
    };
    brush.key = [base.key, modifiers.lineWidth].filter(x => x).join('');
    return brush;
}
function circleWidth(current, bounds) {
    return (current ? 3 : 4) / 512 * bounds.width;
}
function lineWidth(brush, current, bounds) {
    return (brush.lineWidth || 10) * (current ? 0.85 : 1) / 512 * bounds.width;
}
function opacity(brush, current) {
    return (brush.opacity || 1) * (current ? 0.9 : 1);
}
function arrowMargin(bounds, shorten) {
    return isTrident ? 0 : ((shorten ? 20 : 10) / 512 * bounds.width);
}
function pos2px(pos, bounds) {
    return [(pos[0] - 0.5) * bounds.width / 8, (8.5 - pos[1]) * bounds.height / 8];
}
},{"./util":17}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
exports.ranks = [1, 2, 3, 4, 5, 6, 7, 8];
},{}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cg = require("./types");
exports.colors = ['white', 'black'];
exports.invRanks = [8, 7, 6, 5, 4, 3, 2, 1];
exports.allKeys = Array.prototype.concat(...cg.files.map(c => cg.ranks.map(r => c + r)));
exports.pos2key = (pos) => exports.allKeys[8 * pos[0] + pos[1] - 9];
exports.key2pos = (k) => [k.charCodeAt(0) - 96, k.charCodeAt(1) - 48];
function memo(f) {
    let v;
    const ret = () => {
        if (v === undefined)
            v = f();
        return v;
    };
    ret.clear = () => { v = undefined; };
    return ret;
}
exports.memo = memo;
exports.timer = () => {
    let startAt;
    return {
        start() { startAt = Date.now(); },
        cancel() { startAt = undefined; },
        stop() {
            if (!startAt)
                return 0;
            const time = Date.now() - startAt;
            startAt = undefined;
            return time;
        }
    };
};
exports.opposite = (c) => c === 'white' ? 'black' : 'white';
function containsX(xs, x) {
    return xs ? xs.indexOf(x) !== -1 : false;
}
exports.containsX = containsX;
exports.distanceSq = (pos1, pos2) => {
    return Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[1] - pos2[1], 2);
};
exports.samePiece = (p1, p2) => p1.role === p2.role && p1.color === p2.color;
exports.computeIsTrident = () => window.navigator.userAgent.indexOf('Trident/') > -1;
const posToTranslateBase = (pos, asWhite, xFactor, yFactor) => [
    (asWhite ? pos[0] - 1 : 8 - pos[0]) * xFactor,
    (asWhite ? 8 - pos[1] : pos[1] - 1) * yFactor
];
exports.posToTranslateAbs = (bounds) => {
    const xFactor = bounds.width / 8, yFactor = bounds.height / 8;
    return (pos, asWhite) => posToTranslateBase(pos, asWhite, xFactor, yFactor);
};
exports.posToTranslateRel = (pos, asWhite) => posToTranslateBase(pos, asWhite, 12.5, 12.5);
exports.translateAbs = (el, pos, rotate) => {
    let targetString = `translate(${pos[0]}px,${pos[1]}px) `;
    if (rotate) {
        targetString += 'rotate(180deg)';
    }
    el.style.transform = targetString;
};
exports.translateRel = (el, percents, rotate) => {
    el.style.left = percents[0] + '%';
    el.style.top = percents[1] + '%';
    if (rotate) {
        el.style.transform = 'rotate(180deg)';
    }
    else {
        el.style.transform = "";
    }
};
exports.translateAway = (el) => exports.translateAbs(el, [-99999, -99999]);
exports.eventPosition = e => {
    if (e.clientX || e.clientX === 0)
        return [e.clientX, e.clientY];
    if (e.touches && e.targetTouches[0])
        return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
    return undefined;
};
exports.isRightButton = (e) => e.buttons === 2 || e.button === 2;
exports.createEl = (tagName, className) => {
    const el = document.createElement(tagName);
    if (className)
        el.className = className;
    return el;
};
exports.raf = (window.requestAnimationFrame || window.setTimeout).bind(window);
},{"./types":16}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const types_1 = require("./types");
const svg_1 = require("./svg");
function wrap(element, s, bounds) {
    element.innerHTML = '';
    element.classList.add('cg-board-wrap');
    util_1.colors.forEach(c => {
        element.classList.toggle('orientation-' + c, s.orientation === c);
    });
    element.classList.toggle('manipulable', !s.viewOnly);
    const board = util_1.createEl('div', 'cg-board');
    element.appendChild(board);
    let svg;
    if (s.drawable.visible && bounds) {
        svg = svg_1.createElement('svg');
        svg.appendChild(svg_1.createElement('defs'));
        element.appendChild(svg);
    }
    if (s.coordinates) {
        const orientClass = s.orientation === 'black' ? ' black' : '';
        element.appendChild(renderCoords(types_1.ranks, 'ranks' + orientClass));
        element.appendChild(renderCoords(types_1.files, 'files' + orientClass));
    }
    let over;
    if (bounds && (s.movable.showDests || s.premovable.showDests)) {
        over = util_1.createEl('div', 'over');
        util_1.translateAway(over);
        over.style.width = (bounds.width / 8) + 'px';
        over.style.height = (bounds.height / 8) + 'px';
        element.appendChild(over);
    }
    let ghost;
    if (bounds && s.draggable.showGhost) {
        ghost = util_1.createEl('piece', 'ghost');
        util_1.translateAway(ghost);
        element.appendChild(ghost);
    }
    return {
        board: board,
        over: over,
        ghost: ghost,
        svg: svg
    };
}
exports.default = wrap;
function renderCoords(elems, className) {
    const el = util_1.createEl('coords', className);
    let f;
    for (let i in elems) {
        f = util_1.createEl('coord');
        f.textContent = elems[i];
        el.appendChild(f);
    }
    return el;
}
},{"./svg":15,"./types":16,"./util":17}]},{},[11])(11)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYW5pbS50cyIsInNyYy9hcGkudHMiLCJzcmMvYm9hcmQudHMiLCJzcmMvY2hlc3Nncm91bmQudHMiLCJzcmMvY29uZmlnLnRzIiwic3JjL2RyYWcudHMiLCJzcmMvZHJhdy50cyIsInNyYy9ldmVudHMudHMiLCJzcmMvZXhwbG9zaW9uLnRzIiwic3JjL2Zlbi50cyIsInNyYy9pbmRleC5qcyIsInNyYy9wcmVtb3ZlLnRzIiwic3JjL3JlbmRlci50cyIsInNyYy9zdGF0ZS50cyIsInNyYy9zdmcudHMiLCJzcmMvdHlwZXMudHMiLCJzcmMvdXRpbC50cyIsInNyYy93cmFwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNDQSwrQkFBOEI7QUE2QjlCLGNBQXdCLFFBQXFCLEVBQUUsS0FBWTtJQUN6RCxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDdEYsQ0FBQztBQUZELG9CQUVDO0FBRUQsZ0JBQTBCLFFBQXFCLEVBQUUsS0FBWTtJQUMzRCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0IsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUNuQixNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFKRCx3QkFJQztBQVdELG1CQUFtQixHQUFXLEVBQUUsS0FBZTtJQUM3QyxNQUFNLENBQUM7UUFDTCxHQUFHLEVBQUUsR0FBRztRQUNSLEdBQUcsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztRQUN0QixLQUFLLEVBQUUsS0FBSztLQUNiLENBQUM7QUFDSixDQUFDO0FBRUQsZ0JBQWdCLEtBQWdCLEVB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QyxDQUNGLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUMzRCxDQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxNQUFNLEdBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUMxQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3hCLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDeEIsTUFBTSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUMxRCxDQUFDLENBQUE7QUFFRCxNQUFNLE1BQU0sR0FBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxLQUFLLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDdkMsQ0FBQyxDQUFBO0FBRUQsTUFBTSxJQUFJLEdBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUN4QyxNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDO0FBQ2hDLENBQUMsQ0FBQTtBQUVELE1BQU0sS0FBSyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDekMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFB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Q3pCLEVBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEIsQ0FBQztJQUNELE1BQU0sQ0FBQyxFQUFFLENBQUM7QUFDWixDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcclxuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnXHJcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXHJcblxyXG5leHBvcnQgdHlwZSBNdXRhdGlvbjxBPiA9IChzdGF0ZTogU3RhdGUpID0+IEE7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFuaW1WZWN0b3Ige1xyXG4gIDA6IGNnLk51bWJlclBhaXI7IC8vIGFuaW1hdGlvbiBnb2FsXHJcbiAgMTogY2cuTnVtYmVyUGFpcjsgLy8gYW5pbWF0aW9uIGN1cnJlbnQgc3RhdHVzXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQW5pbVZlY3RvcnMge1xyXG4gIFtrZXk6IHN0cmluZ106IEFuaW1WZWN0b3JcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBbmltRmFkaW5ncyB7XHJcbiAgW2tleTogc3RyaW5nXTogY2cuUGllY2VcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBbmltUGxhbiB7XHJcbiAgYW5pbXM6IEFuaW1WZWN0b3JzO1xyXG4gIGZhZGluZ3M6IEFuaW1GYWRpbmdzO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFuaW1DdXJyZW50IHtcclxuICBzdGFydDogY2cuVGltZXN0YW1wO1xyXG4gIGR1cmF0aW9uOiBjZy5NaWxsaXNlY29uZHM7XHJcbiAgcGxhbjogQW5pbVBsYW47XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBhbmltPEE+KG11dGF0aW9uOiBNdXRhdGlvbjxBPiwgc3RhdGU6IFN0YXRlKTogQSB7XHJcbiAgcmV0dXJuIHN0YXRlLmFuaW1hdGlvbi5lbmFibGVkID8gYW5pbWF0ZShtdXRhdGlvbiwgc3RhdGUpIDogcmVuZGVyKG11dGF0aW9uLCBzdGF0ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXI8QT4obXV0YXRpb246IE11dGF0aW9uPEE+LCBzdGF0ZTogU3RhdGUpOiBBIHtcclxuICBjb25zdCByZXN1bHQgPSBtdXRhdGlvbihzdGF0ZSk7XHJcbiAgc3RhdGUuZG9tLnJlZHJhdygpO1xyXG4gIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmludGVyZmFjZSBBbmltUGllY2Uge1xyXG4gIGtleTogY2cuS2V5O1xyXG4gIHBvczogY2cuUG9zO1xyXG4gIHBpZWNlOiBjZy5QaWVjZTtcclxufVxyXG5pbnRlcmZhY2UgQW5pbVBpZWNlcyB7XHJcbiAgW2tleTogc3RyaW5nXTogQW5pbVBpZWNlXHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1ha2VQaWVjZShrZXk6IGNnLktleSwgcGllY2U6IGNnLlBpZWNlKTogQW5pbVBpZWNlIHtcclxuICByZXR1cm4ge1xyXG4gICAga2V5OiBrZXksXHJcbiAgICBwb3M6IHV0aWwua2V5MnBvcyhrZXkpLFxyXG4gICAgcGllY2U6IHBpZWNlXHJcbiAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gY2xvc2VyKHBpZWNlOiBBbmltUGllY2UsIHBpZWNlczogQW5pbVBpZWNlW10pOiBBbmltUGllY2Uge1xyXG4gIHJldHVybiBwaWVjZXMuc29ydCgocDEsIHAyKSA9PiB7XHJcbiAgICByZXR1cm4gdXRpbC5kaXN0YW5jZVNxKHBpZWNlLnBvcywgcDEucG9zKSAtIHV0aWwuZGlzdGFuY2VTcShwaWVjZS5wb3MsIHAyLnBvcyk7XHJcbiAgfSlbMF07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvbXB1dGVQbGFuKHByZXZQaWVjZXM6IGNnLlBpZWNlcywgY3VycmVudDogU3RhdGUpOiBBbmltUGxhbiB7XHJcbiAgY29uc3QgYW5pbXM6IEFuaW1WZWN0b3JzID0ge30sXHJcbiAgYW5pbWVkT3JpZ3M6IGNnLktleVtdID0gW10sXHJcbiAgZmFkaW5nczogQW5pbUZhZGluZ3MgPSB7fSxcclxuICBtaXNzaW5nczogQW5pbVBpZWNlW10gPSBbXSxcclxuICBuZXdzOiBBbmltUGllY2VbXSA9IFtdLFxyXG4gIHByZVBpZWNlczogQW5pbVBpZWNlcyA9IHt9O1xyXG4gIGxldCBjdXJQOiBjZy5QaWVjZSwgcHJlUDogQW5pbVBpZWNlLCBpOiBhbnksIHZlY3RvcjogY2cuTnVtYmVyUGFpcjtcclxuICBmb3IgKGkgaW4gcHJldlBpZWNlcykge1xyXG4gICAgcHJlUGllY2VzW2ldID0gbWFrZVBpZWNlKGkgYXMgY2cuS2V5LCBwcmV2UGllY2VzW2ldKTtcclxuICB9XHJcbiAgZm9yIChjb25zdCBrZXkgb2YgdXRpbC5hbGxLZXlzKSB7XHJcbiAgICBjdXJQID0gY3VycmVudC5waWVjZXNba2V5XTtcclxuICAgIHByZVAgPSBwcmVQaWVjZXNba2V5XTtcclxuICAgIGlmIChjdXJQKSB7XHJcbiAgICAgIGlmIChwcmVQKSB7XHJcbiAgICAgICAgaWYgKCF1dGlsLnNhbWVQaWVjZShjdXJQLCBwcmVQLnBpZWNlKSkge1xyXG4gICAgICAgICAgbWlzc2luZ3MucHVzaChwcmVQKTtcclxuICAgICAgICAgIG5ld3MucHVzaChtYWtlUGllY2Uoa2V5LCBjdXJQKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgbmV3cy5wdXNoKG1ha2VQaWVjZShrZXksIGN1clApKTtcclxuICAgIH0gZWxzZSBpZiAocHJlUCkgbWlzc2luZ3MucHVzaChwcmVQKTtcclxuICB9XHJcbiAgbmV3cy5mb3JFYWNoKG5ld1AgPT4ge1xyXG4gICAgcHJlUCA9IGNsb3NlcihuZXdQLCBtaXNzaW5ncy5maWx0ZXIocCA9PiB1dGlsLnNhbWVQaWVjZShuZXdQLnBpZWNlLCBwLnBpZWNlKSkpO1xyXG4gICAgaWYgKHByZVApIHtcclxuICAgICAgdmVjdG9yID0gW3ByZVAucG9zWzBdIC0gbmV3UC5wb3NbMF0sIHByZVAucG9zWzFdIC0gbmV3UC5wb3NbMV1dO1xyXG4gICAgICBhbmltc1tuZXdQLmtleV0gPSBbdmVjdG9yLCB2ZWN0b3JdO1xyXG4gICAgICBhbmltZWRPcmlncy5wdXNoKHByZVAua2V5KTtcclxuICAgIH1cclxuICB9KTtcclxuICBtaXNzaW5ncy5mb3JFYWNoKHAgPT4ge1xyXG4gICAgaWYgKFxyXG4gICAgICAhdXRpbC5jb250YWluc1goYW5pbWVkT3JpZ3MsIHAua2V5KSAmJlxyXG4gICAgICAhKGN1cnJlbnQuaXRlbXMgPyBjdXJyZW50Lml0ZW1zKHAucG9zLCBwLmtleSkgOiBmYWxzZSlcclxuICAgIClcclxuICAgIGZhZGluZ3NbcC5rZXldID0gcC5waWVjZTtcclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGFuaW1zOiBhbmltcyxcclxuICAgIGZhZGluZ3M6IGZhZGluZ3NcclxuICB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdGVwKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xyXG4gIGNvbnN0IGN1ciA9IHN0YXRlLmFuaW1hdGlvbi5jdXJyZW50O1xyXG4gIGlmICghY3VyKSB7IC8vIGFuaW1hdGlvbiB3YXMgY2FuY2VsZWQgOihcclxuICAgIGlmICghc3RhdGUuZG9tLmRlc3Ryb3llZCkgc3RhdGUuZG9tLnJlZHJhd05vdygpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBjb25zdCByZXN0ID0gMSAtIChEYXRlLm5vdygpIC0gY3VyLnN0YXJ0KSAvIGN1ci5kdXJhdGlvbjtcclxuICBpZiAocmVzdCA8PSAwKSB7XHJcbiAgICBzdGF0ZS5hbmltYXRpb24uY3VycmVudCA9IHVuZGVmaW5lZDtcclxuICAgIHN0YXRlLmRvbS5yZWRyYXdOb3coKTtcclxuICB9IGVsc2Uge1xyXG4gICAgY29uc3QgZWFzZSA9IGVhc2luZyhyZXN0KTtcclxuICAgIGZvciAobGV0IGkgaW4gY3VyLnBsYW4uYW5pbXMpIHtcclxuICAgICAgY29uc3QgY2ZnID0gY3VyLnBsYW4uYW5pbXNbaV07XHJcbiAgICAgIGNmZ1sxXSA9IFtjZmdbMF1bMF0gKiBlYXNlLCBjZmdbMF1bMV0gKiBlYXNlXTtcclxuICAgIH1cclxuICAgIHN0YXRlLmRvbS5yZWRyYXdOb3codHJ1ZSk7IC8vIG9wdGltaXNhdGlvbjogZG9uJ3QgcmVuZGVyIFNWRyBjaGFuZ2VzIGR1cmluZyBhbmltYXRpb25zXHJcbiAgICB1dGlsLnJhZigoKSA9PiBzdGVwKHN0YXRlKSk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBhbmltYXRlPEE+KG11dGF0aW9uOiBNdXRhdGlvbjxBPiwgc3RhdGU6IFN0YXRlKTogQSB7XHJcbiAgLy8gY2xvbmUgc3RhdGUgYmVmb3JlIG11dGF0aW5nIGl0XHJcbiAgY29uc3QgcHJldlBpZWNlczogY2cuUGllY2VzID0gey4uLnN0YXRlLnBpZWNlc307XHJcblxyXG4gIGNvbnN0IHJlc3VsdCA9IG11dGF0aW9uKHN0YXRlKTtcclxuICBjb25zdCBwbGFuID0gY29tcHV0ZVBsYW4ocHJldlBpZWNlcywgc3RhdGUpO1xyXG4gIGlmICghaXNPYmplY3RFbXB0eShwbGFuLmFuaW1zKSB8fCAhaXNPYmplY3RFbXB0eShwbGFuLmZhZGluZ3MpKSB7XHJcbiAgICBjb25zdCBhbHJlYWR5UnVubmluZyA9IHN0YXRlLmFuaW1hdGlvbi5jdXJyZW50ICYmIHN0YXRlLmFuaW1hdGlvbi5jdXJyZW50LnN0YXJ0O1xyXG4gICAgc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQgPSB7XHJcbiAgICAgIHN0YXJ0OiBEYXRlLm5vdygpLFxyXG4gICAgICBkdXJhdGlvbjogc3RhdGUuYW5pbWF0aW9uLmR1cmF0aW9uLFxyXG4gICAgICBwbGFuOiBwbGFuXHJcbiAgICB9O1xyXG4gICAgaWYgKCFhbHJlYWR5UnVubmluZykgc3RlcChzdGF0ZSk7XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIGRvbid0IGFuaW1hdGUsIGp1c3QgcmVuZGVyIHJpZ2h0IGF3YXlcclxuICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcclxuICB9XHJcbiAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNPYmplY3RFbXB0eShvOiBhbnkpOiBib29sZWFuIHtcclxuICBmb3IgKGxldCBfIGluIG8pIHJldHVybiBmYWxzZTtcclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG4vLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9ncmUvMTY1MDI5NFxyXG5mdW5jdGlvbiBlYXNpbmcodDogbnVtYmVyKTogbnVtYmVyIHtcclxuICByZXR1cm4gdCA8IDAuNSA/IDQgKiB0ICogdCAqIHQgOiAodCAtIDEpICogKDIgKiB0IC0gMikgKiAoMiAqIHQgLSAyKSArIDE7XHJcbn1cclxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xyXG5pbXBvcnQgKiBhcyBib2FyZCBmcm9tICcuL2JvYXJkJ1xyXG5pbXBvcnQgeyB3cml0ZSBhcyBmZW5Xcml0ZSB9IGZyb20gJy4vZmVuJ1xyXG5pbXBvcnQgeyBDb25maWcsIGNvbmZpZ3VyZSB9IGZyb20gJy4vY29uZmlnJ1xyXG5pbXBvcnQgeyBhbmltLCByZW5kZXIgfSBmcm9tICcuL2FuaW0nXHJcbmltcG9ydCB7IGNhbmNlbCBhcyBkcmFnQ2FuY2VsLCBkcmFnTmV3UGllY2UgfSBmcm9tICcuL2RyYWcnXHJcbmltcG9ydCB7IERyYXdTaGFwZSB9IGZyb20gJy4vZHJhdydcclxuaW1wb3J0IGV4cGxvc2lvbiBmcm9tICcuL2V4cGxvc2lvbidcclxuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXBpIHtcclxuXHJcbiAgLy8gcmVjb25maWd1cmUgdGhlIGluc3RhbmNlLiBBY2NlcHRzIGFsbCBjb25maWcgb3B0aW9ucywgZXhjZXB0IGZvciB2aWV3T25seSAmIGRyYXdhYmxlLnZpc2libGUuXHJcbiAgLy8gYm9hcmQgd2lsbCBiZSBhbmltYXRlZCBhY2NvcmRpbmdseSwgaWYgYW5pbWF0aW9ucyBhcmUgZW5hYmxlZC5cclxuICBzZXQoY29uZmlnOiBDb25maWcpOiB2b2lkO1xyXG5cclxuICAvLyByZWFkIGNoZXNzZ3JvdW5kIHN0YXRlOyB3cml0ZSBhdCB5b3VyIG93biByaXNrcy5cclxuICBzdGF0ZTogU3RhdGU7XHJcblxyXG4gIC8vIGdldCB0aGUgcG9zaXRpb24gYXMgYSBGRU4gc3RyaW5nIChvbmx5IGNvbnRhaW5zIHBpZWNlcywgbm8gZmxhZ3MpXHJcbiAgLy8gZS5nLiBybmJxa2Juci9wcHBwcHBwcC84LzgvOC84L1BQUFBQUFBQL1JOQlFLQk5SXHJcbiAgZ2V0RmVuKCk6IGNnLkZFTjtcclxuXHJcbiAgLy8gY2hhbmdlIHRoZSB2aWV3IGFuZ2xlXHJcbiAgdG9nZ2xlT3JpZW50YXRpb24oKTogdm9pZDtcclxuXHJcbiAgLy8gcGVyZm9ybSBhIG1vdmUgcHJvZ3JhbW1hdGljYWxseVxyXG4gIG1vdmUob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiB2b2lkO1xyXG5cclxuICAvLyBhZGQgYW5kL29yIHJlbW92ZSBhcmJpdHJhcnkgcGllY2VzIG9uIHRoZSBib2FyZFxyXG4gIHNldFBpZWNlcyhwaWVjZXM6IGNnLlBpZWNlc0RpZmYpOiB2b2lkO1xyXG5cclxuICAvLyBjbGljayBhIHNxdWFyZSBwcm9ncmFtbWF0aWNhbGx5XHJcbiAgc2VsZWN0U3F1YXJlKGtleTogY2cuS2V5IHwgbnVsbCwgZm9yY2U/OiBib29sZWFuKTogdm9pZDtcclxuXHJcbiAgLy8gcHV0IGEgbmV3IHBpZWNlIG9uIHRoZSBib2FyZFxyXG4gIG5ld1BpZWNlKHBpZWNlOiBjZy5QaWVjZSwga2V5OiBjZy5LZXkpOiB2b2lkO1xyXG5cclxuICAvLyBwbGF5IHRoZSBjdXJyZW50IHByZW1vdmUsIGlmIGFueTsgcmV0dXJucyB0cnVlIGlmIHByZW1vdmUgd2FzIHBsYXllZFxyXG4gIHBsYXlQcmVtb3ZlKCk6IGJvb2xlYW47XHJcblxyXG4gIC8vIGNhbmNlbCB0aGUgY3VycmVudCBwcmVtb3ZlLCBpZiBhbnlcclxuICBjYW5jZWxQcmVtb3ZlKCk6IHZvaWQ7XHJcblxyXG4gIC8vIHBsYXkgdGhlIGN1cnJlbnQgcHJlZHJvcCwgaWYgYW55OyByZXR1cm5zIHRydWUgaWYgcHJlbW92ZSB3YXMgcGxheWVkXHJcbiAgcGxheVByZWRyb3AodmFsaWRhdGU6IChkcm9wOiBjZy5Ecm9wKSA9PiBib29sZWFuKTogYm9vbGVhbjtcclxuXHJcbiAgLy8gY2FuY2VsIHRoZSBjdXJyZW50IHByZWRyb3AsIGlmIGFueVxyXG4gIGNhbmNlbFByZWRyb3AoKTogdm9pZDtcclxuXHJcbiAgLy8gY2FuY2VsIHRoZSBjdXJyZW50IG1vdmUgYmVpbmcgbWFkZVxyXG4gIGNhbmNlbE1vdmUoKTogdm9pZDtcclxuXHJcbiAgLy8gY2FuY2VsIGN1cnJlbnQgbW92ZSBhbmQgcHJldmVudCBmdXJ0aGVyIG9uZXNcclxuICBzdG9wKCk6IHZvaWQ7XHJcblxyXG4gIC8vIG1ha2Ugc3F1YXJlcyBleHBsb2RlIChhdG9taWMgY2hlc3MpXHJcbiAgZXhwbG9kZShrZXlzOiBjZy5LZXlbXSk6IHZvaWQ7XHJcblxyXG4gIC8vIHByb2dyYW1tYXRpY2FsbHkgZHJhdyB1c2VyIHNoYXBlc1xyXG4gIHNldFNoYXBlcyhzaGFwZXM6IERyYXdTaGFwZVtdKTogdm9pZDtcclxuXHJcbiAgLy8gcHJvZ3JhbW1hdGljYWxseSBkcmF3IGF1dG8gc2hhcGVzXHJcbiAgc2V0QXV0b1NoYXBlcyhzaGFwZXM6IERyYXdTaGFwZVtdKTogdm9pZDtcclxuXHJcbiAgLy8gc3F1YXJlIG5hbWUgYXQgdGhpcyBET00gcG9zaXRpb24gKGxpa2UgXCJlNFwiKVxyXG4gIGdldEtleUF0RG9tUG9zKHBvczogY2cuTnVtYmVyUGFpcik6IGNnLktleSB8IHVuZGVmaW5lZDtcclxuXHJcbiAgLy8gb25seSB1c2VmdWwgd2hlbiBDU1MgY2hhbmdlcyB0aGUgYm9hcmQgd2lkdGgvaGVpZ2h0IHJhdGlvIChmb3IgM0QpXHJcbiAgcmVkcmF3QWxsOiBjZy5SZWRyYXc7XHJcblxyXG4gIC8vIGZvciBjcmF6eWhvdXNlIGFuZCBib2FyZCBlZGl0b3JzXHJcbiAgZHJhZ05ld1BpZWNlKHBpZWNlOiBjZy5QaWVjZSwgZXZlbnQ6IGNnLk1vdWNoRXZlbnQsIGZvcmNlPzogYm9vbGVhbik6IHZvaWQ7XHJcblxyXG4gIC8vIHVuYmluZHMgYWxsIGV2ZW50c1xyXG4gIC8vIChpbXBvcnRhbnQgZm9yIGRvY3VtZW50LXdpZGUgZXZlbnRzIGxpa2Ugc2Nyb2xsIGFuZCBtb3VzZW1vdmUpXHJcbiAgZGVzdHJveTogY2cuVW5iaW5kXHJcbn1cclxuXHJcbi8vIHNlZSBBUEkgdHlwZXMgYW5kIGRvY3VtZW50YXRpb25zIGluIGR0cy9hcGkuZC50c1xyXG5leHBvcnQgZnVuY3Rpb24gc3RhcnQoc3RhdGU6IFN0YXRlLCByZWRyYXdBbGw6IGNnLlJlZHJhdyk6IEFwaSB7XHJcblxyXG4gIGZ1bmN0aW9uIHRvZ2dsZU9yaWVudGF0aW9uKCkge1xyXG4gICAgYm9hcmQudG9nZ2xlT3JpZW50YXRpb24oc3RhdGUpO1xyXG4gICAgcmVkcmF3QWxsKCk7XHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIHtcclxuXHJcbiAgICBzZXQoY29uZmlnKSB7XHJcbiAgICAgIGlmIChjb25maWcub3JpZW50YXRpb24gJiYgY29uZmlnLm9yaWVudGF0aW9uICE9PSBzdGF0ZS5vcmllbnRhdGlvbikgdG9nZ2xlT3JpZW50YXRpb24oKTtcclxuICAgICAgKGNvbmZpZy5mZW4gPyBhbmltIDogcmVuZGVyKShzdGF0ZSA9PiBjb25maWd1cmUoc3RhdGUsIGNvbmZpZyksIHN0YXRlKTtcclxuICAgIH0sXHJcblxyXG4gICAgc3RhdGUsXHJcblxyXG4gICAgZ2V0RmVuOiAoKSA9PiBmZW5Xcml0ZShzdGF0ZS5waWVjZXMpLFxyXG5cclxuICAgIHRvZ2dsZU9yaWVudGF0aW9uLFxyXG5cclxuICAgIHNldFBpZWNlcyhwaWVjZXMpIHtcclxuICAgICAgYW5pbShzdGF0ZSA9PiBib2FyZC5zZXRQaWVjZXMoc3RhdGUsIHBpZWNlcyksIHN0YXRlKTtcclxuICAgIH0sXHJcblxyXG4gICAgc2VsZWN0U3F1YXJlKGtleSwgZm9yY2UpIHtcclxuICAgICAgaWYgKGtleSkgYW5pbShzdGF0ZSA9PiBib2FyZC5zZWxlY3RTcXVhcmUoc3RhdGUsIGtleSwgZm9yY2UpLCBzdGF0ZSk7XHJcbiAgICAgIGVsc2UgaWYgKHN0YXRlLnNlbGVjdGVkKSB7XHJcbiAgICAgICAgYm9hcmQudW5zZWxlY3Qoc3RhdGUpO1xyXG4gICAgICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcclxuICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBtb3ZlKG9yaWcsIGRlc3QpIHtcclxuICAgICAgYW5pbShzdGF0ZSA9PiBib2FyZC5iYXNlTW92ZShzdGF0ZSwgb3JpZywgZGVzdCksIHN0YXRlKTtcclxuICAgIH0sXHJcblxyXG4gICAgbmV3UGllY2UocGllY2UsIGtleSkge1xyXG4gICAgICBhbmltKHN0YXRlID0+IGJvYXJkLmJhc2VOZXdQaWVjZShzdGF0ZSwgcGllY2UsIGtleSksIHN0YXRlKTtcclxuICAgIH0sXHJcblxyXG4gICAgcGxheVByZW1vdmUoKSB7XHJcbiAgICAgIGlmIChzdGF0ZS5wcmVtb3ZhYmxlLmN1cnJlbnQpIHtcclxuICAgICAgICBpZiAoYW5pbShib2FyZC5wbGF5UHJlbW92ZSwgc3RhdGUpKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAvLyBpZiB0aGUgcHJlbW92ZSBjb3VsZG4ndCBiZSBwbGF5ZWQsIHJlZHJhdyB0byBjbGVhciBpdCB1cFxyXG4gICAgICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9LFxyXG5cclxuICAgIHBsYXlQcmVkcm9wKHZhbGlkYXRlKSB7XHJcbiAgICAgIGlmIChzdGF0ZS5wcmVkcm9wcGFibGUuY3VycmVudCkge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGJvYXJkLnBsYXlQcmVkcm9wKHN0YXRlLCB2YWxpZGF0ZSk7XHJcbiAgICAgICAgc3RhdGUuZG9tLnJlZHJhdygpO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSxcclxuXHJcbiAgICBjYW5jZWxQcmVtb3ZlKCkge1xyXG4gICAgICByZW5kZXIoYm9hcmQudW5zZXRQcmVtb3ZlLCBzdGF0ZSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGNhbmNlbFByZWRyb3AoKSB7XHJcbiAgICAgIHJlbmRlcihib2FyZC51bnNldFByZWRyb3AsIHN0YXRlKTtcclxuICAgIH0sXHJcblxyXG4gICAgY2FuY2VsTW92ZSgpIHtcclxuICAgICAgcmVuZGVyKHN0YXRlID0+IHsgYm9hcmQuY2FuY2VsTW92ZShzdGF0ZSk7IGRyYWdDYW5jZWwoc3RhdGUpOyB9LCBzdGF0ZSk7XHJcbiAgICB9LFxyXG5cclxuICAgIHN0b3AoKSB7XHJcbiAgICAgIHJlbmRlcihzdGF0ZSA9PiB7IGJvYXJkLnN0b3Aoc3RhdGUpOyBkcmFnQ2FuY2VsKHN0YXRlKTsgfSwgc3RhdGUpO1xyXG4gICAgfSxcclxuXHJcbiAgICBleHBsb2RlKGtleXM6IGNnLktleVtdKSB7XHJcbiAgICAgIGV4cGxvc2lvbihzdGF0ZSwga2V5cyk7XHJcbiAgICB9LFxyXG5cclxuICAgIHNldEF1dG9TaGFwZXMoc2hhcGVzOiBEcmF3U2hhcGVbXSkge1xyXG4gICAgICByZW5kZXIoc3RhdGUgPT4gc3RhdGUuZHJhd2FibGUuYXV0b1NoYXBlcyA9IHNoYXBlcywgc3RhdGUpO1xyXG4gICAgfSxcclxuXHJcbiAgICBzZXRTaGFwZXMoc2hhcGVzOiBEcmF3U2hhcGVbXSkge1xyXG4gICAgICByZW5kZXIoc3RhdGUgPT4gc3RhdGUuZHJhd2FibGUuc2hhcGVzID0gc2hhcGVzLCBzdGF0ZSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGdldEtleUF0RG9tUG9zKHBvcykge1xyXG4gICAgICByZXR1cm4gYm9hcmQuZ2V0S2V5QXREb21Qb3MocG9zLCBzdGF0ZS5vcmllbnRhdGlvbiA9PT0gJ3doaXRlJywgc3RhdGUuZG9tLmJvdW5kcygpKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVkcmF3QWxsLFxyXG5cclxuICAgIGRyYWdOZXdQaWVjZShwaWVjZSwgZXZlbnQsIGZvcmNlKSB7XHJcbiAgICAgIGRyYWdOZXdQaWVjZShzdGF0ZSwgcGllY2UsIGV2ZW50LCBmb3JjZSlcclxuICAgIH0sXHJcblxyXG4gICAgZGVzdHJveSgpIHtcclxuICAgICAgYm9hcmQuc3RvcChzdGF0ZSk7XHJcbiAgICAgIHN0YXRlLmRvbS51bmJpbmQgJiYgc3RhdGUuZG9tLnVuYmluZCgpO1xyXG4gICAgICBzdGF0ZS5kb20uZGVzdHJveWVkID0gdHJ1ZTtcclxuICAgIH1cclxuICB9O1xyXG59XHJcbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcclxuaW1wb3J0IHsgcG9zMmtleSwga2V5MnBvcywgb3Bwb3NpdGUsIGNvbnRhaW5zWCB9IGZyb20gJy4vdXRpbCdcclxuaW1wb3J0IHByZW1vdmUgZnJvbSAnLi9wcmVtb3ZlJ1xyXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xyXG5cclxuZXhwb3J0IHR5cGUgQ2FsbGJhY2sgPSAoLi4uYXJnczogYW55W10pID0+IHZvaWQ7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2FsbFVzZXJGdW5jdGlvbihmOiBDYWxsYmFjayB8IHVuZGVmaW5lZCwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICBpZiAoZikgc2V0VGltZW91dCgoKSA9PiBmKC4uLmFyZ3MpLCAxKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZU9yaWVudGF0aW9uKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xyXG4gIHN0YXRlLm9yaWVudGF0aW9uID0gb3Bwb3NpdGUoc3RhdGUub3JpZW50YXRpb24pO1xyXG4gIHN0YXRlLmFuaW1hdGlvbi5jdXJyZW50ID1cclxuICBzdGF0ZS5kcmFnZ2FibGUuY3VycmVudCA9XHJcbiAgc3RhdGUuc2VsZWN0ZWQgPSB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZXNldChzdGF0ZTogU3RhdGUpOiB2b2lkIHtcclxuICBzdGF0ZS5sYXN0TW92ZSA9IHVuZGVmaW5lZDtcclxuICB1bnNlbGVjdChzdGF0ZSk7XHJcbiAgdW5zZXRQcmVtb3ZlKHN0YXRlKTtcclxuICB1bnNldFByZWRyb3Aoc3RhdGUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2V0UGllY2VzKHN0YXRlOiBTdGF0ZSwgcGllY2VzOiBjZy5QaWVjZXNEaWZmKTogdm9pZCB7XHJcbiAgZm9yIChsZXQga2V5IGluIHBpZWNlcykge1xyXG4gICAgY29uc3QgcGllY2UgPSBwaWVjZXNba2V5XTtcclxuICAgIGlmIChwaWVjZSkgc3RhdGUucGllY2VzW2tleV0gPSBwaWVjZTtcclxuICAgIGVsc2UgZGVsZXRlIHN0YXRlLnBpZWNlc1trZXldO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNldENoZWNrKHN0YXRlOiBTdGF0ZSwgY29sb3I6IGNnLkNvbG9yIHwgYm9vbGVhbik6IHZvaWQge1xyXG4gIGlmIChjb2xvciA9PT0gdHJ1ZSkgY29sb3IgPSBzdGF0ZS50dXJuQ29sb3I7XHJcbiAgaWYgKCFjb2xvcikgc3RhdGUuY2hlY2sgPSB1bmRlZmluZWQ7XHJcbiAgZWxzZSBmb3IgKGxldCBrIGluIHN0YXRlLnBpZWNlcykge1xyXG4gICAgaWYgKHN0YXRlLnBpZWNlc1trXS5yb2xlID09PSAna2luZycgJiYgc3RhdGUucGllY2VzW2tdLmNvbG9yID09PSBjb2xvcikge1xyXG4gICAgICBzdGF0ZS5jaGVjayA9IGsgYXMgY2cuS2V5O1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gc2V0UHJlbW92ZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5LCBtZXRhOiBjZy5TZXRQcmVtb3ZlTWV0YWRhdGEpOiB2b2lkIHtcclxuICB1bnNldFByZWRyb3Aoc3RhdGUpO1xyXG4gIHN0YXRlLnByZW1vdmFibGUuY3VycmVudCA9IFtvcmlnLCBkZXN0XTtcclxuICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLnByZW1vdmFibGUuZXZlbnRzLnNldCwgb3JpZywgZGVzdCwgbWV0YSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB1bnNldFByZW1vdmUoc3RhdGU6IFN0YXRlKTogdm9pZCB7XHJcbiAgaWYgKHN0YXRlLnByZW1vdmFibGUuY3VycmVudCkge1xyXG4gICAgc3RhdGUucHJlbW92YWJsZS5jdXJyZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5wcmVtb3ZhYmxlLmV2ZW50cy51bnNldCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRQcmVkcm9wKHN0YXRlOiBTdGF0ZSwgcm9sZTogY2cuUm9sZSwga2V5OiBjZy5LZXkpOiB2b2lkIHtcclxuICB1bnNldFByZW1vdmUoc3RhdGUpO1xyXG4gIHN0YXRlLnByZWRyb3BwYWJsZS5jdXJyZW50ID0ge1xyXG4gICAgcm9sZTogcm9sZSxcclxuICAgIGtleToga2V5XHJcbiAgfTtcclxuICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLnByZWRyb3BwYWJsZS5ldmVudHMuc2V0LCByb2xlLCBrZXkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdW5zZXRQcmVkcm9wKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xyXG4gIGNvbnN0IHBkID0gc3RhdGUucHJlZHJvcHBhYmxlO1xyXG4gIGlmIChwZC5jdXJyZW50KSB7XHJcbiAgICBwZC5jdXJyZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgY2FsbFVzZXJGdW5jdGlvbihwZC5ldmVudHMudW5zZXQpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gdHJ5QXV0b0Nhc3RsZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogYm9vbGVhbiB7XHJcbiAgaWYgKCFzdGF0ZS5hdXRvQ2FzdGxlKSByZXR1cm4gZmFsc2U7XHJcbiAgY29uc3Qga2luZyA9IHN0YXRlLnBpZWNlc1tvcmlnXTtcclxuICBpZiAoa2luZy5yb2xlICE9PSAna2luZycpIHJldHVybiBmYWxzZTtcclxuICBjb25zdCBvcmlnUG9zID0ga2V5MnBvcyhvcmlnKTtcclxuICBpZiAob3JpZ1Bvc1swXSAhPT0gNSkgcmV0dXJuIGZhbHNlO1xyXG4gIGlmIChvcmlnUG9zWzFdICE9PSAxICYmIG9yaWdQb3NbMV0gIT09IDgpIHJldHVybiBmYWxzZTtcclxuICBjb25zdCBkZXN0UG9zID0ga2V5MnBvcyhkZXN0KTtcclxuICBsZXQgb2xkUm9va1BvcywgbmV3Um9va1BvcywgbmV3S2luZ1BvcztcclxuICBpZiAoZGVzdFBvc1swXSA9PT0gNyB8fCBkZXN0UG9zWzBdID09PSA4KSB7XHJcbiAgICBvbGRSb29rUG9zID0gcG9zMmtleShbOCwgb3JpZ1Bvc1sxXV0pO1xyXG4gICAgbmV3Um9va1BvcyA9IHBvczJrZXkoWzYsIG9yaWdQb3NbMV1dKTtcclxuICAgIG5ld0tpbmdQb3MgPSBwb3Mya2V5KFs3LCBvcmlnUG9zWzFdXSk7XHJcbiAgfSBlbHNlIGlmIChkZXN0UG9zWzBdID09PSAzIHx8IGRlc3RQb3NbMF0gPT09IDEpIHtcclxuICAgIG9sZFJvb2tQb3MgPSBwb3Mya2V5KFsxLCBvcmlnUG9zWzFdXSk7XHJcbiAgICBuZXdSb29rUG9zID0gcG9zMmtleShbNCwgb3JpZ1Bvc1sxXV0pO1xyXG4gICAgbmV3S2luZ1BvcyA9IHBvczJrZXkoWzMsIG9yaWdQb3NbMV1dKTtcclxuICB9IGVsc2UgcmV0dXJuIGZhbHNlO1xyXG5cclxuICBjb25zdCByb29rID0gc3RhdGUucGllY2VzW29sZFJvb2tQb3NdO1xyXG4gIGlmIChyb29rLnJvbGUgIT09ICdyb29rJykgcmV0dXJuIGZhbHNlO1xyXG5cclxuICBkZWxldGUgc3RhdGUucGllY2VzW29yaWddO1xyXG4gIGRlbGV0ZSBzdGF0ZS5waWVjZXNbb2xkUm9va1Bvc107XHJcblxyXG4gIHN0YXRlLnBpZWNlc1tuZXdLaW5nUG9zXSA9IGtpbmdcclxuICBzdGF0ZS5waWVjZXNbbmV3Um9va1Bvc10gPSByb29rO1xyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYmFzZU1vdmUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGNnLlBpZWNlIHwgYm9vbGVhbiB7XHJcbiAgaWYgKG9yaWcgPT09IGRlc3QgfHwgIXN0YXRlLnBpZWNlc1tvcmlnXSkgcmV0dXJuIGZhbHNlO1xyXG4gIGNvbnN0IGNhcHR1cmVkOiBjZy5QaWVjZSB8IHVuZGVmaW5lZCA9IChcclxuICAgIHN0YXRlLnBpZWNlc1tkZXN0XSAmJlxyXG4gICAgc3RhdGUucGllY2VzW2Rlc3RdLmNvbG9yICE9PSBzdGF0ZS5waWVjZXNbb3JpZ10uY29sb3JcclxuICApID8gc3RhdGUucGllY2VzW2Rlc3RdIDogdW5kZWZpbmVkO1xyXG4gIGlmIChkZXN0ID09IHN0YXRlLnNlbGVjdGVkKSB1bnNlbGVjdChzdGF0ZSk7XHJcbiAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5ldmVudHMubW92ZSwgb3JpZywgZGVzdCwgY2FwdHVyZWQpO1xyXG4gIGlmICghdHJ5QXV0b0Nhc3RsZShzdGF0ZSwgb3JpZywgZGVzdCkpIHtcclxuICAgIHN0YXRlLnBpZWNlc1tkZXN0XSA9IHN0YXRlLnBpZWNlc1tvcmlnXTtcclxuICAgIGRlbGV0ZSBzdGF0ZS5waWVjZXNbb3JpZ107XHJcbiAgfVxyXG4gIHN0YXRlLmxhc3RNb3ZlID0gW29yaWcsIGRlc3RdO1xyXG4gIHN0YXRlLmNoZWNrID0gdW5kZWZpbmVkO1xyXG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUuZXZlbnRzLmNoYW5nZSk7XHJcbiAgcmV0dXJuIGNhcHR1cmVkIHx8IHRydWU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBiYXNlTmV3UGllY2Uoc3RhdGU6IFN0YXRlLCBwaWVjZTogY2cuUGllY2UsIGtleTogY2cuS2V5LCBmb3JjZT86IGJvb2xlYW4pOiBib29sZWFuIHtcclxuICBpZiAoc3RhdGUucGllY2VzW2tleV0pIHtcclxuICAgIGlmIChmb3JjZSkgZGVsZXRlIHN0YXRlLnBpZWNlc1trZXldO1xyXG4gICAgZWxzZSByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUuZXZlbnRzLmRyb3BOZXdQaWVjZSwgcGllY2UsIGtleSk7XHJcbiAgc3RhdGUucGllY2VzW2tleV0gPSBwaWVjZTtcclxuICBzdGF0ZS5sYXN0TW92ZSA9IFtrZXldO1xyXG4gIHN0YXRlLmNoZWNrID0gdW5kZWZpbmVkO1xyXG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUuZXZlbnRzLmNoYW5nZSk7XHJcbiAgc3RhdGUubW92YWJsZS5kZXN0cyA9IHVuZGVmaW5lZDtcclxuICBzdGF0ZS50dXJuQ29sb3IgPSBvcHBvc2l0ZShzdGF0ZS50dXJuQ29sb3IpO1xyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBiYXNlVXNlck1vdmUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGNnLlBpZWNlIHwgYm9vbGVhbiB7XHJcbiAgY29uc3QgcmVzdWx0ID0gYmFzZU1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpO1xyXG4gIGlmIChyZXN1bHQpIHtcclxuICAgIHN0YXRlLm1vdmFibGUuZGVzdHMgPSB1bmRlZmluZWQ7XHJcbiAgICBzdGF0ZS50dXJuQ29sb3IgPSBvcHBvc2l0ZShzdGF0ZS50dXJuQ29sb3IpO1xyXG4gICAgc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQgPSB1bmRlZmluZWQ7XHJcbiAgfVxyXG4gIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB1c2VyTW92ZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogYm9vbGVhbiB7XHJcbiAgaWYgKGNhbk1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpKSB7XHJcbiAgICBjb25zdCByZXN1bHQgPSBiYXNlVXNlck1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpO1xyXG4gICAgaWYgKHJlc3VsdCkge1xyXG4gICAgICBjb25zdCBob2xkVGltZSA9IHN0YXRlLmhvbGQuc3RvcCgpO1xyXG4gICAgICB1bnNlbGVjdChzdGF0ZSk7XHJcbiAgICAgIGNvbnN0IG1ldGFkYXRhOiBjZy5Nb3ZlTWV0YWRhdGEgPSB7XHJcbiAgICAgICAgcHJlbW92ZTogZmFsc2UsXHJcbiAgICAgICAgY3RybEtleTogc3RhdGUuc3RhdHMuY3RybEtleSxcclxuICAgICAgICBob2xkVGltZTogaG9sZFRpbWVcclxuICAgICAgfTtcclxuICAgICAgaWYgKHJlc3VsdCAhPT0gdHJ1ZSkgbWV0YWRhdGEuY2FwdHVyZWQgPSByZXN1bHQ7XHJcbiAgICAgIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUubW92YWJsZS5ldmVudHMuYWZ0ZXIsIG9yaWcsIGRlc3QsIG1ldGFkYXRhKTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgfSBlbHNlIGlmIChjYW5QcmVtb3ZlKHN0YXRlLCBvcmlnLCBkZXN0KSkge1xyXG4gICAgc2V0UHJlbW92ZShzdGF0ZSwgb3JpZywgZGVzdCwge1xyXG4gICAgICBjdHJsS2V5OiBzdGF0ZS5zdGF0cy5jdHJsS2V5XHJcbiAgICB9KTtcclxuICAgIHVuc2VsZWN0KHN0YXRlKTtcclxuICB9IGVsc2UgaWYgKGlzTW92YWJsZShzdGF0ZSwgZGVzdCkgfHwgaXNQcmVtb3ZhYmxlKHN0YXRlLCBkZXN0KSkge1xyXG4gICAgc2V0U2VsZWN0ZWQoc3RhdGUsIGRlc3QpO1xyXG4gICAgc3RhdGUuaG9sZC5zdGFydCgpO1xyXG4gIH0gZWxzZSB1bnNlbGVjdChzdGF0ZSk7XHJcbiAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZHJvcE5ld1BpZWNlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIGZvcmNlPzogYm9vbGVhbik6IHZvaWQge1xyXG4gIGlmIChjYW5Ecm9wKHN0YXRlLCBvcmlnLCBkZXN0KSB8fCBmb3JjZSkge1xyXG4gICAgY29uc3QgcGllY2UgPSBzdGF0ZS5waWVjZXNbb3JpZ107XHJcbiAgICBkZWxldGUgc3RhdGUucGllY2VzW29yaWddO1xyXG4gICAgYmFzZU5ld1BpZWNlKHN0YXRlLCBwaWVjZSwgZGVzdCwgZm9yY2UpO1xyXG4gICAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5tb3ZhYmxlLmV2ZW50cy5hZnRlck5ld1BpZWNlLCBwaWVjZS5yb2xlLCBkZXN0LCB7XHJcbiAgICAgIHByZWRyb3A6IGZhbHNlXHJcbiAgICB9KTtcclxuICB9IGVsc2UgaWYgKGNhblByZWRyb3Aoc3RhdGUsIG9yaWcsIGRlc3QpKSB7XHJcbiAgICBzZXRQcmVkcm9wKHN0YXRlLCBzdGF0ZS5waWVjZXNbb3JpZ10ucm9sZSwgZGVzdCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHVuc2V0UHJlbW92ZShzdGF0ZSk7XHJcbiAgICB1bnNldFByZWRyb3Aoc3RhdGUpO1xyXG4gIH1cclxuICBkZWxldGUgc3RhdGUucGllY2VzW29yaWddO1xyXG4gIHVuc2VsZWN0KHN0YXRlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNlbGVjdFNxdWFyZShzdGF0ZTogU3RhdGUsIGtleTogY2cuS2V5LCBmb3JjZT86IGJvb2xlYW4pOiB2b2lkIHtcclxuICBpZiAoc3RhdGUuc2VsZWN0ZWQpIHtcclxuICAgIGlmIChzdGF0ZS5zZWxlY3RlZCA9PT0ga2V5ICYmICFzdGF0ZS5kcmFnZ2FibGUuZW5hYmxlZCkge1xyXG4gICAgICB1bnNlbGVjdChzdGF0ZSk7XHJcbiAgICAgIHN0YXRlLmhvbGQuY2FuY2VsKCk7XHJcbiAgICB9IGVsc2UgaWYgKChzdGF0ZS5zZWxlY3RhYmxlLmVuYWJsZWQgfHwgZm9yY2UpICYmIHN0YXRlLnNlbGVjdGVkICE9PSBrZXkpIHtcclxuICAgICAgaWYgKHVzZXJNb3ZlKHN0YXRlLCBzdGF0ZS5zZWxlY3RlZCwga2V5KSkgc3RhdGUuc3RhdHMuZHJhZ2dlZCA9IGZhbHNlO1xyXG4gICAgfSBlbHNlIHN0YXRlLmhvbGQuc3RhcnQoKTtcclxuICB9IGVsc2UgaWYgKGlzTW92YWJsZShzdGF0ZSwga2V5KSB8fCBpc1ByZW1vdmFibGUoc3RhdGUsIGtleSkpIHtcclxuICAgIHNldFNlbGVjdGVkKHN0YXRlLCBrZXkpO1xyXG4gICAgc3RhdGUuaG9sZC5zdGFydCgpO1xyXG4gIH1cclxuICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLmV2ZW50cy5zZWxlY3QsIGtleSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzZXRTZWxlY3RlZChzdGF0ZTogU3RhdGUsIGtleTogY2cuS2V5KTogdm9pZCB7XHJcbiAgc3RhdGUuc2VsZWN0ZWQgPSBrZXk7XHJcbiAgaWYgKGlzUHJlbW92YWJsZShzdGF0ZSwga2V5KSkge1xyXG4gICAgc3RhdGUucHJlbW92YWJsZS5kZXN0cyA9IHByZW1vdmUoc3RhdGUucGllY2VzLCBrZXksIHN0YXRlLnByZW1vdmFibGUuY2FzdGxlKTtcclxuICB9XHJcbiAgZWxzZSBzdGF0ZS5wcmVtb3ZhYmxlLmRlc3RzID0gdW5kZWZpbmVkO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdW5zZWxlY3Qoc3RhdGU6IFN0YXRlKTogdm9pZCB7XHJcbiAgc3RhdGUuc2VsZWN0ZWQgPSB1bmRlZmluZWQ7XHJcbiAgc3RhdGUucHJlbW92YWJsZS5kZXN0cyA9IHVuZGVmaW5lZDtcclxuICBzdGF0ZS5ob2xkLmNhbmNlbCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc01vdmFibGUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXkpOiBib29sZWFuIHtcclxuICBjb25zdCBwaWVjZSA9IHN0YXRlLnBpZWNlc1tvcmlnXTtcclxuICByZXR1cm4gcGllY2UgJiYgKFxyXG4gICAgc3RhdGUubW92YWJsZS5jb2xvciA9PT0gJ2JvdGgnIHx8IChcclxuICAgICAgc3RhdGUubW92YWJsZS5jb2xvciA9PT0gcGllY2UuY29sb3IgJiZcclxuICAgICAgICBzdGF0ZS50dXJuQ29sb3IgPT09IHBpZWNlLmNvbG9yXHJcbiAgICApKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNhbk1vdmUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiBvcmlnICE9PSBkZXN0ICYmIGlzTW92YWJsZShzdGF0ZSwgb3JpZykgJiYgKFxyXG4gICAgc3RhdGUubW92YWJsZS5mcmVlIHx8ICghIXN0YXRlLm1vdmFibGUuZGVzdHMgJiYgY29udGFpbnNYKHN0YXRlLm1vdmFibGUuZGVzdHNbb3JpZ10sIGRlc3QpKVxyXG4gICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNhbkRyb3Aoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGJvb2xlYW4ge1xyXG4gIGNvbnN0IHBpZWNlID0gc3RhdGUucGllY2VzW29yaWddO1xyXG4gIHJldHVybiBwaWVjZSAmJiBkZXN0ICYmIChvcmlnID09PSBkZXN0IHx8ICFzdGF0ZS5waWVjZXNbZGVzdF0pICYmIChcclxuICAgIHN0YXRlLm1vdmFibGUuY29sb3IgPT09ICdib3RoJyB8fCAoXHJcbiAgICAgIHN0YXRlLm1vdmFibGUuY29sb3IgPT09IHBpZWNlLmNvbG9yICYmXHJcbiAgICAgICAgc3RhdGUudHVybkNvbG9yID09PSBwaWVjZS5jb2xvclxyXG4gICAgKSk7XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBpc1ByZW1vdmFibGUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXkpOiBib29sZWFuIHtcclxuICBjb25zdCBwaWVjZSA9IHN0YXRlLnBpZWNlc1tvcmlnXTtcclxuICByZXR1cm4gcGllY2UgJiYgc3RhdGUucHJlbW92YWJsZS5lbmFibGVkICYmXHJcbiAgc3RhdGUubW92YWJsZS5jb2xvciA9PT0gcGllY2UuY29sb3IgJiZcclxuICAgIHN0YXRlLnR1cm5Db2xvciAhPT0gcGllY2UuY29sb3I7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNhblByZW1vdmUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiBvcmlnICE9PSBkZXN0ICYmXHJcbiAgaXNQcmVtb3ZhYmxlKHN0YXRlLCBvcmlnKSAmJlxyXG4gIGNvbnRhaW5zWChwcmVtb3ZlKHN0YXRlLnBpZWNlcywgb3JpZywgc3RhdGUucHJlbW92YWJsZS5jYXN0bGUpLCBkZXN0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gY2FuUHJlZHJvcChzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogYm9vbGVhbiB7XHJcbiAgY29uc3QgcGllY2UgPSBzdGF0ZS5waWVjZXNbb3JpZ107XHJcbiAgcmV0dXJuIHBpZWNlICYmIGRlc3QgJiZcclxuICAoIXN0YXRlLnBpZWNlc1tkZXN0XSB8fCBzdGF0ZS5waWVjZXNbZGVzdF0uY29sb3IgIT09IHN0YXRlLm1vdmFibGUuY29sb3IpICYmXHJcbiAgc3RhdGUucHJlZHJvcHBhYmxlLmVuYWJsZWQgJiZcclxuICAocGllY2Uucm9sZSAhPT0gJ3Bhd24nIHx8IChkZXN0WzFdICE9PSAnMScgJiYgZGVzdFsxXSAhPT0gJzgnKSkgJiZcclxuICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID09PSBwaWVjZS5jb2xvciAmJlxyXG4gICAgc3RhdGUudHVybkNvbG9yICE9PSBwaWVjZS5jb2xvcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzRHJhZ2dhYmxlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5KTogYm9vbGVhbiB7XHJcbiAgY29uc3QgcGllY2UgPSBzdGF0ZS5waWVjZXNbb3JpZ107XHJcbiAgcmV0dXJuIHBpZWNlICYmIHN0YXRlLmRyYWdnYWJsZS5lbmFibGVkICYmIChcclxuICAgIHN0YXRlLm1vdmFibGUuY29sb3IgPT09ICdib3RoJyB8fCAoXHJcbiAgICAgIHN0YXRlLm1vdmFibGUuY29sb3IgPT09IHBpZWNlLmNvbG9yICYmIChcclxuICAgICAgICBzdGF0ZS50dXJuQ29sb3IgPT09IHBpZWNlLmNvbG9yIHx8IHN0YXRlLnByZW1vdmFibGUuZW5hYmxlZFxyXG4gICAgICApXHJcbiAgICApXHJcbiAgKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBsYXlQcmVtb3ZlKHN0YXRlOiBTdGF0ZSk6IGJvb2xlYW4ge1xyXG4gIGNvbnN0IG1vdmUgPSBzdGF0ZS5wcmVtb3ZhYmxlLmN1cnJlbnQ7XHJcbiAgaWYgKCFtb3ZlKSByZXR1cm4gZmFsc2U7XHJcbiAgY29uc3Qgb3JpZyA9IG1vdmVbMF0sIGRlc3QgPSBtb3ZlWzFdO1xyXG4gIGxldCBzdWNjZXNzID0gZmFsc2U7XHJcbiAgaWYgKGNhbk1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpKSB7XHJcbiAgICBjb25zdCByZXN1bHQgPSBiYXNlVXNlck1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpO1xyXG4gICAgaWYgKHJlc3VsdCkge1xyXG4gICAgICBjb25zdCBtZXRhZGF0YTogY2cuTW92ZU1ldGFkYXRhID0geyBwcmVtb3ZlOiB0cnVlIH07XHJcbiAgICAgIGlmIChyZXN1bHQgIT09IHRydWUpIG1ldGFkYXRhLmNhcHR1cmVkID0gcmVzdWx0O1xyXG4gICAgICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLm1vdmFibGUuZXZlbnRzLmFmdGVyLCBvcmlnLCBkZXN0LCBtZXRhZGF0YSk7XHJcbiAgICAgIHN1Y2Nlc3MgPSB0cnVlO1xyXG4gICAgfVxyXG4gIH1cclxuICB1bnNldFByZW1vdmUoc3RhdGUpO1xyXG4gIHJldHVybiBzdWNjZXNzO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGxheVByZWRyb3Aoc3RhdGU6IFN0YXRlLCB2YWxpZGF0ZTogKGRyb3A6IGNnLkRyb3ApID0+IGJvb2xlYW4pOiBib29sZWFuIHtcclxuICBsZXQgZHJvcCA9IHN0YXRlLnByZWRyb3BwYWJsZS5jdXJyZW50LFxyXG4gIHN1Y2Nlc3MgPSBmYWxzZTtcclxuICBpZiAoIWRyb3ApIHJldHVybiBmYWxzZTtcclxuICBpZiAodmFsaWRhdGUoZHJvcCkpIHtcclxuICAgIGNvbnN0IHBpZWNlID0ge1xyXG4gICAgICByb2xlOiBkcm9wLnJvbGUsXHJcbiAgICAgIGNvbG9yOiBzdGF0ZS5tb3ZhYmxlLmNvbG9yXHJcbiAgICB9IGFzIGNnLlBpZWNlO1xyXG4gICAgaWYgKGJhc2VOZXdQaWVjZShzdGF0ZSwgcGllY2UsIGRyb3Aua2V5KSkge1xyXG4gICAgICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLm1vdmFibGUuZXZlbnRzLmFmdGVyTmV3UGllY2UsIGRyb3Aucm9sZSwgZHJvcC5rZXksIHtcclxuICAgICAgICBwcmVkcm9wOiB0cnVlXHJcbiAgICAgIH0pO1xyXG4gICAgICBzdWNjZXNzID0gdHJ1ZTtcclxuICAgIH1cclxuICB9XHJcbiAgdW5zZXRQcmVkcm9wKHN0YXRlKTtcclxuICByZXR1cm4gc3VjY2VzcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNhbmNlbE1vdmUoc3RhdGU6IFN0YXRlKTogdm9pZCB7XHJcbiAgdW5zZXRQcmVtb3ZlKHN0YXRlKTtcclxuICB1bnNldFByZWRyb3Aoc3RhdGUpO1xyXG4gIHVuc2VsZWN0KHN0YXRlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHN0b3Aoc3RhdGU6IFN0YXRlKTogdm9pZCB7XHJcbiAgc3RhdGUubW92YWJsZS5jb2xvciA9XHJcbiAgc3RhdGUubW92YWJsZS5kZXN0cyA9XHJcbiAgc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQgPSB1bmRlZmluZWQ7XHJcbiAgY2FuY2VsTW92ZShzdGF0ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRLZXlBdERvbVBvcyhwb3M6IGNnLk51bWJlclBhaXIsIGFzV2hpdGU6IGJvb2xlYW4sIGJvdW5kczogQ2xpZW50UmVjdCk6IGNnLktleSB8IHVuZGVmaW5lZCB7XHJcbiAgbGV0IGZpbGUgPSBNYXRoLmNlaWwoOCAqICgocG9zWzBdIC0gYm91bmRzLmxlZnQpIC8gYm91bmRzLndpZHRoKSk7XHJcbiAgaWYgKCFhc1doaXRlKSBmaWxlID0gOSAtIGZpbGU7XHJcbiAgbGV0IHJhbmsgPSBNYXRoLmNlaWwoOCAtICg4ICogKChwb3NbMV0gLSBib3VuZHMudG9wKSAvIGJvdW5kcy5oZWlnaHQpKSk7XHJcbiAgaWYgKCFhc1doaXRlKSByYW5rID0gOSAtIHJhbms7XHJcbiAgcmV0dXJuIChmaWxlID4gMCAmJiBmaWxlIDwgOSAmJiByYW5rID4gMCAmJiByYW5rIDwgOSkgPyBwb3Mya2V5KFtmaWxlLCByYW5rXSkgOiB1bmRlZmluZWQ7XHJcbn1cclxuIiwiaW1wb3J0IHsgQXBpLCBzdGFydCB9IGZyb20gJy4vYXBpJ1xyXG5pbXBvcnQgeyBDb25maWcsIGNvbmZpZ3VyZSB9IGZyb20gJy4vY29uZmlnJ1xyXG5pbXBvcnQgeyBTdGF0ZSwgZGVmYXVsdHMgfSBmcm9tICcuL3N0YXRlJ1xyXG5cclxuaW1wb3J0IHJlbmRlcldyYXAgZnJvbSAnLi93cmFwJztcclxuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJy4vZXZlbnRzJ1xyXG5pbXBvcnQgcmVuZGVyIGZyb20gJy4vcmVuZGVyJztcclxuaW1wb3J0ICogYXMgc3ZnIGZyb20gJy4vc3ZnJztcclxuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIENoZXNzZ3JvdW5kKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjb25maWc/OiBDb25maWcpOiBBcGkge1xyXG5cclxuICBjb25zdCBzdGF0ZSA9IGRlZmF1bHRzKCkgYXMgU3RhdGU7XHJcblxyXG4gIGNvbmZpZ3VyZShzdGF0ZSwgY29uZmlnIHx8IHt9KTtcclxuXHJcbiAgZnVuY3Rpb24gcmVkcmF3QWxsKCkge1xyXG4gICAgbGV0IHByZXZVbmJpbmQgPSBzdGF0ZS5kb20gJiYgc3RhdGUuZG9tLnVuYmluZDtcclxuICAgIC8vIGZpcnN0IGVuc3VyZSB0aGUgY2ctYm9hcmQtd3JhcCBjbGFzcyBpcyBzZXRcclxuICAgIC8vIHNvIGJvdW5kcyBjYWxjdWxhdGlvbiBjYW4gdXNlIHRoZSBDU1Mgd2lkdGgvaGVpZ2h0IHZhbHVlc1xyXG4gICAgLy8gYWRkIHRoYXQgY2xhc3MgeW91cnNlbGYgdG8gdGhlIGVsZW1lbnQgYmVmb3JlIGNhbGxpbmcgY2hlc3Nncm91bmRcclxuICAgIC8vIGZvciBhIHNsaWdodCBwZXJmb3JtYW5jZSBpbXByb3ZlbWVudCEgKGF2b2lkcyByZWNvbXB1dGluZyBzdHlsZSlcclxuICAgIGVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnY2ctYm9hcmQtd3JhcCcpO1xyXG4gICAgLy8gY29tcHV0ZSBib3VuZHMgZnJvbSBleGlzdGluZyBib2FyZCBlbGVtZW50IGlmIHBvc3NpYmxlXHJcbiAgICAvLyB0aGlzIGFsbG93cyBub24tc3F1YXJlIGJvYXJkcyBmcm9tIENTUyB0byBiZSBoYW5kbGVkIChmb3IgM0QpXHJcbiAgICBjb25zdCBib3VuZHMgPSB1dGlsLm1lbW8oKCkgPT4gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSk7XHJcbiAgICBjb25zdCByZWxhdGl2ZSA9IHN0YXRlLnZpZXdPbmx5ICYmICFzdGF0ZS5kcmF3YWJsZS52aXNpYmxlO1xyXG4gICAgY29uc3QgZWxlbWVudHMgPSByZW5kZXJXcmFwKGVsZW1lbnQsIHN0YXRlLCByZWxhdGl2ZSA/IHVuZGVmaW5lZCA6IGJvdW5kcygpKTtcclxuICAgIGNvbnN0IHJlZHJhd05vdyA9IChza2lwU3ZnOiBib29sZWFuKSA9PiB7XHJcbiAgICAgIHJlbmRlcihzdGF0ZSk7XHJcbiAgICAgIGlmICghc2tpcFN2ZyAmJiBlbGVtZW50cy5zdmcpIHN2Zy5yZW5kZXJTdmcoc3RhdGUsIGVsZW1lbnRzLnN2Zyk7XHJcbiAgICB9O1xyXG4gICAgc3RhdGUuZG9tID0ge1xyXG4gICAgICBlbGVtZW50czogZWxlbWVudHMsXHJcbiAgICAgIGJvdW5kczogYm91bmRzLFxyXG4gICAgICByZWRyYXc6IGRlYm91bmNlUmVkcmF3KHJlZHJhd05vdyksXHJcbiAgICAgIHJlZHJhd05vdzogcmVkcmF3Tm93LFxyXG4gICAgICB1bmJpbmQ6IHByZXZVbmJpbmQsXHJcbiAgICAgIHJlbGF0aXZlXHJcbiAgICB9O1xyXG4gICAgc3RhdGUuZHJhd2FibGUucHJldlN2Z0hhc2ggPSAnJztcclxuICAgIHJlZHJhd05vdyhmYWxzZSk7XHJcbiAgICBldmVudHMuYmluZEJvYXJkKHN0YXRlKTtcclxuICAgIGlmICghcHJldlVuYmluZCkgc3RhdGUuZG9tLnVuYmluZCA9IGV2ZW50cy5iaW5kRG9jdW1lbnQoc3RhdGUsIHJlZHJhd0FsbCk7XHJcbiAgfVxyXG4gIHJlZHJhd0FsbCgpO1xyXG5cclxuICBjb25zdCBhcGkgPSBzdGFydChzdGF0ZSwgcmVkcmF3QWxsKTtcclxuXHJcbiAgcmV0dXJuIGFwaTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIGRlYm91bmNlUmVkcmF3KHJlZHJhd05vdzogKHNraXBTdmc/OiBib29sZWFuKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XHJcbiAgbGV0IHJlZHJhd2luZyA9IGZhbHNlO1xyXG4gIHJldHVybiAoKSA9PiB7XHJcbiAgICBpZiAocmVkcmF3aW5nKSByZXR1cm47XHJcbiAgICByZWRyYXdpbmcgPSB0cnVlO1xyXG4gICAgdXRpbC5yYWYoKCkgPT4ge1xyXG4gICAgICByZWRyYXdOb3coKTtcclxuICAgICAgcmVkcmF3aW5nID0gZmFsc2U7XHJcbiAgICB9KTtcclxuICB9O1xyXG59XHJcbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcclxuaW1wb3J0IHsgc2V0Q2hlY2ssIHNldFNlbGVjdGVkIH0gZnJvbSAnLi9ib2FyZCdcclxuaW1wb3J0IHsgcmVhZCBhcyBmZW5SZWFkIH0gZnJvbSAnLi9mZW4nXHJcbmltcG9ydCB7IERyYXdTaGFwZSwgRHJhd0JydXNoIH0gZnJvbSAnLi9kcmF3J1xyXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDb25maWcge1xyXG4gIGZlbj86IGNnLkZFTjsgLy8gY2hlc3MgcG9zaXRpb24gaW4gRm9yc3l0aCBub3RhdGlvblxyXG4gIG9yaWVudGF0aW9uPzogY2cuQ29sb3I7IC8vIGJvYXJkIG9yaWVudGF0aW9uLiB3aGl0ZSB8IGJsYWNrXHJcbiAgdHVybkNvbG9yPzogY2cuQ29sb3I7IC8vIHR1cm4gdG8gcGxheS4gd2hpdGUgfCBibGFja1xyXG4gIGNoZWNrPzogY2cuQ29sb3IgfCBib29sZWFuOyAvLyB0cnVlIGZvciBjdXJyZW50IGNvbG9yLCBmYWxzZSB0byB1bnNldFxyXG4gIGxhc3RNb3ZlPzogY2cuS2V5W107IC8vIHNxdWFyZXMgcGFydCBvZiB0aGUgbGFzdCBtb3ZlIFtcImMzXCIsIFwiYzRcIl1cclxuICBzZWxlY3RlZD86IGNnLktleTsgLy8gc3F1YXJlIGN1cnJlbnRseSBzZWxlY3RlZCBcImExXCJcclxuICBjb29yZGluYXRlcz86IGJvb2xlYW47IC8vIGluY2x1ZGUgY29vcmRzIGF0dHJpYnV0ZXNcclxuICBhdXRvQ2FzdGxlPzogYm9vbGVhbjsgLy8gaW1tZWRpYXRlbHkgY29tcGxldGUgdGhlIGNhc3RsZSBieSBtb3ZpbmcgdGhlIHJvb2sgYWZ0ZXIga2luZyBtb3ZlXHJcbiAgdmlld09ubHk/OiBib29sZWFuOyAvLyBkb24ndCBiaW5kIGV2ZW50czogdGhlIHVzZXIgd2lsbCBuZXZlciBiZSBhYmxlIHRvIG1vdmUgcGllY2VzIGFyb3VuZFxyXG4gIGRpc2FibGVDb250ZXh0TWVudT86IGJvb2xlYW47IC8vIGJlY2F1c2Ugd2hvIG5lZWRzIGEgY29udGV4dCBtZW51IG9uIGEgY2hlc3Nib2FyZFxyXG4gIHJlc2l6YWJsZT86IGJvb2xlYW47IC8vIGxpc3RlbnMgdG8gY2hlc3Nncm91bmQucmVzaXplIG9uIGRvY3VtZW50LmJvZHkgdG8gY2xlYXIgYm91bmRzIGNhY2hlXHJcbiAgYWRkUGllY2VaSW5kZXg/OiBib29sZWFuOyAvLyBhZGRzIHotaW5kZXggdmFsdWVzIHRvIHBpZWNlcyAoZm9yIDNEKVxyXG4gIC8vIHBpZWNlS2V5OiBib29sZWFuOyAvLyBhZGQgYSBkYXRhLWtleSBhdHRyaWJ1dGUgdG8gcGllY2UgZWxlbWVudHNcclxuICBoaWdobGlnaHQ/OiB7XHJcbiAgICBsYXN0TW92ZT86IGJvb2xlYW47IC8vIGFkZCBsYXN0LW1vdmUgY2xhc3MgdG8gc3F1YXJlc1xyXG4gICAgY2hlY2s/OiBib29sZWFuOyAvLyBhZGQgY2hlY2sgY2xhc3MgdG8gc3F1YXJlc1xyXG4gIH07XHJcbiAgYW5pbWF0aW9uPzoge1xyXG4gICAgZW5hYmxlZD86IGJvb2xlYW47XHJcbiAgICBkdXJhdGlvbj86IG51bWJlcjtcclxuICB9O1xyXG4gIG1vdmFibGU/OiB7XHJcbiAgICBmcmVlPzogYm9vbGVhbjsgLy8gYWxsIG1vdmVzIGFyZSB2YWxpZCAtIGJvYXJkIGVkaXRvclxyXG4gICAgY29sb3I/OiBjZy5Db2xvciB8ICdib3RoJzsgLy8gY29sb3IgdGhhdCBjYW4gbW92ZS4gd2hpdGUgfCBibGFjayB8IGJvdGggfCB1bmRlZmluZWRcclxuICAgIGRlc3RzPzoge1xyXG4gICAgICBba2V5OiBzdHJpbmddOiBjZy5LZXlbXVxyXG4gICAgfTsgLy8gdmFsaWQgbW92ZXMuIHtcImEyXCIgW1wiYTNcIiBcImE0XCJdIFwiYjFcIiBbXCJhM1wiIFwiYzNcIl19XHJcbiAgICBzaG93RGVzdHM/OiBib29sZWFuOyAvLyB3aGV0aGVyIHRvIGFkZCB0aGUgbW92ZS1kZXN0IGNsYXNzIG9uIHNxdWFyZXNcclxuICAgIGV2ZW50cz86IHtcclxuICAgICAgYWZ0ZXI/OiAob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIG1ldGFkYXRhOiBjZy5Nb3ZlTWV0YWRhdGEpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgbW92ZSBoYXMgYmVlbiBwbGF5ZWRcclxuICAgICAgYWZ0ZXJOZXdQaWVjZT86IChyb2xlOiBjZy5Sb2xlLCBrZXk6IGNnLktleSwgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIGEgbmV3IHBpZWNlIGlzIGRyb3BwZWQgb24gdGhlIGJvYXJkXHJcbiAgICB9O1xyXG4gICAgcm9va0Nhc3RsZT86IGJvb2xlYW4gLy8gY2FzdGxlIGJ5IG1vdmluZyB0aGUga2luZyB0byB0aGUgcm9va1xyXG4gIH07XHJcbiAgcHJlbW92YWJsZT86IHtcclxuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBhbGxvdyBwcmVtb3ZlcyBmb3IgY29sb3IgdGhhdCBjYW4gbm90IG1vdmVcclxuICAgIHNob3dEZXN0cz86IGJvb2xlYW47IC8vIHdoZXRoZXIgdG8gYWRkIHRoZSBwcmVtb3ZlLWRlc3QgY2xhc3Mgb24gc3F1YXJlc1xyXG4gICAgY2FzdGxlPzogYm9vbGVhbjsgLy8gd2hldGhlciB0byBhbGxvdyBraW5nIGNhc3RsZSBwcmVtb3Zlc1xyXG4gICAgZGVzdHM/OiBjZy5LZXlbXTsgLy8gcHJlbW92ZSBkZXN0aW5hdGlvbnMgZm9yIHRoZSBjdXJyZW50IHNlbGVjdGlvblxyXG4gICAgZXZlbnRzPzoge1xyXG4gICAgICBzZXQ/OiAob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIG1ldGFkYXRhPzogY2cuU2V0UHJlbW92ZU1ldGFkYXRhKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZW1vdmUgaGFzIGJlZW4gc2V0XHJcbiAgICAgIHVuc2V0PzogKCkgPT4gdm9pZDsgIC8vIGNhbGxlZCBhZnRlciB0aGUgcHJlbW92ZSBoYXMgYmVlbiB1bnNldFxyXG4gICAgfVxyXG4gIH07XHJcbiAgcHJlZHJvcHBhYmxlPzoge1xyXG4gICAgZW5hYmxlZD86IGJvb2xlYW47IC8vIGFsbG93IHByZWRyb3BzIGZvciBjb2xvciB0aGF0IGNhbiBub3QgbW92ZVxyXG4gICAgZXZlbnRzPzoge1xyXG4gICAgICBzZXQ/OiAocm9sZTogY2cuUm9sZSwga2V5OiBjZy5LZXkpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgcHJlZHJvcCBoYXMgYmVlbiBzZXRcclxuICAgICAgdW5zZXQ/OiAoKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZWRyb3AgaGFzIGJlZW4gdW5zZXRcclxuICAgIH1cclxuICB9O1xyXG4gIGRyYWdnYWJsZT86IHtcclxuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBhbGxvdyBtb3ZlcyAmIHByZW1vdmVzIHRvIHVzZSBkcmFnJ24gZHJvcFxyXG4gICAgZGlzdGFuY2U/OiBudW1iZXI7IC8vIG1pbmltdW0gZGlzdGFuY2UgdG8gaW5pdGlhdGUgYSBkcmFnOyBpbiBwaXhlbHNcclxuICAgIGF1dG9EaXN0YW5jZT86IGJvb2xlYW47IC8vIGxldHMgY2hlc3Nncm91bmQgc2V0IGRpc3RhbmNlIHRvIHplcm8gd2hlbiB1c2VyIGRyYWdzIHBpZWNlc1xyXG4gICAgY2VudGVyUGllY2U/OiBib29sZWFuOyAvLyBjZW50ZXIgdGhlIHBpZWNlIG9uIGN1cnNvciBhdCBkcmFnIHN0YXJ0XHJcbiAgICBzaG93R2hvc3Q/OiBib29sZWFuOyAvLyBzaG93IGdob3N0IG9mIHBpZWNlIGJlaW5nIGRyYWdnZWRcclxuICAgIGRlbGV0ZU9uRHJvcE9mZj86IGJvb2xlYW47IC8vIGRlbGV0ZSBhIHBpZWNlIHdoZW4gaXQgaXMgZHJvcHBlZCBvZmYgdGhlIGJvYXJkXHJcbiAgfTtcclxuICBzZWxlY3RhYmxlPzoge1xyXG4gICAgLy8gZGlzYWJsZSB0byBlbmZvcmNlIGRyYWdnaW5nIG92ZXIgY2xpY2stY2xpY2sgbW92ZVxyXG4gICAgZW5hYmxlZD86IGJvb2xlYW5cclxuICB9O1xyXG4gIGV2ZW50cz86IHtcclxuICAgIGNoYW5nZT86ICgpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgc2l0dWF0aW9uIGNoYW5nZXMgb24gdGhlIGJvYXJkXHJcbiAgICAvLyBjYWxsZWQgYWZ0ZXIgYSBwaWVjZSBoYXMgYmVlbiBtb3ZlZC5cclxuICAgIC8vIGNhcHR1cmVkUGllY2UgaXMgdW5kZWZpbmVkIG9yIGxpa2Uge2NvbG9yOiAnd2hpdGUnOyAncm9sZSc6ICdxdWVlbid9XHJcbiAgICBtb3ZlPzogKG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5LCBjYXB0dXJlZFBpZWNlPzogY2cuUGllY2UpID0+IHZvaWQ7XHJcbiAgICBkcm9wTmV3UGllY2U/OiAocGllY2U6IGNnLlBpZWNlLCBrZXk6IGNnLktleSkgPT4gdm9pZDtcclxuICAgIHNlbGVjdD86IChrZXk6IGNnLktleSkgPT4gdm9pZCAvLyBjYWxsZWQgd2hlbiBhIHNxdWFyZSBpcyBzZWxlY3RlZFxyXG4gIH07XHJcbiAgaXRlbXM/OiAocG9zOiBjZy5Qb3MsIGtleTogY2cuS2V5KSA9PiBhbnkgfCB1bmRlZmluZWQ7IC8vIGl0ZW1zIG9uIHRoZSBib2FyZCB7IHJlbmRlcjoga2V5IC0+IHZkb20gfVxyXG4gIGRyYXdhYmxlPzoge1xyXG4gICAgZW5hYmxlZD86IGJvb2xlYW47IC8vIGNhbiBkcmF3XHJcbiAgICB2aXNpYmxlPzogYm9vbGVhbjsgLy8gY2FuIHZpZXdcclxuICAgIGVyYXNlT25DbGljaz86IGJvb2xlYW47XHJcbiAgICBzaGFwZXM/OiBEcmF3U2hhcGVbXTtcclxuICAgIGF1dG9TaGFwZXM/OiBEcmF3U2hhcGVbXTtcclxuICAgIGJydXNoZXM/OiBEcmF3QnJ1c2hbXTtcclxuICAgIHBpZWNlcz86IHtcclxuICAgICAgYmFzZVVybD86IHN0cmluZztcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjb25maWd1cmUoc3RhdGU6IFN0YXRlLCBjb25maWc6IENvbmZpZykge1xyXG5cclxuICAvLyBkb24ndCBtZXJnZSBkZXN0aW5hdGlvbnMuIEp1c3Qgb3ZlcnJpZGUuXHJcbiAgaWYgKGNvbmZpZy5tb3ZhYmxlICYmIGNvbmZpZy5tb3ZhYmxlLmRlc3RzKSBzdGF0ZS5tb3ZhYmxlLmRlc3RzID0gdW5kZWZpbmVkO1xyXG5cclxuICBtZXJnZShzdGF0ZSwgY29uZmlnKTtcclxuXHJcbiAgLy8gaWYgYSBmZW4gd2FzIHByb3ZpZGVkLCByZXBsYWNlIHRoZSBwaWVjZXNcclxuICBpZiAoY29uZmlnLmZlbikge1xyXG4gICAgc3RhdGUucGllY2VzID0gZmVuUmVhZChjb25maWcuZmVuKTtcclxuICAgIHN0YXRlLmRyYXdhYmxlLnNoYXBlcyA9IFtdO1xyXG4gIH1cclxuXHJcbiAgLy8gYXBwbHkgY29uZmlnIHZhbHVlcyB0aGF0IGNvdWxkIGJlIHVuZGVmaW5lZCB5ZXQgbWVhbmluZ2Z1bFxyXG4gIGlmIChjb25maWcuaGFzT3duUHJvcGVydHkoJ2NoZWNrJykpIHNldENoZWNrKHN0YXRlLCBjb25maWcuY2hlY2sgfHwgZmFsc2UpO1xyXG4gIGlmIChjb25maWcuaGFzT3duUHJvcGVydHkoJ2xhc3RNb3ZlJykgJiYgIWNvbmZpZy5sYXN0TW92ZSkgc3RhdGUubGFzdE1vdmUgPSB1bmRlZmluZWQ7XHJcbiAgLy8gaW4gY2FzZSBvZiBaSCBkcm9wIGxhc3QgbW92ZSwgdGhlcmUncyBhIHNpbmdsZSBzcXVhcmUuXHJcbiAgLy8gaWYgdGhlIHByZXZpb3VzIGxhc3QgbW92ZSBoYWQgdHdvIHNxdWFyZXMsXHJcbiAgLy8gdGhlIG1lcmdlIGFsZ29yaXRobSB3aWxsIGluY29ycmVjdGx5IGtlZXAgdGhlIHNlY29uZCBzcXVhcmUuXHJcbiAgZWxzZSBpZiAoY29uZmlnLmxhc3RNb3ZlKSBzdGF0ZS5sYXN0TW92ZSA9IGNvbmZpZy5sYXN0TW92ZTtcclxuXHJcbiAgLy8gZml4IG1vdmUvcHJlbW92ZSBkZXN0c1xyXG4gIGlmIChzdGF0ZS5zZWxlY3RlZCkgc2V0U2VsZWN0ZWQoc3RhdGUsIHN0YXRlLnNlbGVjdGVkKTtcclxuXHJcbiAgLy8gbm8gbmVlZCBmb3Igc3VjaCBzaG9ydCBhbmltYXRpb25zXHJcbiAgaWYgKCFzdGF0ZS5hbmltYXRpb24uZHVyYXRpb24gfHwgc3RhdGUuYW5pbWF0aW9uLmR1cmF0aW9uIDwgMTAwKSBzdGF0ZS5hbmltYXRpb24uZW5hYmxlZCA9IGZhbHNlO1xyXG5cclxuICBpZiAoIXN0YXRlLm1vdmFibGUucm9va0Nhc3RsZSAmJiBzdGF0ZS5tb3ZhYmxlLmRlc3RzKSB7XHJcbiAgICBjb25zdCByYW5rID0gc3RhdGUubW92YWJsZS5jb2xvciA9PT0gJ3doaXRlJyA/IDEgOiA4O1xyXG4gICAgY29uc3Qga2luZ1N0YXJ0UG9zID0gJ2UnICsgcmFuaztcclxuICAgIGNvbnN0IGRlc3RzID0gc3RhdGUubW92YWJsZS5kZXN0c1traW5nU3RhcnRQb3NdO1xyXG4gICAgaWYgKCFkZXN0cyB8fCBzdGF0ZS5waWVjZXNba2luZ1N0YXJ0UG9zXS5yb2xlICE9PSAna2luZycpIHJldHVybjtcclxuICAgIHN0YXRlLm1vdmFibGUuZGVzdHNba2luZ1N0YXJ0UG9zXSA9IGRlc3RzLmZpbHRlcihkID0+XHJcbiAgICAgICEoKGQgPT09ICdhJyArIHJhbmspICYmIGRlc3RzLmluZGV4T2YoJ2MnICsgcmFuayBhcyBjZy5LZXkpICE9PSAtMSkgJiZcclxuICAgICAgICAhKChkID09PSAnaCcgKyByYW5rKSAmJiBkZXN0cy5pbmRleE9mKCdnJyArIHJhbmsgYXMgY2cuS2V5KSAhPT0gLTEpXHJcbiAgICApO1xyXG4gIH1cclxufTtcclxuXHJcbmZ1bmN0aW9uIG1lcmdlKGJhc2U6IGFueSwgZXh0ZW5kOiBhbnkpIHtcclxuICBmb3IgKHZhciBrZXkgaW4gZXh0ZW5kKSB7XHJcbiAgICBpZiAoaXNPYmplY3QoYmFzZVtrZXldKSAmJiBpc09iamVjdChleHRlbmRba2V5XSkpIG1lcmdlKGJhc2Vba2V5XSwgZXh0ZW5kW2tleV0pO1xyXG4gICAgZWxzZSBiYXNlW2tleV0gPSBleHRlbmRba2V5XTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzT2JqZWN0KG86IGFueSk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiB0eXBlb2YgbyA9PT0gJ29iamVjdCc7XHJcbn1cclxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xyXG5pbXBvcnQgKiBhcyBib2FyZCBmcm9tICcuL2JvYXJkJ1xyXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCdcclxuaW1wb3J0IHsgY2xlYXIgYXMgZHJhd0NsZWFyIH0gZnJvbSAnLi9kcmF3J1xyXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xyXG5pbXBvcnQgeyBhbmltIH0gZnJvbSAnLi9hbmltJ1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEcmFnQ3VycmVudCB7XHJcbiAgb3JpZzogY2cuS2V5OyAvLyBvcmlnIGtleSBvZiBkcmFnZ2luZyBwaWVjZVxyXG4gIG9yaWdQb3M6IGNnLlBvcztcclxuICBwaWVjZTogY2cuUGllY2U7XHJcbiAgcmVsOiBjZy5OdW1iZXJQYWlyOyAvLyB4OyB5IG9mIHRoZSBwaWVjZSBhdCBvcmlnaW5hbCBwb3NpdGlvblxyXG4gIGVwb3M6IGNnLk51bWJlclBhaXI7IC8vIGluaXRpYWwgZXZlbnQgcG9zaXRpb25cclxuICBwb3M6IGNnLk51bWJlclBhaXI7IC8vIHJlbGF0aXZlIGN1cnJlbnQgcG9zaXRpb25cclxuICBkZWM6IGNnLk51bWJlclBhaXI7IC8vIHBpZWNlIGNlbnRlciBkZWNheVxyXG4gIG92ZXI/OiBjZy5LZXk7IC8vIHNxdWFyZSBiZWluZyBtb3VzZWQgb3ZlclxyXG4gIG92ZXJQcmV2PzogY2cuS2V5OyAvLyBzcXVhcmUgcHJldmlvdXNseSBtb3VzZWQgb3ZlclxyXG4gIHN0YXJ0ZWQ6IGJvb2xlYW47IC8vIHdoZXRoZXIgdGhlIGRyYWcgaGFzIHN0YXJ0ZWQ7IGFzIHBlciB0aGUgZGlzdGFuY2Ugc2V0dGluZ1xyXG4gIGVsZW1lbnQ6IGNnLlBpZWNlTm9kZSB8ICgoKSA9PiBjZy5QaWVjZU5vZGUgfCB1bmRlZmluZWQpO1xyXG4gIG5ld1BpZWNlPzogYm9vbGVhbjsgLy8gaXQgaXQgYSBuZXcgcGllY2UgZnJvbSBvdXRzaWRlIHRoZSBib2FyZFxyXG4gIGZvcmNlPzogYm9vbGVhbjsgLy8gY2FuIHRoZSBuZXcgcGllY2UgcmVwbGFjZSBhbiBleGlzdGluZyBvbmUgKGVkaXRvcilcclxuICBwcmV2aW91c2x5U2VsZWN0ZWQ/OiBjZy5LZXk7XHJcbiAgb3JpZ2luVGFyZ2V0OiBFdmVudFRhcmdldDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0KHM6IFN0YXRlLCBlOiBjZy5Nb3VjaEV2ZW50KTogdm9pZCB7XHJcbiAgaWYgKGUuYnV0dG9uICE9PSB1bmRlZmluZWQgJiYgZS5idXR0b24gIT09IDApIHJldHVybjsgLy8gb25seSB0b3VjaCBvciBsZWZ0IGNsaWNrXHJcbiAgaWYgKGUudG91Y2hlcyAmJiBlLnRvdWNoZXMubGVuZ3RoID4gMSkgcmV0dXJuOyAvLyBzdXBwb3J0IG9uZSBmaW5nZXIgdG91Y2ggb25seVxyXG4gIGUucHJldmVudERlZmF1bHQoKTtcclxuICBjb25zdCBhc1doaXRlID0gcy5vcmllbnRhdGlvbiA9PT0gJ3doaXRlJyxcclxuICBib3VuZHMgPSBzLmRvbS5ib3VuZHMoKSxcclxuICBwb3NpdGlvbiA9IHV0aWwuZXZlbnRQb3NpdGlvbihlKSBhcyBjZy5OdW1iZXJQYWlyLFxyXG4gIG9yaWcgPSBib2FyZC5nZXRLZXlBdERvbVBvcyhwb3NpdGlvbiwgYXNXaGl0ZSwgYm91bmRzKTtcclxuICBpZiAoIW9yaWcpIHJldHVybjtcclxuICBjb25zdCBwaWVjZSA9IHMucGllY2VzW29yaWddO1xyXG4gIGNvbnN0IHByZXZpb3VzbHlTZWxlY3RlZCA9IHMuc2VsZWN0ZWQ7XHJcbiAgaWYgKCFwcmV2aW91c2x5U2VsZWN0ZWQgJiYgcy5kcmF3YWJsZS5lbmFibGVkICYmIChcclxuICAgIHMuZHJhd2FibGUuZXJhc2VPbkNsaWNrIHx8ICghcGllY2UgfHwgcGllY2UuY29sb3IgIT09IHMudHVybkNvbG9yKVxyXG4gICkpIGRyYXdDbGVhcihzKTtcclxuICBjb25zdCBoYWRQcmVtb3ZlID0gISFzLnByZW1vdmFibGUuY3VycmVudDtcclxuICBjb25zdCBoYWRQcmVkcm9wID0gISFzLnByZWRyb3BwYWJsZS5jdXJyZW50O1xyXG4gIHMuc3RhdHMuY3RybEtleSA9IGUuY3RybEtleTtcclxuICBpZiAocy5zZWxlY3RlZCAmJiBib2FyZC5jYW5Nb3ZlKHMsIHMuc2VsZWN0ZWQsIG9yaWcpKSB7XHJcbiAgICBhbmltKHN0YXRlID0+IGJvYXJkLnNlbGVjdFNxdWFyZShzdGF0ZSwgb3JpZyksIHMpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBib2FyZC5zZWxlY3RTcXVhcmUocywgb3JpZyk7XHJcbiAgfVxyXG4gIGNvbnN0IHN0aWxsU2VsZWN0ZWQgPSBzLnNlbGVjdGVkID09PSBvcmlnO1xyXG4gIGNvbnN0IGVsZW1lbnQgPSBwaWVjZUVsZW1lbnRCeUtleShzLCBvcmlnKTtcclxuICBpZiAocGllY2UgJiYgZWxlbWVudCAmJiBzdGlsbFNlbGVjdGVkICYmIGJvYXJkLmlzRHJhZ2dhYmxlKHMsIG9yaWcpKSB7XHJcbiAgICBjb25zdCBzcXVhcmVCb3VuZHMgPSBjb21wdXRlU3F1YXJlQm91bmRzKG9yaWcsIGFzV2hpdGUsIGJvdW5kcyk7XHJcbiAgICBzLmRyYWdnYWJsZS5jdXJyZW50ID0ge1xyXG4gICAgICBvcmlnOiBvcmlnLFxyXG4gICAgICBvcmlnUG9zOiB1dGlsLmtleTJwb3Mob3JpZyksXHJcbiAgICAgIHBpZWNlOiBwaWVjZSxcclxuICAgICAgcmVsOiBwb3NpdGlvbixcclxuICAgICAgZXBvczogcG9zaXRpb24sXHJcbiAgICAgIHBvczogWzAsIDBdLFxyXG4gICAgICBkZWM6IHMuZHJhZ2dhYmxlLmNlbnRlclBpZWNlID8gW1xyXG4gICAgICAgIHBvc2l0aW9uWzBdIC0gKHNxdWFyZUJvdW5kcy5sZWZ0ICsgc3F1YXJlQm91bmRzLndpZHRoIC8gMiksXHJcbiAgICAgICAgcG9zaXRpb25bMV0gLSAoc3F1YXJlQm91bmRzLnRvcCArIHNxdWFyZUJvdW5kcy5oZWlnaHQgLyAyKVxyXG4gICAgICBdIDogWzAsIDBdLFxyXG4gICAgICBzdGFydGVkOiBzLmRyYWdnYWJsZS5hdXRvRGlzdGFuY2UgJiYgcy5zdGF0cy5kcmFnZ2VkLFxyXG4gICAgICBlbGVtZW50OiBlbGVtZW50LFxyXG4gICAgICBwcmV2aW91c2x5U2VsZWN0ZWQ6IHByZXZpb3VzbHlTZWxlY3RlZCxcclxuICAgICAgb3JpZ2luVGFyZ2V0OiBlLnRhcmdldFxyXG4gICAgfTtcclxuICAgIGVsZW1lbnQuY2dEcmFnZ2luZyA9IHRydWU7XHJcbiAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2RyYWdnaW5nJyk7XHJcbiAgICAvLyBwbGFjZSBnaG9zdFxyXG4gICAgY29uc3QgZ2hvc3QgPSBzLmRvbS5lbGVtZW50cy5naG9zdDtcclxuICAgIGlmIChnaG9zdCkge1xyXG4gICAgICBnaG9zdC5jbGFzc05hbWUgPSBgZ2hvc3QgJHtwaWVjZS5jb2xvcn0gJHtwaWVjZS5yb2xlfWA7XHJcbiAgICAgIHV0aWwudHJhbnNsYXRlQWJzKGdob3N0LCB1dGlsLnBvc1RvVHJhbnNsYXRlQWJzKGJvdW5kcykodXRpbC5rZXkycG9zKG9yaWcpLCBhc1doaXRlKSk7XHJcbiAgICB9XHJcbiAgICBwcm9jZXNzRHJhZyhzKTtcclxuICB9IGVsc2Uge1xyXG4gICAgaWYgKGhhZFByZW1vdmUpIGJvYXJkLnVuc2V0UHJlbW92ZShzKTtcclxuICAgIGlmIChoYWRQcmVkcm9wKSBib2FyZC51bnNldFByZWRyb3Aocyk7XHJcbiAgfVxyXG4gIHMuZG9tLnJlZHJhdygpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZHJhZ05ld1BpZWNlKHM6IFN0YXRlLCBwaWVjZTogY2cuUGllY2UsIGU6IGNnLk1vdWNoRXZlbnQsIGZvcmNlPzogYm9vbGVhbik6IHZvaWQge1xyXG5cclxuICBjb25zdCBrZXk6IGNnLktleSA9ICdhMCc7XHJcblxyXG4gIHMucGllY2VzW2tleV0gPSBwaWVjZTtcclxuXHJcbiAgcy5kb20ucmVkcmF3KCk7XHJcblxyXG4gIGNvbnN0IHBvc2l0aW9uID0gdXRpbC5ldmVudFBvc2l0aW9uKGUpIGFzIGNnLk51bWJlclBhaXIsXHJcbiAgYXNXaGl0ZSA9IHMub3JpZW50YXRpb24gPT09ICd3aGl0ZScsXHJcbiAgYm91bmRzID0gcy5kb20uYm91bmRzKCksXHJcbiAgc3F1YXJlQm91bmRzID0gY29tcHV0ZVNxdWFyZUJvdW5kcyhrZXksIGFzV2hpdGUsIGJvdW5kcyk7XHJcblxyXG4gIGNvbnN0IHJlbDogY2cuTnVtYmVyUGFpciA9IFtcclxuICAgIChhc1doaXRlID8gMCA6IDcpICogc3F1YXJlQm91bmRzLndpZHRoICsgYm91bmRzLmxlZnQsXHJcbiAgICAoYXNXaGl0ZSA/IDggOiAtMSkgKiBzcXVhcmVCb3VuZHMuaGVpZ2h0ICsgYm91bmRzLnRvcFxyXG4gIF07XHJcblxyXG4gIHMuZHJhZ2dhYmxlLmN1cnJlbnQgPSB7XHJcbiAgICBvcmlnOiBrZXksXHJcbiAgICBvcmlnUG9zOiB1dGlsLmtleTJwb3Moa2V5KSxcclxuICAgIHBpZWNlOiBwaWVjZSxcclxuICAgIHJlbDogcmVsLFxyXG4gICAgZXBvczogcG9zaXRpb24sXHJcbiAgICBwb3M6IFtwb3NpdGlvblswXSAtIHJlbFswXSwgcG9zaXRpb25bMV0gLSByZWxbMV1dLFxyXG4gICAgZGVjOiBbLXNxdWFyZUJvdW5kcy53aWR0aCAvIDIsIC1zcXVhcmVCb3VuZHMuaGVpZ2h0IC8gMl0sXHJcbiAgICBzdGFydGVkOiB0cnVlLFxyXG4gICAgZWxlbWVudDogKCkgPT4gcGllY2VFbGVtZW50QnlLZXkocywga2V5KSxcclxuICAgIG9yaWdpblRhcmdldDogZS50YXJnZXQsXHJcbiAgICBuZXdQaWVjZTogdHJ1ZSxcclxuICAgIGZvcmNlOiBmb3JjZSB8fCBmYWxzZVxyXG4gIH07XHJcbiAgcHJvY2Vzc0RyYWcocyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByb2Nlc3NEcmFnKHM6IFN0YXRlKTogdm9pZCB7XHJcbiAgdXRpbC5yYWYoKCkgPT4ge1xyXG4gICAgY29uc3QgY3VyID0gcy5kcmFnZ2FibGUuY3VycmVudDtcclxuICAgIGlmICghY3VyKSByZXR1cm47XHJcbiAgICAvLyBjYW5jZWwgYW5pbWF0aW9ucyB3aGlsZSBkcmFnZ2luZ1xyXG4gICAgaWYgKHMuYW5pbWF0aW9uLmN1cnJlbnQgJiYgcy5hbmltYXRpb24uY3VycmVudC5wbGFuLmFuaW1zW2N1ci5vcmlnXSkgcy5hbmltYXRpb24uY3VycmVudCA9IHVuZGVmaW5lZDtcclxuICAgIC8vIGlmIG1vdmluZyBwaWVjZSBpcyBnb25lLCBjYW5jZWxcclxuICAgIGNvbnN0IG9yaWdQaWVjZSA9IHMucGllY2VzW2N1ci5vcmlnXTtcclxuICAgIGlmICghb3JpZ1BpZWNlIHx8ICF1dGlsLnNhbWVQaWVjZShvcmlnUGllY2UsIGN1ci5waWVjZSkpIGNhbmNlbChzKTtcclxuICAgIGVsc2Uge1xyXG4gICAgICBpZiAoIWN1ci5zdGFydGVkICYmIHV0aWwuZGlzdGFuY2VTcShjdXIuZXBvcywgY3VyLnJlbCkgPj0gTWF0aC5wb3cocy5kcmFnZ2FibGUuZGlzdGFuY2UsIDIpKSBjdXIuc3RhcnRlZCA9IHRydWU7XHJcbiAgICAgIGlmIChjdXIuc3RhcnRlZCkge1xyXG5cclxuICAgICAgICAvLyBzdXBwb3J0IGxhenkgZWxlbWVudHNcclxuICAgICAgICBpZiAodHlwZW9mIGN1ci5lbGVtZW50ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICBjb25zdCBmb3VuZCA9IGN1ci5lbGVtZW50KCk7XHJcbiAgICAgICAgICBpZiAoIWZvdW5kKSByZXR1cm47XHJcbiAgICAgICAgICBjdXIuZWxlbWVudCA9IGZvdW5kO1xyXG4gICAgICAgICAgY3VyLmVsZW1lbnQuY2dEcmFnZ2luZyA9IHRydWU7XHJcbiAgICAgICAgICBjdXIuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgYXNXaGl0ZSA9IHMub3JpZW50YXRpb24gPT09ICd3aGl0ZScsXHJcbiAgICAgICAgYm91bmRzID0gcy5kb20uYm91bmRzKCk7XHJcbiAgICAgICAgY3VyLnBvcyA9IFtcclxuICAgICAgICAgIGN1ci5lcG9zWzBdIC0gY3VyLnJlbFswXSxcclxuICAgICAgICAgIGN1ci5lcG9zWzFdIC0gY3VyLnJlbFsxXVxyXG4gICAgICAgIF07XHJcbiAgICAgICAgY3VyLm92ZXIgPSBib2FyZC5nZXRLZXlBdERvbVBvcyhjdXIuZXBvcywgYXNXaGl0ZSwgYm91bmRzKTtcclxuXHJcbiAgICAgICAgLy8gbW92ZSBwaWVjZVxyXG4gICAgICAgIGNvbnN0IHRyYW5zbGF0aW9uID0gdXRpbC5wb3NUb1RyYW5zbGF0ZUFicyhib3VuZHMpKGN1ci5vcmlnUG9zLCBhc1doaXRlKTtcclxuICAgICAgICB0cmFuc2xhdGlvblswXSArPSBjdXIucG9zWzBdICsgY3VyLmRlY1swXTtcclxuICAgICAgICB0cmFuc2xhdGlvblsxXSArPSBjdXIucG9zWzFdICsgY3VyLmRlY1sxXTtcclxuICAgICAgICB1dGlsLnRyYW5zbGF0ZUFicyhjdXIuZWxlbWVudCwgdHJhbnNsYXRpb24pO1xyXG5cclxuICAgICAgICAvLyBtb3ZlIG92ZXIgZWxlbWVudFxyXG4gICAgICAgIGNvbnN0IG92ZXJFbCA9IHMuZG9tLmVsZW1lbnRzLm92ZXI7XHJcbiAgICAgICAgaWYgKG92ZXJFbCAmJiBjdXIub3ZlciAmJiBjdXIub3ZlciAhPT0gY3VyLm92ZXJQcmV2KSB7XHJcbiAgICAgICAgICBjb25zdCBkZXN0cyA9IHMubW92YWJsZS5kZXN0cztcclxuICAgICAgICAgIGlmIChzLm1vdmFibGUuZnJlZSB8fFxyXG4gICAgICAgICAgICB1dGlsLmNvbnRhaW5zWChkZXN0cyAmJiBkZXN0c1tjdXIub3JpZ10sIGN1ci5vdmVyKSB8fFxyXG4gICAgICAgICAgICB1dGlsLmNvbnRhaW5zWChzLnByZW1vdmFibGUuZGVzdHMsIGN1ci5vdmVyKSkge1xyXG4gICAgICAgICAgICBjb25zdCBwb3MgPSB1dGlsLmtleTJwb3MoY3VyLm92ZXIpLFxyXG4gICAgICAgICAgICB2ZWN0b3I6IGNnLk51bWJlclBhaXIgPSBbXHJcbiAgICAgICAgICAgICAgKGFzV2hpdGUgPyBwb3NbMF0gLSAxIDogOCAtIHBvc1swXSkgKiBib3VuZHMud2lkdGggLyA4LFxyXG4gICAgICAgICAgICAgIChhc1doaXRlID8gOCAtIHBvc1sxXSA6IHBvc1sxXSAtIDEpICogYm91bmRzLmhlaWdodCAvIDhcclxuICAgICAgICAgICAgXTtcclxuICAgICAgICAgICAgdXRpbC50cmFuc2xhdGVBYnMob3ZlckVsLCB2ZWN0b3IpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdXRpbC50cmFuc2xhdGVBd2F5KG92ZXJFbCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBjdXIub3ZlclByZXYgPSBjdXIub3ZlcjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHByb2Nlc3NEcmFnKHMpO1xyXG4gIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbW92ZShzOiBTdGF0ZSwgZTogY2cuTW91Y2hFdmVudCk6IHZvaWQge1xyXG4gIC8vIHN1cHBvcnQgb25lIGZpbmdlciB0b3VjaCBvbmx5XHJcbiAgaWYgKHMuZHJhZ2dhYmxlLmN1cnJlbnQgJiYgKCFlLnRvdWNoZXMgfHwgZS50b3VjaGVzLmxlbmd0aCA8IDIpKSB7XHJcbiAgICBzLmRyYWdnYWJsZS5jdXJyZW50LmVwb3MgPSB1dGlsLmV2ZW50UG9zaXRpb24oZSkgYXMgY2cuTnVtYmVyUGFpcjtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBlbmQoczogU3RhdGUsIGU6IGNnLk1vdWNoRXZlbnQpOiB2b2lkIHtcclxuICBjb25zdCBjdXIgPSBzLmRyYWdnYWJsZS5jdXJyZW50O1xyXG4gIGlmICghY3VyKSByZXR1cm47XHJcbiAgLy8gY29tcGFyaW5nIHdpdGggdGhlIG9yaWdpbiB0YXJnZXQgaXMgYW4gZWFzeSB3YXkgdG8gdGVzdCB0aGF0IHRoZSBlbmQgZXZlbnRcclxuICAvLyBoYXMgdGhlIHNhbWUgdG91Y2ggb3JpZ2luXHJcbiAgaWYgKGUudHlwZSA9PT0gJ3RvdWNoZW5kJyAmJiBjdXIgJiYgY3VyLm9yaWdpblRhcmdldCAhPT0gZS50YXJnZXQgJiYgIWN1ci5uZXdQaWVjZSkge1xyXG4gICAgcy5kcmFnZ2FibGUuY3VycmVudCA9IHVuZGVmaW5lZDtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgYm9hcmQudW5zZXRQcmVtb3ZlKHMpO1xyXG4gIGJvYXJkLnVuc2V0UHJlZHJvcChzKTtcclxuICAvLyB0b3VjaGVuZCBoYXMgbm8gcG9zaXRpb247IHNvIHVzZSB0aGUgbGFzdCB0b3VjaG1vdmUgcG9zaXRpb24gaW5zdGVhZFxyXG4gIGNvbnN0IGV2ZW50UG9zOiBjZy5OdW1iZXJQYWlyID0gdXRpbC5ldmVudFBvc2l0aW9uKGUpIHx8IGN1ci5lcG9zO1xyXG4gIGNvbnN0IGRlc3QgPSBib2FyZC5nZXRLZXlBdERvbVBvcyhldmVudFBvcywgcy5vcmllbnRhdGlvbiA9PT0gJ3doaXRlJywgcy5kb20uYm91bmRzKCkpO1xyXG4gIGlmIChkZXN0ICYmIGN1ci5zdGFydGVkKSB7XHJcbiAgICBpZiAoY3VyLm5ld1BpZWNlKSBib2FyZC5kcm9wTmV3UGllY2UocywgY3VyLm9yaWcsIGRlc3QsIGN1ci5mb3JjZSk7XHJcbiAgICBlbHNlIHtcclxuICAgICAgcy5zdGF0cy5jdHJsS2V5ID0gZS5jdHJsS2V5O1xyXG4gICAgICBpZiAoYm9hcmQudXNlck1vdmUocywgY3VyLm9yaWcsIGRlc3QpKSBzLnN0YXRzLmRyYWdnZWQgPSB0cnVlO1xyXG4gICAgfVxyXG4gIH0gZWxzZSBpZiAoY3VyLm5ld1BpZWNlKSB7XHJcbiAgICBkZWxldGUgcy5waWVjZXNbY3VyLm9yaWddO1xyXG4gIH0gZWxzZSBpZiAocy5kcmFnZ2FibGUuZGVsZXRlT25Ecm9wT2ZmKSB7XHJcbiAgICBkZWxldGUgcy5waWVjZXNbY3VyLm9yaWddO1xyXG4gICAgYm9hcmQuY2FsbFVzZXJGdW5jdGlvbihzLmV2ZW50cy5jaGFuZ2UpO1xyXG4gIH1cclxuICBpZiAoY3VyICYmIGN1ci5vcmlnID09PSBjdXIucHJldmlvdXNseVNlbGVjdGVkICYmIChjdXIub3JpZyA9PT0gZGVzdCB8fCAhZGVzdCkpXHJcbiAgICBib2FyZC51bnNlbGVjdChzKTtcclxuICBlbHNlIGlmICghcy5zZWxlY3RhYmxlLmVuYWJsZWQpIGJvYXJkLnVuc2VsZWN0KHMpO1xyXG5cclxuICByZW1vdmVEcmFnRWxlbWVudHMocyk7XHJcblxyXG4gIHMuZHJhZ2dhYmxlLmN1cnJlbnQgPSB1bmRlZmluZWQ7XHJcbiAgcy5kb20ucmVkcmF3KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjYW5jZWwoczogU3RhdGUpOiB2b2lkIHtcclxuICBjb25zdCBjdXIgPSBzLmRyYWdnYWJsZS5jdXJyZW50O1xyXG4gIGlmIChjdXIpIHtcclxuICAgIGlmIChjdXIubmV3UGllY2UpIGRlbGV0ZSBzLnBpZWNlc1tjdXIub3JpZ107XHJcbiAgICBzLmRyYWdnYWJsZS5jdXJyZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgYm9hcmQudW5zZWxlY3Qocyk7XHJcbiAgICByZW1vdmVEcmFnRWxlbWVudHMocyk7XHJcbiAgICBzLmRvbS5yZWRyYXcoKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbW92ZURyYWdFbGVtZW50cyhzOiBTdGF0ZSkge1xyXG4gIGNvbnN0IGUgPSBzLmRvbS5lbGVtZW50cztcclxuICBpZiAoZS5vdmVyKSB1dGlsLnRyYW5zbGF0ZUF3YXkoZS5vdmVyKTtcclxuICBpZiAoZS5naG9zdCkgdXRpbC50cmFuc2xhdGVBd2F5KGUuZ2hvc3QpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjb21wdXRlU3F1YXJlQm91bmRzKGtleTogY2cuS2V5LCBhc1doaXRlOiBib29sZWFuLCBib3VuZHM6IENsaWVudFJlY3QpIHtcclxuICBjb25zdCBwb3MgPSB1dGlsLmtleTJwb3Moa2V5KTtcclxuICBpZiAoIWFzV2hpdGUpIHtcclxuICAgIHBvc1swXSA9IDkgLSBwb3NbMF07XHJcbiAgICBwb3NbMV0gPSA5IC0gcG9zWzFdO1xyXG4gIH1cclxuICByZXR1cm4ge1xyXG4gICAgbGVmdDogYm91bmRzLmxlZnQgKyBib3VuZHMud2lkdGggKiAocG9zWzBdIC0gMSkgLyA4LFxyXG4gICAgdG9wOiBib3VuZHMudG9wICsgYm91bmRzLmhlaWdodCAqICg4IC0gcG9zWzFdKSAvIDgsXHJcbiAgICB3aWR0aDogYm91bmRzLndpZHRoIC8gOCxcclxuICAgIGhlaWdodDogYm91bmRzLmhlaWdodCAvIDhcclxuICB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBwaWVjZUVsZW1lbnRCeUtleShzOiBTdGF0ZSwga2V5OiBjZy5LZXkpOiBjZy5QaWVjZU5vZGUgfCB1bmRlZmluZWQge1xyXG4gIGxldCBlbCA9IHMuZG9tLmVsZW1lbnRzLmJvYXJkLmZpcnN0Q2hpbGQgYXMgY2cuUGllY2VOb2RlO1xyXG4gIHdoaWxlIChlbCkge1xyXG4gICAgaWYgKGVsLmNnS2V5ID09PSBrZXkgJiYgZWwudGFnTmFtZSA9PT0gJ1BJRUNFJykgcmV0dXJuIGVsO1xyXG4gICAgZWwgPSBlbC5uZXh0U2libGluZyBhcyBjZy5QaWVjZU5vZGU7XHJcbiAgfVxyXG4gIHJldHVybiB1bmRlZmluZWQ7XHJcbn1cclxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xyXG5pbXBvcnQgeyBjYW5jZWxNb3ZlLCBnZXRLZXlBdERvbVBvcyB9IGZyb20gJy4vYm9hcmQnXHJcbmltcG9ydCB7IGV2ZW50UG9zaXRpb24sIHJhZiwgaXNSaWdodEJ1dHRvbiB9IGZyb20gJy4vdXRpbCdcclxuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRHJhd1NoYXBlIHtcclxuICBvcmlnOiBjZy5LZXk7XHJcbiAgZGVzdD86IGNnLktleTtcclxuICBicnVzaDogc3RyaW5nO1xyXG4gIG1vZGlmaWVycz86IERyYXdNb2RpZmllcnM7XHJcbiAgcGllY2U/OiBEcmF3U2hhcGVQaWVjZTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEcmF3U2hhcGVQaWVjZSB7XHJcbiAgcm9sZTogY2cuUm9sZTtcclxuICBjb2xvcjogY2cuQ29sb3I7XHJcbiAgc2NhbGU/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRHJhd0JydXNoIHtcclxuICBrZXk6IHN0cmluZztcclxuICBjb2xvcjogc3RyaW5nO1xyXG4gIG9wYWNpdHk6IG51bWJlcjtcclxuICBsaW5lV2lkdGg6IG51bWJlclxyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIERyYXdCcnVzaGVzIHtcclxuICBbbmFtZTogc3RyaW5nXTogRHJhd0JydXNoO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIERyYXdNb2RpZmllcnMge1xyXG4gIGxpbmVXaWR0aD86IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEcmF3YWJsZSB7XHJcbiAgZW5hYmxlZDogYm9vbGVhbjsgLy8gY2FuIGRyYXdcclxuICB2aXNpYmxlOiBib29sZWFuOyAvLyBjYW4gdmlld1xyXG4gIGVyYXNlT25DbGljazogYm9vbGVhbjtcclxuICBvbkNoYW5nZT86IChzaGFwZXM6IERyYXdTaGFwZVtdKSA9PiB2b2lkO1xyXG4gIHNoYXBlczogRHJhd1NoYXBlW107IC8vIHVzZXIgc2hhcGVzXHJcbiAgYXV0b1NoYXBlczogRHJhd1NoYXBlW107IC8vIGNvbXB1dGVyIHNoYXBlc1xyXG4gIGN1cnJlbnQ/OiBEcmF3Q3VycmVudDtcclxuICBicnVzaGVzOiBEcmF3QnJ1c2hlcztcclxuICAvLyBkcmF3YWJsZSBTVkcgcGllY2VzOyB1c2VkIGZvciBjcmF6eWhvdXNlIGRyb3BcclxuICBwaWVjZXM6IHtcclxuICAgIGJhc2VVcmw6IHN0cmluZ1xyXG4gIH0sXHJcbiAgcHJldlN2Z0hhc2g6IHN0cmluZ1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIERyYXdDdXJyZW50IHtcclxuICBvcmlnOiBjZy5LZXk7IC8vIG9yaWcga2V5IG9mIGRyYXdpbmdcclxuICBkZXN0PzogY2cuS2V5OyAvLyBzcXVhcmUgYmVpbmcgbW91c2VkIG92ZXIsIGlmICE9IG9yaWdcclxuICBkZXN0UHJldj86IGNnLktleTsgLy8gc3F1YXJlIHByZXZpb3VzbHkgbW91c2VkIG92ZXJcclxuICBwb3M6IGNnLk51bWJlclBhaXI7IC8vIHJlbGF0aXZlIGN1cnJlbnQgcG9zaXRpb25cclxuICBicnVzaDogc3RyaW5nOyAvLyBicnVzaCBuYW1lIGZvciBzaGFwZVxyXG59XHJcblxyXG5jb25zdCBicnVzaGVzID0gWydncmVlbicsICdyZWQnLCAnYmx1ZScsICd5ZWxsb3cnXTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzdGFydChzdGF0ZTogU3RhdGUsIGU6IGNnLk1vdWNoRXZlbnQpOiB2b2lkIHtcclxuICBpZiAoZS50b3VjaGVzICYmIGUudG91Y2hlcy5sZW5ndGggPiAxKSByZXR1cm47IC8vIHN1cHBvcnQgb25lIGZpbmdlciB0b3VjaCBvbmx5XHJcbiAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgY2FuY2VsTW92ZShzdGF0ZSk7XHJcbiAgY29uc3QgcG9zaXRpb24gPSBldmVudFBvc2l0aW9uKGUpIGFzIGNnLk51bWJlclBhaXI7XHJcbiAgY29uc3Qgb3JpZyA9IGdldEtleUF0RG9tUG9zKHBvc2l0aW9uLCBzdGF0ZS5vcmllbnRhdGlvbiA9PT0gJ3doaXRlJywgc3RhdGUuZG9tLmJvdW5kcygpKTtcclxuICBpZiAoIW9yaWcpIHJldHVybjtcclxuICBzdGF0ZS5kcmF3YWJsZS5jdXJyZW50ID0ge1xyXG4gICAgb3JpZzogb3JpZyxcclxuICAgIGRlc3Q6IG9yaWcsIC8vIHdpbGwgaW1tZWRpYXRlbHkgYmUgc2V0IHRvIHVuZGVmaW5lZCBieSBwcm9jZXNzRHJhdywgdHJpZ2dlcmluZyByZWRyYXdcclxuICAgIHBvczogcG9zaXRpb24sXHJcbiAgICBicnVzaDogZXZlbnRCcnVzaChlKVxyXG4gIH07XHJcbiAgcHJvY2Vzc0RyYXcoc3RhdGUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcHJvY2Vzc0RyYXcoc3RhdGU6IFN0YXRlKTogdm9pZCB7XHJcbiAgcmFmKCgpID0+IHtcclxuICAgIGNvbnN0IGN1ciA9IHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQ7XHJcbiAgICBpZiAoY3VyKSB7XHJcbiAgICAgIGNvbnN0IGRlc3QgPSBnZXRLZXlBdERvbVBvcyhjdXIucG9zLCBzdGF0ZS5vcmllbnRhdGlvbiA9PT0gJ3doaXRlJywgc3RhdGUuZG9tLmJvdW5kcygpKTtcclxuICAgICAgY29uc3QgbmV3RGVzdCA9IChjdXIub3JpZyA9PT0gZGVzdCkgPyB1bmRlZmluZWQgOiBkZXN0O1xyXG4gICAgICBpZiAobmV3RGVzdCAhPT0gY3VyLmRlc3QpIHtcclxuICAgICAgICBjdXIuZGVzdCA9IG5ld0Rlc3Q7XHJcbiAgICAgICAgc3RhdGUuZG9tLnJlZHJhd05vdygpO1xyXG4gICAgICB9XHJcbiAgICAgIHByb2Nlc3NEcmF3KHN0YXRlKTtcclxuICAgIH1cclxuICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG1vdmUoc3RhdGU6IFN0YXRlLCBlOiBjZy5Nb3VjaEV2ZW50KTogdm9pZCB7XHJcbiAgaWYgKHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQpIHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQucG9zID0gZXZlbnRQb3NpdGlvbihlKSBhcyBjZy5OdW1iZXJQYWlyO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZW5kKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xyXG4gIGNvbnN0IGN1ciA9IHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQ7XHJcbiAgaWYgKCFjdXIpIHJldHVybjtcclxuICBpZiAoY3VyLmRlc3QgJiYgY3VyLmRlc3QgIT09IGN1ci5vcmlnKSBhZGRMaW5lKHN0YXRlLmRyYXdhYmxlLCBjdXIsIGN1ci5kZXN0KTtcclxuICBlbHNlIGFkZENpcmNsZShzdGF0ZS5kcmF3YWJsZSwgY3VyKTtcclxuICBjYW5jZWwoc3RhdGUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2FuY2VsKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xyXG4gIGlmIChzdGF0ZS5kcmF3YWJsZS5jdXJyZW50KSB7XHJcbiAgICBzdGF0ZS5kcmF3YWJsZS5jdXJyZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgc3RhdGUuZG9tLnJlZHJhdygpO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNsZWFyKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xyXG4gIGlmIChzdGF0ZS5kcmF3YWJsZS5zaGFwZXMubGVuZ3RoKSB7XHJcbiAgICBzdGF0ZS5kcmF3YWJsZS5zaGFwZXMgPSBbXTtcclxuICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcclxuICAgIG9uQ2hhbmdlKHN0YXRlLmRyYXdhYmxlKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV2ZW50QnJ1c2goZTogY2cuTW91Y2hFdmVudCk6IHN0cmluZyB7XHJcbiAgY29uc3QgYTogbnVtYmVyID0gZS5zaGlmdEtleSAmJiBpc1JpZ2h0QnV0dG9uKGUpID8gMSA6IDA7XHJcbiAgY29uc3QgYjogbnVtYmVyID0gZS5hbHRLZXkgPyAyIDogMDtcclxuICByZXR1cm4gYnJ1c2hlc1thICsgYl07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5vdDxBPihmOiAoYTogQSkgPT4gYm9vbGVhbik6IChhOiBBKSA9PiBib29sZWFuIHtcclxuICByZXR1cm4gKHg6IEEpID0+ICFmKHgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRDaXJjbGUoZHJhd2FibGU6IERyYXdhYmxlLCBjdXI6IERyYXdDdXJyZW50KTogdm9pZCB7XHJcbiAgY29uc3Qgb3JpZyA9IGN1ci5vcmlnO1xyXG4gIGNvbnN0IHNhbWVDaXJjbGUgPSAoczogRHJhd1NoYXBlKSA9PiBzLm9yaWcgPT09IG9yaWcgJiYgIXMuZGVzdDtcclxuICBjb25zdCBzaW1pbGFyID0gZHJhd2FibGUuc2hhcGVzLmZpbHRlcihzYW1lQ2lyY2xlKVswXTtcclxuICBpZiAoc2ltaWxhcikgZHJhd2FibGUuc2hhcGVzID0gZHJhd2FibGUuc2hhcGVzLmZpbHRlcihub3Qoc2FtZUNpcmNsZSkpO1xyXG4gIGlmICghc2ltaWxhciB8fCBzaW1pbGFyLmJydXNoICE9PSBjdXIuYnJ1c2gpIGRyYXdhYmxlLnNoYXBlcy5wdXNoKHtcclxuICAgIGJydXNoOiBjdXIuYnJ1c2gsXHJcbiAgICBvcmlnOiBvcmlnXHJcbiAgfSk7XHJcbiAgb25DaGFuZ2UoZHJhd2FibGUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRMaW5lKGRyYXdhYmxlOiBEcmF3YWJsZSwgY3VyOiBEcmF3Q3VycmVudCwgZGVzdDogY2cuS2V5KTogdm9pZCB7XHJcbiAgY29uc3Qgb3JpZyA9IGN1ci5vcmlnO1xyXG4gIGNvbnN0IHNhbWVMaW5lID0gKHM6IERyYXdTaGFwZSkgPT4ge1xyXG4gICAgcmV0dXJuICEhcy5kZXN0ICYmIHMub3JpZyA9PT0gb3JpZyAmJiBzLmRlc3QgPT09IGRlc3Q7XHJcbiAgfTtcclxuICBjb25zdCBleGlzdHMgPSBkcmF3YWJsZS5zaGFwZXMuZmlsdGVyKHNhbWVMaW5lKS5sZW5ndGggPiAwO1xyXG4gIGlmIChleGlzdHMpIGRyYXdhYmxlLnNoYXBlcyA9IGRyYXdhYmxlLnNoYXBlcy5maWx0ZXIobm90KHNhbWVMaW5lKSk7XHJcbiAgZWxzZSBkcmF3YWJsZS5zaGFwZXMucHVzaCh7XHJcbiAgICBicnVzaDogY3VyLmJydXNoLFxyXG4gICAgb3JpZzogb3JpZyxcclxuICAgIGRlc3Q6IGRlc3RcclxuICB9KTtcclxuICBvbkNoYW5nZShkcmF3YWJsZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQ2hhbmdlKGRyYXdhYmxlOiBEcmF3YWJsZSk6IHZvaWQge1xyXG4gIGlmIChkcmF3YWJsZS5vbkNoYW5nZSkgZHJhd2FibGUub25DaGFuZ2UoZHJhd2FibGUuc2hhcGVzKTtcclxufVxyXG4iLCJpbXBvcnQgeyBTdGF0ZSB9IGZyb20gJy4vc3RhdGUnXHJcbmltcG9ydCAqIGFzIGRyYWcgZnJvbSAnLi9kcmFnJ1xyXG5pbXBvcnQgKiBhcyBkcmF3IGZyb20gJy4vZHJhdydcclxuaW1wb3J0IHsgaXNSaWdodEJ1dHRvbiwgcmFmIH0gZnJvbSAnLi91dGlsJ1xyXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xyXG5cclxudHlwZSBNb3VjaEJpbmQgPSAoZTogY2cuTW91Y2hFdmVudCkgPT4gdm9pZDtcclxudHlwZSBTdGF0ZU1vdWNoQmluZCA9IChkOiBTdGF0ZSwgZTogY2cuTW91Y2hFdmVudCkgPT4gdm9pZDtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBiaW5kQm9hcmQoczogU3RhdGUpOiB2b2lkIHtcclxuXHJcbiAgaWYgKHMudmlld09ubHkpIHJldHVybjtcclxuXHJcbiAgY29uc3QgYm9hcmRFbCA9IHMuZG9tLmVsZW1lbnRzLmJvYXJkLFxyXG4gIG9uU3RhcnQgPSBzdGFydERyYWdPckRyYXcocyk7XHJcblxyXG4gIC8vIG11c3QgTk9UIGJlIGEgcGFzc2l2ZSBldmVudCFcclxuICBib2FyZEVsLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBvblN0YXJ0KTtcclxuICBib2FyZEVsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG9uU3RhcnQpO1xyXG5cclxuICBpZiAocy5kaXNhYmxlQ29udGV4dE1lbnUgfHwgcy5kcmF3YWJsZS5lbmFibGVkKSB7XHJcbiAgICBib2FyZEVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiBlLnByZXZlbnREZWZhdWx0KCkpO1xyXG4gIH1cclxufVxyXG5cclxuLy8gcmV0dXJucyB0aGUgdW5iaW5kIGZ1bmN0aW9uXHJcbmV4cG9ydCBmdW5jdGlvbiBiaW5kRG9jdW1lbnQoczogU3RhdGUsIHJlZHJhd0FsbDogY2cuUmVkcmF3KTogY2cuVW5iaW5kIHtcclxuXHJcbiAgY29uc3QgdW5iaW5kczogY2cuVW5iaW5kW10gPSBbXTtcclxuXHJcbiAgaWYgKCFzLmRvbS5yZWxhdGl2ZSAmJiBzLnJlc2l6YWJsZSkge1xyXG4gICAgY29uc3Qgb25SZXNpemUgPSAoKSA9PiB7XHJcbiAgICAgIHMuZG9tLmJvdW5kcy5jbGVhcigpO1xyXG4gICAgICByYWYocmVkcmF3QWxsKTtcclxuICAgIH07XHJcbiAgICB1bmJpbmRzLnB1c2godW5iaW5kYWJsZShkb2N1bWVudC5ib2R5LCAnY2hlc3Nncm91bmQucmVzaXplJywgb25SZXNpemUpKTtcclxuICB9XHJcblxyXG4gIGlmICghcy52aWV3T25seSkge1xyXG5cclxuICAgIGNvbnN0IG9ubW92ZTogTW91Y2hCaW5kID0gZHJhZ09yRHJhdyhzLCBkcmFnLm1vdmUsIGRyYXcubW92ZSk7XHJcbiAgICBjb25zdCBvbmVuZDogTW91Y2hCaW5kID0gZHJhZ09yRHJhdyhzLCBkcmFnLmVuZCwgZHJhdy5lbmQpO1xyXG5cclxuICAgIFsndG91Y2htb3ZlJywgJ21vdXNlbW92ZSddLmZvckVhY2goZXYgPT4gdW5iaW5kcy5wdXNoKHVuYmluZGFibGUoZG9jdW1lbnQsIGV2LCBvbm1vdmUpKSk7XHJcbiAgICBbJ3RvdWNoZW5kJywgJ21vdXNldXAnXS5mb3JFYWNoKGV2ID0+IHVuYmluZHMucHVzaCh1bmJpbmRhYmxlKGRvY3VtZW50LCBldiwgb25lbmQpKSk7XHJcblxyXG4gICAgY29uc3Qgb25TY3JvbGwgPSAoKSA9PiBzLmRvbS5ib3VuZHMuY2xlYXIoKTtcclxuICAgIHVuYmluZHMucHVzaCh1bmJpbmRhYmxlKHdpbmRvdywgJ3Njcm9sbCcsIG9uU2Nyb2xsLCB7IHBhc3NpdmU6IHRydWUgfSkpO1xyXG4gICAgdW5iaW5kcy5wdXNoKHVuYmluZGFibGUod2luZG93LCAncmVzaXplJywgb25TY3JvbGwsIHsgcGFzc2l2ZTogdHJ1ZSB9KSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gKCkgPT4gdW5iaW5kcy5mb3JFYWNoKGYgPT4gZigpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gdW5iaW5kYWJsZShlbDogRXZlbnRUYXJnZXQsIGV2ZW50TmFtZTogc3RyaW5nLCBjYWxsYmFjazogTW91Y2hCaW5kLCBvcHRpb25zPzogYW55KTogY2cuVW5iaW5kIHtcclxuICBlbC5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpO1xyXG4gIHJldHVybiAoKSA9PiBlbC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2spO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdGFydERyYWdPckRyYXcoczogU3RhdGUpOiBNb3VjaEJpbmQge1xyXG4gIHJldHVybiBlID0+IHtcclxuICAgIGlmIChzLmRyYWdnYWJsZS5jdXJyZW50KSBkcmFnLmNhbmNlbChzKTtcclxuICAgIGVsc2UgaWYgKHMuZHJhd2FibGUuY3VycmVudCkgZHJhdy5jYW5jZWwocyk7XHJcbiAgICBlbHNlIGlmIChlLnNoaWZ0S2V5IHx8IGlzUmlnaHRCdXR0b24oZSkpIHsgaWYgKHMuZHJhd2FibGUuZW5hYmxlZCkgZHJhdy5zdGFydChzLCBlKTsgfVxyXG4gICAgZWxzZSBpZiAoIXMudmlld09ubHkpIGRyYWcuc3RhcnQocywgZSk7XHJcbiAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gZHJhZ09yRHJhdyhzOiBTdGF0ZSwgd2l0aERyYWc6IFN0YXRlTW91Y2hCaW5kLCB3aXRoRHJhdzogU3RhdGVNb3VjaEJpbmQpOiBNb3VjaEJpbmQge1xyXG4gIHJldHVybiBlID0+IHtcclxuICAgIGlmIChlLnNoaWZ0S2V5IHx8IGlzUmlnaHRCdXR0b24oZSkpIHsgaWYgKHMuZHJhd2FibGUuZW5hYmxlZCkgd2l0aERyYXcocywgZSk7IH1cclxuICAgIGVsc2UgaWYgKCFzLnZpZXdPbmx5KSB3aXRoRHJhZyhzLCBlKTtcclxuICB9O1xyXG59XHJcbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcclxuaW1wb3J0IHsgS2V5IH0gZnJvbSAnLi90eXBlcydcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGV4cGxvc2lvbihzdGF0ZTogU3RhdGUsIGtleXM6IEtleVtdKTogdm9pZCB7XHJcbiAgc3RhdGUuZXhwbG9kaW5nID0ge1xyXG4gICAgc3RhZ2U6IDEsXHJcbiAgICBrZXlzOiBrZXlzXHJcbiAgfTtcclxuICBzdGF0ZS5kb20ucmVkcmF3KCk7XHJcbiAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICBzZXRTdGFnZShzdGF0ZSwgMik7XHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHNldFN0YWdlKHN0YXRlLCB1bmRlZmluZWQpLCAxMjApO1xyXG4gIH0sIDEyMCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldFN0YWdlKHN0YXRlOiBTdGF0ZSwgc3RhZ2U6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xyXG4gIGlmIChzdGF0ZS5leHBsb2RpbmcpIHtcclxuICAgIGlmIChzdGFnZSkgc3RhdGUuZXhwbG9kaW5nLnN0YWdlID0gc3RhZ2U7XHJcbiAgICBlbHNlIHN0YXRlLmV4cGxvZGluZyA9IHVuZGVmaW5lZDtcclxuICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgcG9zMmtleSwgaW52UmFua3MgfSBmcm9tICcuL3V0aWwnXHJcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXHJcblxyXG5leHBvcnQgY29uc3QgaW5pdGlhbDogY2cuRkVOID0gJ3JuYnFrYm5yL3BwcHBwcHBwLzgvOC84LzgvUFBQUFBQUFAvUk5CUUtCTlInO1xyXG5cclxuY29uc3Qgcm9sZXM6IHsgW2xldHRlcjogc3RyaW5nXTogY2cuUm9sZSB9ID0geyBwOiAncGF3bicsIHI6ICdyb29rJywgbjogJ2tuaWdodCcsIGI6ICdiaXNob3AnLCBxOiAncXVlZW4nLCBrOiAna2luZycgfTtcclxuXHJcbmNvbnN0IGxldHRlcnMgPSB7IHBhd246ICdwJywgcm9vazogJ3InLCBrbmlnaHQ6ICduJywgYmlzaG9wOiAnYicsIHF1ZWVuOiAncScsIGtpbmc6ICdrJyB9O1xyXG5cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkKGZlbjogY2cuRkVOKTogY2cuUGllY2VzIHtcclxuICBpZiAoZmVuID09PSAnc3RhcnQnKSBmZW4gPSBpbml0aWFsO1xyXG4gIGNvbnN0IHBpZWNlczogY2cuUGllY2VzID0ge307XHJcbiAgbGV0IHJvdzogbnVtYmVyID0gODtcclxuICBsZXQgY29sOiBudW1iZXIgPSAwO1xyXG4gIGZvciAoY29uc3QgYyBvZiBmZW4pIHtcclxuICAgIHN3aXRjaCAoYykge1xyXG4gICAgICBjYXNlICcgJzogcmV0dXJuIHBpZWNlcztcclxuICAgICAgY2FzZSAnLyc6XHJcbiAgICAgICAgLS1yb3c7XHJcbiAgICAgICAgaWYgKHJvdyA9PT0gMCkgcmV0dXJuIHBpZWNlcztcclxuICAgICAgICBjb2wgPSAwO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICd+JzpcclxuICAgICAgICBwaWVjZXNbcG9zMmtleShbY29sLCByb3ddKV0ucHJvbW90ZWQgPSB0cnVlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIGNvbnN0IG5iID0gYy5jaGFyQ29kZUF0KDApO1xyXG4gICAgICAgIGlmIChuYiA8IDU3KSBjb2wgKz0gbmIgLSA0ODtcclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICsrY29sO1xyXG4gICAgICAgICAgY29uc3Qgcm9sZSA9IGMudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICAgIHBpZWNlc1twb3Mya2V5KFtjb2wsIHJvd10pXSA9IHtcclxuICAgICAgICAgICAgcm9sZTogcm9sZXNbcm9sZV0sXHJcbiAgICAgICAgICAgIGNvbG9yOiAoYyA9PT0gcm9sZSA/ICdibGFjaycgOiAnd2hpdGUnKSBhcyBjZy5Db2xvclxyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBwaWVjZXM7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZShwaWVjZXM6IGNnLlBpZWNlcyk6IGNnLkZFTiB7XHJcbiAgbGV0IHBpZWNlOiBjZy5QaWVjZSwgbGV0dGVyOiBzdHJpbmc7XHJcbiAgcmV0dXJuIGludlJhbmtzLm1hcCh5ID0+IGNnLnJhbmtzLm1hcCh4ID0+IHtcclxuICAgICAgcGllY2UgPSBwaWVjZXNbcG9zMmtleShbeCwgeV0pXTtcclxuICAgICAgaWYgKHBpZWNlKSB7XHJcbiAgICAgICAgbGV0dGVyID0gbGV0dGVyc1twaWVjZS5yb2xlXTtcclxuICAgICAgICByZXR1cm4gcGllY2UuY29sb3IgPT09ICd3aGl0ZScgPyBsZXR0ZXIudG9VcHBlckNhc2UoKSA6IGxldHRlcjtcclxuICAgICAgfSBlbHNlIHJldHVybiAnMSc7XHJcbiAgICB9KS5qb2luKCcnKVxyXG4gICkuam9pbignLycpLnJlcGxhY2UoLzF7Mix9L2csIHMgPT4gcy5sZW5ndGgudG9TdHJpbmcoKSk7XHJcbn1cclxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9jaGVzc2dyb3VuZFwiKS5DaGVzc2dyb3VuZDtcclxuIiwiaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnXHJcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXHJcblxyXG50eXBlIE1vYmlsaXR5ID0gKHgxOm51bWJlciwgeTE6bnVtYmVyLCB4MjpudW1iZXIsIHkyOm51bWJlcikgPT4gYm9vbGVhbjtcclxuXHJcbmZ1bmN0aW9uIGRpZmYoYTogbnVtYmVyLCBiOm51bWJlcik6bnVtYmVyIHtcclxuICByZXR1cm4gTWF0aC5hYnMoYSAtIGIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXduKGNvbG9yOiBjZy5Db2xvcik6IE1vYmlsaXR5IHtcclxuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSA9PiBkaWZmKHgxLCB4MikgPCAyICYmIChcclxuICAgIGNvbG9yID09PSAnd2hpdGUnID8gKFxyXG4gICAgICAvLyBhbGxvdyAyIHNxdWFyZXMgZnJvbSAxIGFuZCA4LCBmb3IgaG9yZGVcclxuICAgICAgeTIgPT09IHkxICsgMSB8fCAoeTEgPD0gMiAmJiB5MiA9PT0gKHkxICsgMikgJiYgeDEgPT09IHgyKVxyXG4gICAgKSA6IChcclxuICAgICAgeTIgPT09IHkxIC0gMSB8fCAoeTEgPj0gNyAmJiB5MiA9PT0gKHkxIC0gMikgJiYgeDEgPT09IHgyKVxyXG4gICAgKVxyXG4gICk7XHJcbn1cclxuXHJcbmNvbnN0IGtuaWdodDogTW9iaWxpdHkgPSAoeDEsIHkxLCB4MiwgeTIpID0+IHtcclxuICBjb25zdCB4ZCA9IGRpZmYoeDEsIHgyKTtcclxuICBjb25zdCB5ZCA9IGRpZmYoeTEsIHkyKTtcclxuICByZXR1cm4gKHhkID09PSAxICYmIHlkID09PSAyKSB8fCAoeGQgPT09IDIgJiYgeWQgPT09IDEpO1xyXG59XHJcblxyXG5jb25zdCBiaXNob3A6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XHJcbiAgcmV0dXJuIGRpZmYoeDEsIHgyKSA9PT0gZGlmZih5MSwgeTIpO1xyXG59XHJcblxyXG5jb25zdCByb29rOiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xyXG4gIHJldHVybiB4MSA9PT0geDIgfHwgeTEgPT09IHkyO1xyXG59XHJcblxyXG5jb25zdCBxdWVlbjogTW9iaWxpdHkgPSAoeDEsIHkxLCB4MiwgeTIpID0+IHtcclxuICByZXR1cm4gYmlzaG9wKHgxLCB5MSwgeDIsIHkyKSB8fCByb29rKHgxLCB5MSwgeDIsIHkyKTtcclxufVxyXG5cclxuZnVuY3Rpb24ga2luZyhjb2xvcjogY2cuQ29sb3IsIHJvb2tGaWxlczogbnVtYmVyW10sIGNhbkNhc3RsZTogYm9vbGVhbik6IE1vYmlsaXR5IHtcclxuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSAgPT4gKFxyXG4gICAgZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyXHJcbiAgKSB8fCAoXHJcbiAgICBjYW5DYXN0bGUgJiYgeTEgPT09IHkyICYmIHkxID09PSAoY29sb3IgPT09ICd3aGl0ZScgPyAxIDogOCkgJiYgKFxyXG4gICAgICAoeDEgPT09IDUgJiYgKHgyID09PSAzIHx8IHgyID09PSA3KSkgfHwgdXRpbC5jb250YWluc1gocm9va0ZpbGVzLCB4MilcclxuICAgIClcclxuICApO1xyXG59XHJcblxyXG5mdW5jdGlvbiByb29rRmlsZXNPZihwaWVjZXM6IGNnLlBpZWNlcywgY29sb3I6IGNnLkNvbG9yKSB7XHJcbiAgbGV0IHBpZWNlOiBjZy5QaWVjZTtcclxuICByZXR1cm4gT2JqZWN0LmtleXMocGllY2VzKS5maWx0ZXIoa2V5ID0+IHtcclxuICAgIHBpZWNlID0gcGllY2VzW2tleV07XHJcbiAgICByZXR1cm4gcGllY2UgJiYgcGllY2UuY29sb3IgPT09IGNvbG9yICYmIHBpZWNlLnJvbGUgPT09ICdyb29rJztcclxuICB9KS5tYXAoKGtleTogY2cuS2V5KSA9PiB1dGlsLmtleTJwb3Moa2V5KVswXSk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHByZW1vdmUocGllY2VzOiBjZy5QaWVjZXMsIGtleTogY2cuS2V5LCBjYW5DYXN0bGU6IGJvb2xlYW4pOiBjZy5LZXlbXSB7XHJcbiAgY29uc3QgcGllY2UgPSBwaWVjZXNba2V5XSxcclxuICBwb3MgPSB1dGlsLmtleTJwb3Moa2V5KTtcclxuICBsZXQgbW9iaWxpdHk6IE1vYmlsaXR5O1xyXG4gIHN3aXRjaCAocGllY2Uucm9sZSkge1xyXG4gICAgY2FzZSAncGF3bic6XHJcbiAgICAgIG1vYmlsaXR5ID0gcGF3bihwaWVjZS5jb2xvcik7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAna25pZ2h0JzpcclxuICAgICAgbW9iaWxpdHkgPSBrbmlnaHQ7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnYmlzaG9wJzpcclxuICAgICAgbW9iaWxpdHkgPSBiaXNob3A7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAncm9vayc6XHJcbiAgICAgIG1vYmlsaXR5ID0gcm9vaztcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdxdWVlbic6XHJcbiAgICAgIG1vYmlsaXR5ID0gcXVlZW47XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAna2luZyc6XHJcbiAgICAgIG1vYmlsaXR5ID0ga2luZyhwaWVjZS5jb2xvciwgcm9va0ZpbGVzT2YocGllY2VzLCBwaWVjZS5jb2xvciksIGNhbkNhc3RsZSk7XHJcbiAgICAgIGJyZWFrO1xyXG4gIH1cclxuICByZXR1cm4gdXRpbC5hbGxLZXlzLm1hcCh1dGlsLmtleTJwb3MpLmZpbHRlcihwb3MyID0+IHtcclxuICAgIHJldHVybiAocG9zWzBdICE9PSBwb3MyWzBdIHx8IHBvc1sxXSAhPT0gcG9zMlsxXSkgJiYgbW9iaWxpdHkocG9zWzBdLCBwb3NbMV0sIHBvczJbMF0sIHBvczJbMV0pO1xyXG4gIH0pLm1hcCh1dGlsLnBvczJrZXkpO1xyXG59O1xyXG4iLCJpbXBvcnQgeyBTdGF0ZSB9IGZyb20gJy4vc3RhdGUnXHJcbmltcG9ydCB7IGtleTJwb3MsIGNyZWF0ZUVsIH0gZnJvbSAnLi91dGlsJ1xyXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCdcclxuaW1wb3J0IHsgQW5pbUN1cnJlbnQsIEFuaW1WZWN0b3JzLCBBbmltVmVjdG9yLCBBbmltRmFkaW5ncyB9IGZyb20gJy4vYW5pbSdcclxuaW1wb3J0IHsgRHJhZ0N1cnJlbnQgfSBmcm9tICcuL2RyYWcnXHJcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXHJcblxyXG4vLyBgJGNvbG9yICRyb2xlYFxyXG50eXBlIFBpZWNlTmFtZSA9IHN0cmluZztcclxuXHJcbmludGVyZmFjZSBTYW1lUGllY2VzIHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9XHJcbmludGVyZmFjZSBTYW1lU3F1YXJlcyB7IFtrZXk6IHN0cmluZ106IGJvb2xlYW4gfVxyXG5pbnRlcmZhY2UgTW92ZWRQaWVjZXMgeyBbcGllY2VOYW1lOiBzdHJpbmddOiBjZy5QaWVjZU5vZGVbXSB9XHJcbmludGVyZmFjZSBNb3ZlZFNxdWFyZXMgeyBbY2xhc3NOYW1lOiBzdHJpbmddOiBjZy5TcXVhcmVOb2RlW10gfVxyXG5pbnRlcmZhY2UgU3F1YXJlQ2xhc3NlcyB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9XHJcblxyXG4vLyBwb3J0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdmVsb2NlL2xpY2hvYmlsZS9ibG9iL21hc3Rlci9zcmMvanMvY2hlc3Nncm91bmQvdmlldy5qc1xyXG4vLyBpbiBjYXNlIG9mIGJ1Z3MsIGJsYW1lIEB2ZWxvY2VcclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmVuZGVyKHM6IFN0YXRlKTogdm9pZCB7XHJcbiAgY29uc3QgYXNXaGl0ZTogYm9vbGVhbiA9IHMub3JpZW50YXRpb24gPT09ICd3aGl0ZScsXHJcbiAgcG9zVG9UcmFuc2xhdGUgPSBzLmRvbS5yZWxhdGl2ZSA/IHV0aWwucG9zVG9UcmFuc2xhdGVSZWwgOiB1dGlsLnBvc1RvVHJhbnNsYXRlQWJzKHMuZG9tLmJvdW5kcygpKSxcclxuICB0cmFuc2xhdGUgPSBzLmRvbS5yZWxhdGl2ZSA/IHV0aWwudHJhbnNsYXRlUmVsIDogdXRpbC50cmFuc2xhdGVBYnMsXHJcblxyXG4gIHNob3VsZFJvdGF0ZTogYm9vbGVhbiA9IHMucm90YXRlID8gKHMub3JpZW50YXRpb24gIT0gcy50dXJuQ29sb3IpIDogZmFsc2UsXHJcblxyXG4gIGJvYXJkRWw6IEhUTUxFbGVtZW50ID0gcy5kb20uZWxlbWVudHMuYm9hcmQsXHJcbiAgcGllY2VzOiBjZy5QaWVjZXMgPSBzLnBpZWNlcyxcclxuICBjdXJBbmltOiBBbmltQ3VycmVudCB8IHVuZGVmaW5lZCA9IHMuYW5pbWF0aW9uLmN1cnJlbnQsXHJcbiAgYW5pbXM6IEFuaW1WZWN0b3JzID0gY3VyQW5pbSA/IGN1ckFuaW0ucGxhbi5hbmltcyA6IHt9LFxyXG4gIGZhZGluZ3M6IEFuaW1GYWRpbmdzID0gY3VyQW5pbSA/IGN1ckFuaW0ucGxhbi5mYWRpbmdzIDoge30sXHJcbiAgY3VyRHJhZzogRHJhZ0N1cnJlbnQgfCB1bmRlZmluZWQgPSBzLmRyYWdnYWJsZS5jdXJyZW50LFxyXG4gICAgIHNxdWFyZXM6IFNxdWFyZUNsYXNzZXMgPSBjb21wdXRlU3F1YXJlQ2xhc3NlcyhzKSxcclxuICBzYW1lUGllY2VzOiBTYW1lUGllY2VzID0ge30sXHJcbiAgc2FtZVNxdWFyZXM6IFNhbWVTcXVhcmVzID0ge30sXHJcbiAgbW92ZWRQaWVjZXM6IE1vdmVkUGllY2VzID0ge30sXHJcbiAgbW92ZWRTcXVhcmVzOiBNb3ZlZFNxdWFyZXMgPSB7fSxcclxuICBwaWVjZXNLZXlzOiBjZy5LZXlbXSA9IE9iamVjdC5rZXlzKHBpZWNlcykgYXMgY2cuS2V5W107XHJcbiAgbGV0IGs6IGNnLktleSxcclxuICBwOiBjZy5QaWVjZSB8IHVuZGVmaW5lZCxcclxuICBlbDogY2cuUGllY2VOb2RlIHwgY2cuU3F1YXJlTm9kZSxcclxuICBwaWVjZUF0S2V5OiBjZy5QaWVjZSB8IHVuZGVmaW5lZCxcclxuICBlbFBpZWNlTmFtZTogUGllY2VOYW1lLFxyXG4gIGFuaW06IEFuaW1WZWN0b3IgfCB1bmRlZmluZWQsXHJcbiAgZmFkaW5nOiBjZy5QaWVjZSB8IHVuZGVmaW5lZCxcclxuICBwTXZkc2V0OiBjZy5QaWVjZU5vZGVbXSxcclxuICBwTXZkOiBjZy5QaWVjZU5vZGUgfCB1bmRlZmluZWQsXHJcbiAgc012ZHNldDogY2cuU3F1YXJlTm9kZVtdLFxyXG4gIHNNdmQ6IGNnLlNxdWFyZU5vZGUgfCB1bmRlZmluZWQ7XHJcblxyXG4gIC8vIHdhbGsgb3ZlciBhbGwgYm9hcmQgZG9tIGVsZW1lbnRzLCBhcHBseSBhbmltYXRpb25zIGFuZCBmbGFnIG1vdmVkIHBpZWNlc1xyXG4gIGVsID0gYm9hcmRFbC5maXJzdENoaWxkIGFzIGNnLlBpZWNlTm9kZSB8IGNnLlNxdWFyZU5vZGU7XHJcbiAgd2hpbGUgKGVsKSB7XHJcbiAgICBrID0gZWwuY2dLZXk7XHJcbiAgICBpZiAoaXNQaWVjZU5vZGUoZWwpKSB7XHJcbiAgICAgIHBpZWNlQXRLZXkgPSBwaWVjZXNba107XHJcbiAgICAgIGFuaW0gPSBhbmltc1trXTtcclxuICAgICAgZmFkaW5nID0gZmFkaW5nc1trXTtcclxuICAgICAgZWxQaWVjZU5hbWUgPSBlbC5jZ1BpZWNlO1xyXG4gICAgICAvLyBpZiBwaWVjZSBub3QgYmVpbmcgZHJhZ2dlZCBhbnltb3JlLCByZW1vdmUgZHJhZ2dpbmcgc3R5bGVcclxuICAgICAgaWYgKGVsLmNnRHJhZ2dpbmcgJiYgKCFjdXJEcmFnIHx8IGN1ckRyYWcub3JpZyAhPT0gaykpIHtcclxuICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ2luZycpO1xyXG4gICAgICAgIHRyYW5zbGF0ZShlbCwgcG9zVG9UcmFuc2xhdGUoa2V5MnBvcyhrKSwgYXNXaGl0ZSksc2hvdWxkUm90YXRlKTtcclxuICAgICAgICBlbC5jZ0RyYWdnaW5nID0gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgICAgLy8gcmVtb3ZlIGZhZGluZyBjbGFzcyBpZiBpdCBzdGlsbCByZW1haW5zXHJcbiAgICAgIGlmICghZmFkaW5nICYmIGVsLmNnRmFkaW5nKSB7XHJcbiAgICAgICAgZWwuY2dGYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdmYWRpbmcnKTtcclxuICAgICAgfVxyXG4gICAgICAvLyB0aGVyZSBpcyBub3cgYSBwaWVjZSBhdCB0aGlzIGRvbSBrZXlcclxuICAgICAgaWYgKHBpZWNlQXRLZXkpIHtcclxuICAgICAgICAvLyBjb250aW51ZSBhbmltYXRpb24gaWYgYWxyZWFkeSBhbmltYXRpbmcgYW5kIHNhbWUgcGllY2VcclxuICAgICAgICAvLyAob3RoZXJ3aXNlIGl0IGNvdWxkIGFuaW1hdGUgYSBjYXB0dXJlZCBwaWVjZSlcclxuICAgICAgICBpZiAoYW5pbSAmJiBlbC5jZ0FuaW1hdGluZyAmJiBlbFBpZWNlTmFtZSA9PT0gcGllY2VOYW1lT2YocGllY2VBdEtleSkpIHtcclxuICAgICAgICAgIGNvbnN0IHBvcyA9IGtleTJwb3Moayk7XHJcbiAgICAgICAgICBwb3NbMF0gKz0gYW5pbVsxXVswXTtcclxuICAgICAgICAgIHBvc1sxXSArPSBhbmltWzFdWzFdO1xyXG4gICAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnYW5pbScpO1xyXG4gICAgICAgICAgdHJhbnNsYXRlKGVsLCBwb3NUb1RyYW5zbGF0ZShwb3MsIGFzV2hpdGUpLHNob3VsZFJvdGF0ZSk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChlbC5jZ0FuaW1hdGluZykge1xyXG4gICAgICAgICAgZWwuY2dBbmltYXRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2FuaW0nKTtcclxuICAgICAgICAgIHRyYW5zbGF0ZShlbCwgcG9zVG9UcmFuc2xhdGUoa2V5MnBvcyhrKSwgYXNXaGl0ZSksc2hvdWxkUm90YXRlKTtcclxuICAgICAgICAgIGlmIChzLmFkZFBpZWNlWkluZGV4KSBlbC5zdHlsZS56SW5kZXggPSBwb3NaSW5kZXgoa2V5MnBvcyhrKSwgYXNXaGl0ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIHNhbWUgcGllY2U6IGZsYWcgYXMgc2FtZVxyXG4gICAgICAgIGlmIChlbFBpZWNlTmFtZSA9PT0gcGllY2VOYW1lT2YocGllY2VBdEtleSkgJiYgKCFmYWRpbmcgfHwgIWVsLmNnRmFkaW5nKSkge1xyXG4gICAgICAgICAgc2FtZVBpZWNlc1trXSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGRpZmZlcmVudCBwaWVjZTogZmxhZyBhcyBtb3ZlZCB1bmxlc3MgaXQgaXMgYSBmYWRpbmcgcGllY2VcclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgIGlmIChmYWRpbmcgJiYgZWxQaWVjZU5hbWUgPT09IHBpZWNlTmFtZU9mKGZhZGluZykpIHtcclxuICAgICAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnZmFkaW5nJyk7XHJcbiAgICAgICAgICAgIGVsLmNnRmFkaW5nID0gdHJ1ZTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmIChtb3ZlZFBpZWNlc1tlbFBpZWNlTmFtZV0pIG1vdmVkUGllY2VzW2VsUGllY2VOYW1lXS5wdXNoKGVsKTtcclxuICAgICAgICAgICAgZWxzZSBtb3ZlZFBpZWNlc1tlbFBpZWNlTmFtZV0gPSBbZWxdO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvLyBubyBwaWVjZTogZmxhZyBhcyBtb3ZlZFxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICBpZiAobW92ZWRQaWVjZXNbZWxQaWVjZU5hbWVdKSBtb3ZlZFBpZWNlc1tlbFBpZWNlTmFtZV0ucHVzaChlbCk7XHJcbiAgICAgICAgZWxzZSBtb3ZlZFBpZWNlc1tlbFBpZWNlTmFtZV0gPSBbZWxdO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChpc1NxdWFyZU5vZGUoZWwpKSB7XHJcbiAgICAgIGNvbnN0IGNuID0gZWwuY2xhc3NOYW1lO1xyXG4gICAgICBpZiAoc3F1YXJlc1trXSA9PT0gY24pIHNhbWVTcXVhcmVzW2tdID0gdHJ1ZTtcclxuICAgICAgZWxzZSBpZiAobW92ZWRTcXVhcmVzW2NuXSkgbW92ZWRTcXVhcmVzW2NuXS5wdXNoKGVsKTtcclxuICAgICAgZWxzZSBtb3ZlZFNxdWFyZXNbY25dID0gW2VsXTtcclxuICAgIH1cclxuICAgIGVsID0gZWwubmV4dFNpYmxpbmcgYXMgY2cuUGllY2VOb2RlIHwgY2cuU3F1YXJlTm9kZTtcclxuICB9XHJcblxyXG4gIC8vIHdhbGsgb3ZlciBhbGwgc3F1YXJlcyBpbiBjdXJyZW50IHNldCwgYXBwbHkgZG9tIGNoYW5nZXMgdG8gbW92ZWQgc3F1YXJlc1xyXG4gIC8vIG9yIGFwcGVuZCBuZXcgc3F1YXJlc1xyXG4gIGZvciAoY29uc3Qgc2sgaW4gc3F1YXJlcykge1xyXG4gICAgaWYgKCFzYW1lU3F1YXJlc1tza10pIHtcclxuICAgICAgc012ZHNldCA9IG1vdmVkU3F1YXJlc1tzcXVhcmVzW3NrXV07XHJcbiAgICAgIHNNdmQgPSBzTXZkc2V0ICYmIHNNdmRzZXQucG9wKCk7XHJcbiAgICAgIGNvbnN0IHRyYW5zbGF0aW9uID0gcG9zVG9UcmFuc2xhdGUoa2V5MnBvcyhzayBhcyBjZy5LZXkpLCBhc1doaXRlKTtcclxuICAgICAgaWYgKHNNdmQpIHtcclxuICAgICAgICBzTXZkLmNnS2V5ID0gc2sgYXMgY2cuS2V5O1xyXG4gICAgICAgIHRyYW5zbGF0ZShzTXZkLCB0cmFuc2xhdGlvbixzaG91bGRSb3RhdGUpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IHNxdWFyZU5vZGUgPSBjcmVhdGVFbCgnc3F1YXJlJywgc3F1YXJlc1tza10pIGFzIGNnLlNxdWFyZU5vZGU7XHJcbiAgICAgICAgc3F1YXJlTm9kZS5jZ0tleSA9IHNrIGFzIGNnLktleTtcclxuICAgICAgICB0cmFuc2xhdGUoc3F1YXJlTm9kZSwgdHJhbnNsYXRpb24sc2hvdWxkUm90YXRlKTtcclxuICAgICAgICBib2FyZEVsLmluc2VydEJlZm9yZShzcXVhcmVOb2RlLCBib2FyZEVsLmZpcnN0Q2hpbGQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyB3YWxrIG92ZXIgYWxsIHBpZWNlcyBpbiBjdXJyZW50IHNldCwgYXBwbHkgZG9tIGNoYW5nZXMgdG8gbW92ZWQgcGllY2VzXHJcbiAgLy8gb3IgYXBwZW5kIG5ldyBwaWVjZXNcclxuICBmb3IgKGNvbnN0IGogaW4gcGllY2VzS2V5cykge1xyXG4gICAgayA9IHBpZWNlc0tleXNbal07XHJcbiAgICBwID0gcGllY2VzW2tdO1xyXG4gICAgYW5pbSA9IGFuaW1zW2tdO1xyXG4gICAgaWYgKCFzYW1lUGllY2VzW2tdKSB7XHJcbiAgICAgIHBNdmRzZXQgPSBtb3ZlZFBpZWNlc1twaWVjZU5hbWVPZihwKV07XHJcbiAgICAgIHBNdmQgPSBwTXZkc2V0ICYmIHBNdmRzZXQucG9wKCk7XHJcbiAgICAgIC8vIGEgc2FtZSBwaWVjZSB3YXMgbW92ZWRcclxuICAgICAgaWYgKHBNdmQpIHtcclxuICAgICAgICAvLyBhcHBseSBkb20gY2hhbmdlc1xyXG4gICAgICAgIHBNdmQuY2dLZXkgPSBrO1xyXG4gICAgICAgIGlmIChwTXZkLmNnRmFkaW5nKSB7XHJcbiAgICAgICAgICBwTXZkLmNsYXNzTGlzdC5yZW1vdmUoJ2ZhZGluZycpO1xyXG4gICAgICAgICAgcE12ZC5jZ0ZhZGluZyA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBwb3MgPSBrZXkycG9zKGspO1xyXG4gICAgICAgIGlmIChzLmFkZFBpZWNlWkluZGV4KSBwTXZkLnN0eWxlLnpJbmRleCA9IHBvc1pJbmRleChwb3MsIGFzV2hpdGUpO1xyXG4gICAgICAgIGlmIChhbmltKSB7XHJcbiAgICAgICAgICBwTXZkLmNnQW5pbWF0aW5nID0gdHJ1ZTtcclxuICAgICAgICAgIHBNdmQuY2xhc3NMaXN0LmFkZCgnYW5pbScpO1xyXG4gICAgICAgICAgcG9zWzBdICs9IGFuaW1bMV1bMF07XHJcbiAgICAgICAgICBwb3NbMV0gKz0gYW5pbVsxXVsxXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdHJhbnNsYXRlKHBNdmQsIHBvc1RvVHJhbnNsYXRlKHBvcywgYXNXaGl0ZSksc2hvdWxkUm90YXRlKTtcclxuICAgICAgfVxyXG4gICAgICAvLyBubyBwaWVjZSBpbiBtb3ZlZCBvYmo6IGluc2VydCB0aGUgbmV3IHBpZWNlXHJcbiAgICAgIC8vIG5ldzogYXNzdW1lIHRoZSBuZXcgcGllY2UgaXMgbm90IGJlaW5nIGRyYWdnZWRcclxuICAgICAgLy8gbWlnaHQgYmUgYSBiYWQgaWRlYVxyXG4gICAgICBlbHNlIHtcclxuXHJcbiAgICAgICAgY29uc3QgcGllY2VOYW1lID0gcGllY2VOYW1lT2YocCksXHJcbiAgICAgICAgcGllY2VOb2RlID0gY3JlYXRlRWwoJ3BpZWNlJywgcGllY2VOYW1lKSBhcyBjZy5QaWVjZU5vZGUsXHJcbiAgICAgICAgcG9zID0ga2V5MnBvcyhrKTtcclxuXHJcbiAgICAgICAgcGllY2VOb2RlLmNnUGllY2UgPSBwaWVjZU5hbWU7XHJcbiAgICAgICAgcGllY2VOb2RlLmNnS2V5ID0gaztcclxuICAgICAgICBpZiAoYW5pbSkge1xyXG4gICAgICAgICAgcGllY2VOb2RlLmNnQW5pbWF0aW5nID0gdHJ1ZTtcclxuICAgICAgICAgIHBvc1swXSArPSBhbmltWzFdWzBdO1xyXG4gICAgICAgICAgcG9zWzFdICs9IGFuaW1bMV1bMV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRyYW5zbGF0ZShwaWVjZU5vZGUsIHBvc1RvVHJhbnNsYXRlKHBvcywgYXNXaGl0ZSksc2hvdWxkUm90YXRlKTtcclxuXHJcbiAgICAgICAgaWYgKHMuYWRkUGllY2VaSW5kZXgpIHBpZWNlTm9kZS5zdHlsZS56SW5kZXggPSBwb3NaSW5kZXgocG9zLCBhc1doaXRlKTtcclxuXHJcbiAgICAgICAgYm9hcmRFbC5hcHBlbmRDaGlsZChwaWVjZU5vZGUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyByZW1vdmUgYW55IGVsZW1lbnQgdGhhdCByZW1haW5zIGluIHRoZSBtb3ZlZCBzZXRzXHJcbiAgZm9yIChjb25zdCBpIGluIG1vdmVkUGllY2VzKSByZW1vdmVOb2RlcyhzLCBtb3ZlZFBpZWNlc1tpXSk7XHJcbiAgZm9yIChjb25zdCBpIGluIG1vdmVkU3F1YXJlcykgcmVtb3ZlTm9kZXMocywgbW92ZWRTcXVhcmVzW2ldKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNQaWVjZU5vZGUoZWw6IGNnLlBpZWNlTm9kZSB8IGNnLlNxdWFyZU5vZGUpOiBlbCBpcyBjZy5QaWVjZU5vZGUge1xyXG4gIHJldHVybiBlbC50YWdOYW1lID09PSAnUElFQ0UnO1xyXG59XHJcbmZ1bmN0aW9uIGlzU3F1YXJlTm9kZShlbDogY2cuUGllY2VOb2RlIHwgY2cuU3F1YXJlTm9kZSk6IGVsIGlzIGNnLlNxdWFyZU5vZGUge1xyXG4gIHJldHVybiBlbC50YWdOYW1lID09PSAnU1FVQVJFJztcclxufVxyXG5cclxuZnVuY3Rpb24gcmVtb3ZlTm9kZXMoczogU3RhdGUsIG5vZGVzOiBIVE1MRWxlbWVudFtdKTogdm9pZCB7XHJcbiAgZm9yIChjb25zdCBpIGluIG5vZGVzKSBzLmRvbS5lbGVtZW50cy5ib2FyZC5yZW1vdmVDaGlsZChub2Rlc1tpXSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBvc1pJbmRleChwb3M6IGNnLlBvcywgYXNXaGl0ZTogYm9vbGVhbik6IHN0cmluZyB7XHJcbiAgbGV0IHogPSAyICsgKHBvc1sxXSAtIDEpICogOCArICg4IC0gcG9zWzBdKTtcclxuICBpZiAoYXNXaGl0ZSkgeiA9IDY3IC0gejtcclxuICByZXR1cm4geiArICcnO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwaWVjZU5hbWVPZihwaWVjZTogY2cuUGllY2UpOiBzdHJpbmcge1xyXG4gIHJldHVybiBgJHtwaWVjZS5jb2xvcn0gJHtwaWVjZS5yb2xlfWA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvbXB1dGVTcXVhcmVDbGFzc2VzKHM6IFN0YXRlKTogU3F1YXJlQ2xhc3NlcyB7XHJcbiAgY29uc3Qgc3F1YXJlczogU3F1YXJlQ2xhc3NlcyA9IHt9O1xyXG4gIGxldCBpOiBhbnksIGs6IGNnLktleTtcclxuICBpZiAocy5sYXN0TW92ZSAmJiBzLmhpZ2hsaWdodC5sYXN0TW92ZSkgZm9yIChpIGluIHMubGFzdE1vdmUpIHtcclxuICAgIGFkZFNxdWFyZShzcXVhcmVzLCBzLmxhc3RNb3ZlW2ldLCAnbGFzdC1tb3ZlJyk7XHJcbiAgfVxyXG4gIGlmIChzLmNoZWNrICYmIHMuaGlnaGxpZ2h0LmNoZWNrKSBhZGRTcXVhcmUoc3F1YXJlcywgcy5jaGVjaywgJ2NoZWNrJyk7XHJcbiAgaWYgKHMuc2VsZWN0ZWQpIHtcclxuICAgIGFkZFNxdWFyZShzcXVhcmVzLCBzLnNlbGVjdGVkLCAnc2VsZWN0ZWQnKTtcclxuICAgIGlmIChzLm1vdmFibGUuc2hvd0Rlc3RzKSB7XHJcbiAgICAgIGNvbnN0IGRlc3RzID0gcy5tb3ZhYmxlLmRlc3RzICYmIHMubW92YWJsZS5kZXN0c1tzLnNlbGVjdGVkXTtcclxuICAgICAgaWYgKGRlc3RzKSBmb3IgKGkgaW4gZGVzdHMpIHtcclxuICAgICAgICBrID0gZGVzdHNbaV07XHJcbiAgICAgICAgYWRkU3F1YXJlKHNxdWFyZXMsIGssICdtb3ZlLWRlc3QnICsgKHMucGllY2VzW2tdID8gJyBvYycgOiAnJykpO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHBEZXN0cyA9IHMucHJlbW92YWJsZS5kZXN0cztcclxuICAgICAgaWYgKHBEZXN0cykgZm9yIChpIGluIHBEZXN0cykge1xyXG4gICAgICAgIGsgPSBwRGVzdHNbaV07XHJcbiAgICAgICAgYWRkU3F1YXJlKHNxdWFyZXMsIGssICdwcmVtb3ZlLWRlc3QnICsgKHMucGllY2VzW2tdID8gJyBvYycgOiAnJykpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIGNvbnN0IHByZW1vdmUgPSBzLnByZW1vdmFibGUuY3VycmVudDtcclxuICBpZiAocHJlbW92ZSkgZm9yIChpIGluIHByZW1vdmUpIGFkZFNxdWFyZShzcXVhcmVzLCBwcmVtb3ZlW2ldLCAnY3VycmVudC1wcmVtb3ZlJyk7XHJcbiAgZWxzZSBpZiAocy5wcmVkcm9wcGFibGUuY3VycmVudCkgYWRkU3F1YXJlKHNxdWFyZXMsIHMucHJlZHJvcHBhYmxlLmN1cnJlbnQua2V5LCAnY3VycmVudC1wcmVtb3ZlJyk7XHJcblxyXG4gIGNvbnN0IG8gPSBzLmV4cGxvZGluZztcclxuICBpZiAobykgZm9yIChpIGluIG8ua2V5cykgYWRkU3F1YXJlKHNxdWFyZXMsIG8ua2V5c1tpXSwgJ2V4cGxvZGluZycgKyBvLnN0YWdlKTtcclxuXHJcbiAgcmV0dXJuIHNxdWFyZXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFkZFNxdWFyZShzcXVhcmVzOiBTcXVhcmVDbGFzc2VzLCBrZXk6IGNnLktleSwga2xhc3M6IHN0cmluZyk6IHZvaWQge1xyXG4gIGlmIChzcXVhcmVzW2tleV0pIHNxdWFyZXNba2V5XSArPSAnICcgKyBrbGFzcztcclxuICBlbHNlIHNxdWFyZXNba2V5XSA9IGtsYXNzO1xyXG59XHJcbiIsImltcG9ydCAqIGFzIGZlbiBmcm9tICcuL2ZlbidcclxuaW1wb3J0IHsgQW5pbUN1cnJlbnQgfSBmcm9tICcuL2FuaW0nXHJcbmltcG9ydCB7IERyYWdDdXJyZW50IH0gZnJvbSAnLi9kcmFnJ1xyXG5pbXBvcnQgeyBEcmF3YWJsZSB9IGZyb20gJy4vZHJhdydcclxuaW1wb3J0IHsgdGltZXIgfSBmcm9tICcuL3V0aWwnXHJcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBTdGF0ZSB7XHJcbiAgcGllY2VzOiBjZy5QaWVjZXM7XHJcbiAgb3JpZW50YXRpb246IGNnLkNvbG9yOyAvLyBib2FyZCBvcmllbnRhdGlvbi4gd2hpdGUgfCBibGFja1xyXG4gIHR1cm5Db2xvcjogY2cuQ29sb3I7IC8vIHR1cm4gdG8gcGxheS4gd2hpdGUgfCBibGFja1xyXG4gIGNoZWNrPzogY2cuS2V5OyAvLyBzcXVhcmUgY3VycmVudGx5IGluIGNoZWNrIFwiYTJcIlxyXG4gIGxhc3RNb3ZlPzogY2cuS2V5W107IC8vIHNxdWFyZXMgcGFydCBvZiB0aGUgbGFzdCBtb3ZlIFtcImMzXCI7IFwiYzRcIl1cclxuICBzZWxlY3RlZD86IGNnLktleTsgLy8gc3F1YXJlIGN1cnJlbnRseSBzZWxlY3RlZCBcImExXCJcclxuXHJcbiAgcm90YXRlPzogYm9vbGVhbjsvL3Nob3VsZCB0aGUgcGllY2VzIHJvdGF0ZT9cclxuXHJcbiAgY29vcmRpbmF0ZXM6IGJvb2xlYW47IC8vIGluY2x1ZGUgY29vcmRzIGF0dHJpYnV0ZXNcclxuICBhdXRvQ2FzdGxlOiBib29sZWFuOyAvLyBpbW1lZGlhdGVseSBjb21wbGV0ZSB0aGUgY2FzdGxlIGJ5IG1vdmluZyB0aGUgcm9vayBhZnRlciBraW5nIG1vdmVcclxuICB2aWV3T25seTogYm9vbGVhbjsgLy8gZG9uJ3QgYmluZCBldmVudHM6IHRoZSB1c2VyIHdpbGwgbmV2ZXIgYmUgYWJsZSB0byBtb3ZlIHBpZWNlcyBhcm91bmRcclxuICBkaXNhYmxlQ29udGV4dE1lbnU6IGJvb2xlYW47IC8vIGJlY2F1c2Ugd2hvIG5lZWRzIGEgY29udGV4dCBtZW51IG9uIGEgY2hlc3Nib2FyZFxyXG4gIHJlc2l6YWJsZTogYm9vbGVhbjsgLy8gbGlzdGVucyB0byBjaGVzc2dyb3VuZC5yZXNpemUgb24gZG9jdW1lbnQuYm9keSB0byBjbGVhciBib3VuZHMgY2FjaGVcclxuICBhZGRQaWVjZVpJbmRleDogYm9vbGVhbjsgLy8gYWRkcyB6LWluZGV4IHZhbHVlcyB0byBwaWVjZXMgKGZvciAzRClcclxuICBwaWVjZUtleTogYm9vbGVhbjsgLy8gYWRkIGEgZGF0YS1rZXkgYXR0cmlidXRlIHRvIHBpZWNlIGVsZW1lbnRzXHJcbiAgaGlnaGxpZ2h0OiB7XHJcbiAgICBsYXN0TW92ZTogYm9vbGVhbjsgLy8gYWRkIGxhc3QtbW92ZSBjbGFzcyB0byBzcXVhcmVzXHJcbiAgICBjaGVjazogYm9vbGVhbjsgLy8gYWRkIGNoZWNrIGNsYXNzIHRvIHNxdWFyZXNcclxuICB9O1xyXG4gIGFuaW1hdGlvbjoge1xyXG4gICAgZW5hYmxlZDogYm9vbGVhbjtcclxuICAgIGR1cmF0aW9uOiBudW1iZXI7XHJcbiAgICBjdXJyZW50PzogQW5pbUN1cnJlbnQ7XHJcbiAgfTtcclxuICBtb3ZhYmxlOiB7XHJcbiAgICBmcmVlOiBib29sZWFuOyAvLyBhbGwgbW92ZXMgYXJlIHZhbGlkIC0gYm9hcmQgZWRpdG9yXHJcbiAgICBjb2xvcj86IGNnLkNvbG9yIHwgJ2JvdGgnOyAvLyBjb2xvciB0aGF0IGNhbiBtb3ZlLiB3aGl0ZSB8IGJsYWNrIHwgYm90aFxyXG4gICAgZGVzdHM/OiBjZy5EZXN0czsgLy8gdmFsaWQgbW92ZXMuIHtcImEyXCIgW1wiYTNcIiBcImE0XCJdIFwiYjFcIiBbXCJhM1wiIFwiYzNcIl19XHJcbiAgICBzaG93RGVzdHM6IGJvb2xlYW47IC8vIHdoZXRoZXIgdG8gYWRkIHRoZSBtb3ZlLWRlc3QgY2xhc3Mgb24gc3F1YXJlc1xyXG4gICAgZXZlbnRzOiB7XHJcbiAgICAgIGFmdGVyPzogKG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5LCBtZXRhZGF0YTogY2cuTW92ZU1ldGFkYXRhKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIG1vdmUgaGFzIGJlZW4gcGxheWVkXHJcbiAgICAgIGFmdGVyTmV3UGllY2U/OiAocm9sZTogY2cuUm9sZSwga2V5OiBjZy5LZXksIG1ldGFkYXRhOiBjZy5Nb3ZlTWV0YWRhdGEpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciBhIG5ldyBwaWVjZSBpcyBkcm9wcGVkIG9uIHRoZSBib2FyZFxyXG4gICAgfTtcclxuICAgIHJvb2tDYXN0bGU6IGJvb2xlYW4gLy8gY2FzdGxlIGJ5IG1vdmluZyB0aGUga2luZyB0byB0aGUgcm9va1xyXG4gIH07XHJcbiAgcHJlbW92YWJsZToge1xyXG4gICAgZW5hYmxlZDogYm9vbGVhbjsgLy8gYWxsb3cgcHJlbW92ZXMgZm9yIGNvbG9yIHRoYXQgY2FuIG5vdCBtb3ZlXHJcbiAgICBzaG93RGVzdHM6IGJvb2xlYW47IC8vIHdoZXRoZXIgdG8gYWRkIHRoZSBwcmVtb3ZlLWRlc3QgY2xhc3Mgb24gc3F1YXJlc1xyXG4gICAgY2FzdGxlOiBib29sZWFuOyAvLyB3aGV0aGVyIHRvIGFsbG93IGtpbmcgY2FzdGxlIHByZW1vdmVzXHJcbiAgICBkZXN0cz86IGNnLktleVtdOyAvLyBwcmVtb3ZlIGRlc3RpbmF0aW9ucyBmb3IgdGhlIGN1cnJlbnQgc2VsZWN0aW9uXHJcbiAgICBjdXJyZW50PzogY2cuS2V5UGFpcjsgLy8ga2V5cyBvZiB0aGUgY3VycmVudCBzYXZlZCBwcmVtb3ZlIFtcImUyXCIgXCJlNFwiXVxyXG4gICAgZXZlbnRzOiB7XHJcbiAgICAgIHNldD86IChvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSwgbWV0YWRhdGE/OiBjZy5TZXRQcmVtb3ZlTWV0YWRhdGEpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgcHJlbW92ZSBoYXMgYmVlbiBzZXRcclxuICAgICAgdW5zZXQ/OiAoKSA9PiB2b2lkOyAgLy8gY2FsbGVkIGFmdGVyIHRoZSBwcmVtb3ZlIGhhcyBiZWVuIHVuc2V0XHJcbiAgICB9XHJcbiAgfTtcclxuICBwcmVkcm9wcGFibGU6IHtcclxuICAgIGVuYWJsZWQ6IGJvb2xlYW47IC8vIGFsbG93IHByZWRyb3BzIGZvciBjb2xvciB0aGF0IGNhbiBub3QgbW92ZVxyXG4gICAgY3VycmVudD86IHsgLy8gY3VycmVudCBzYXZlZCBwcmVkcm9wIHtyb2xlOiAna25pZ2h0Jzsga2V5OiAnZTQnfVxyXG4gICAgICByb2xlOiBjZy5Sb2xlO1xyXG4gICAgICBrZXk6IGNnLktleVxyXG4gICAgfTtcclxuICAgIGV2ZW50czoge1xyXG4gICAgICBzZXQ/OiAocm9sZTogY2cuUm9sZSwga2V5OiBjZy5LZXkpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgcHJlZHJvcCBoYXMgYmVlbiBzZXRcclxuICAgICAgdW5zZXQ/OiAoKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZWRyb3AgaGFzIGJlZW4gdW5zZXRcclxuICAgIH1cclxuICB9O1xyXG4gIGRyYWdnYWJsZToge1xyXG4gICAgZW5hYmxlZDogYm9vbGVhbjsgLy8gYWxsb3cgbW92ZXMgJiBwcmVtb3ZlcyB0byB1c2UgZHJhZyduIGRyb3BcclxuICAgIGRpc3RhbmNlOiBudW1iZXI7IC8vIG1pbmltdW0gZGlzdGFuY2UgdG8gaW5pdGlhdGUgYSBkcmFnOyBpbiBwaXhlbHNcclxuICAgIGF1dG9EaXN0YW5jZTogYm9vbGVhbjsgLy8gbGV0cyBjaGVzc2dyb3VuZCBzZXQgZGlzdGFuY2UgdG8gemVybyB3aGVuIHVzZXIgZHJhZ3MgcGllY2VzXHJcbiAgICBjZW50ZXJQaWVjZTogYm9vbGVhbjsgLy8gY2VudGVyIHRoZSBwaWVjZSBvbiBjdXJzb3IgYXQgZHJhZyBzdGFydFxyXG4gICAgc2hvd0dob3N0OiBib29sZWFuOyAvLyBzaG93IGdob3N0IG9mIHBpZWNlIGJlaW5nIGRyYWdnZWRcclxuICAgIGRlbGV0ZU9uRHJvcE9mZjogYm9vbGVhbjsgLy8gZGVsZXRlIGEgcGllY2Ugd2hlbiBpdCBpcyBkcm9wcGVkIG9mZiB0aGUgYm9hcmRcclxuICAgIGN1cnJlbnQ/OiBEcmFnQ3VycmVudDtcclxuICB9O1xyXG4gIHNlbGVjdGFibGU6IHtcclxuICAgIC8vIGRpc2FibGUgdG8gZW5mb3JjZSBkcmFnZ2luZyBvdmVyIGNsaWNrLWNsaWNrIG1vdmVcclxuICAgIGVuYWJsZWQ6IGJvb2xlYW5cclxuICB9O1xyXG4gIHN0YXRzOiB7XHJcbiAgICAvLyB3YXMgbGFzdCBwaWVjZSBkcmFnZ2VkIG9yIGNsaWNrZWQ/XHJcbiAgICAvLyBuZWVkcyBkZWZhdWx0IHRvIGZhbHNlIGZvciB0b3VjaFxyXG4gICAgZHJhZ2dlZDogYm9vbGVhbixcclxuICAgIGN0cmxLZXk/OiBib29sZWFuXHJcbiAgfTtcclxuICBldmVudHM6IHtcclxuICAgIGNoYW5nZT86ICgpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgc2l0dWF0aW9uIGNoYW5nZXMgb24gdGhlIGJvYXJkXHJcbiAgICAvLyBjYWxsZWQgYWZ0ZXIgYSBwaWVjZSBoYXMgYmVlbiBtb3ZlZC5cclxuICAgIC8vIGNhcHR1cmVkUGllY2UgaXMgdW5kZWZpbmVkIG9yIGxpa2Uge2NvbG9yOiAnd2hpdGUnOyAncm9sZSc6ICdxdWVlbid9XHJcbiAgICBtb3ZlPzogKG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5LCBjYXB0dXJlZFBpZWNlPzogY2cuUGllY2UpID0+IHZvaWQ7XHJcbiAgICBkcm9wTmV3UGllY2U/OiAocGllY2U6IGNnLlBpZWNlLCBrZXk6IGNnLktleSkgPT4gdm9pZDtcclxuICAgIHNlbGVjdD86IChrZXk6IGNnLktleSkgPT4gdm9pZCAvLyBjYWxsZWQgd2hlbiBhIHNxdWFyZSBpcyBzZWxlY3RlZFxyXG4gIH07XHJcbiAgaXRlbXM/OiAocG9zOiBjZy5Qb3MsIGtleTogY2cuS2V5KSA9PiBhbnkgfCB1bmRlZmluZWQ7IC8vIGl0ZW1zIG9uIHRoZSBib2FyZCB7IHJlbmRlcjoga2V5IC0+IHZkb20gfVxyXG4gIGRyYXdhYmxlOiBEcmF3YWJsZSxcclxuICBleHBsb2Rpbmc/OiBjZy5FeHBsb2Rpbmc7XHJcbiAgZG9tOiBjZy5Eb20sXHJcbiAgaG9sZDogY2cuVGltZXJcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGRlZmF1bHRzKCk6IFBhcnRpYWw8U3RhdGU+IHtcclxuICByZXR1cm4ge1xyXG4gICAgcGllY2VzOiBmZW4ucmVhZChmZW4uaW5pdGlhbCksXHJcbiAgICBvcmllbnRhdGlvbjogJ3doaXRlJyxcclxuICAgIHR1cm5Db2xvcjogJ3doaXRlJyxcclxuICAgIGNvb3JkaW5hdGVzOiB0cnVlLFxyXG4gICAgYXV0b0Nhc3RsZTogdHJ1ZSxcclxuXHJcbiAgICByb3RhdGUgOiB0cnVlLFxyXG5cclxuICAgIHZpZXdPbmx5OiBmYWxzZSxcclxuICAgIGRpc2FibGVDb250ZXh0TWVudTogZmFsc2UsXHJcbiAgICByZXNpemFibGU6IHRydWUsXHJcbiAgICBhZGRQaWVjZVpJbmRleDogZmFsc2UsXHJcbiAgICBwaWVjZUtleTogZmFsc2UsXHJcbiAgICBoaWdobGlnaHQ6IHtcclxuICAgICAgbGFzdE1vdmU6IHRydWUsXHJcbiAgICAgIGNoZWNrOiB0cnVlXHJcbiAgICB9LFxyXG4gICAgYW5pbWF0aW9uOiB7XHJcbiAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgIGR1cmF0aW9uOiAyMDBcclxuICAgIH0sXHJcbiAgICBtb3ZhYmxlOiB7XHJcbiAgICAgIGZyZWU6IHRydWUsXHJcbiAgICAgIGNvbG9yOiAnYm90aCcsXHJcbiAgICAgIHNob3dEZXN0czogdHJ1ZSxcclxuICAgICAgZXZlbnRzOiB7fSxcclxuICAgICAgcm9va0Nhc3RsZTogdHJ1ZVxyXG4gICAgfSxcclxuICAgIHByZW1vdmFibGU6IHtcclxuICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgc2hvd0Rlc3RzOiB0cnVlLFxyXG4gICAgICBjYXN0bGU6IHRydWUsXHJcbiAgICAgIGV2ZW50czoge31cclxuICAgIH0sXHJcbiAgICBwcmVkcm9wcGFibGU6IHtcclxuICAgICAgZW5hYmxlZDogZmFsc2UsXHJcbiAgICAgIGV2ZW50czoge31cclxuICAgIH0sXHJcbiAgICBkcmFnZ2FibGU6IHtcclxuICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgZGlzdGFuY2U6IDMsXHJcbiAgICAgIGF1dG9EaXN0YW5jZTogdHJ1ZSxcclxuICAgICAgY2VudGVyUGllY2U6IHRydWUsXHJcbiAgICAgIHNob3dHaG9zdDogdHJ1ZSxcclxuICAgICAgZGVsZXRlT25Ecm9wT2ZmOiBmYWxzZVxyXG4gICAgfSxcclxuICAgIHNlbGVjdGFibGU6IHtcclxuICAgICAgZW5hYmxlZDogdHJ1ZVxyXG4gICAgfSxcclxuICAgIHN0YXRzOiB7XHJcbiAgICAgIC8vIG9uIHRvdWNoc2NyZWVuLCBkZWZhdWx0IHRvIFwidGFwLXRhcFwiIG1vdmVzXHJcbiAgICAgIC8vIGluc3RlYWQgb2YgZHJhZ1xyXG4gICAgICBkcmFnZ2VkOiAhKCdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdylcclxuICAgIH0sXHJcbiAgICBldmVudHM6IHt9LFxyXG4gICAgZHJhd2FibGU6IHtcclxuICAgICAgZW5hYmxlZDogdHJ1ZSwgLy8gY2FuIGRyYXdcclxuICAgICAgdmlzaWJsZTogdHJ1ZSwgLy8gY2FuIHZpZXdcclxuICAgICAgZXJhc2VPbkNsaWNrOiB0cnVlLFxyXG4gICAgICBzaGFwZXM6IFtdLFxyXG4gICAgICBhdXRvU2hhcGVzOiBbXSxcclxuICAgICAgYnJ1c2hlczoge1xyXG4gICAgICAgIGdyZWVuOiB7IGtleTogJ2cnLCBjb2xvcjogJyMxNTc4MUInLCBvcGFjaXR5OiAxLCBsaW5lV2lkdGg6IDEwIH0sXHJcbiAgICAgICAgcmVkOiB7IGtleTogJ3InLCBjb2xvcjogJyM4ODIwMjAnLCBvcGFjaXR5OiAxLCBsaW5lV2lkdGg6IDEwIH0sXHJcbiAgICAgICAgYmx1ZTogeyBrZXk6ICdiJywgY29sb3I6ICcjMDAzMDg4Jywgb3BhY2l0eTogMSwgbGluZVdpZHRoOiAxMCB9LFxyXG4gICAgICAgIHllbGxvdzogeyBrZXk6ICd5JywgY29sb3I6ICcjZTY4ZjAwJywgb3BhY2l0eTogMSwgbGluZVdpZHRoOiAxMCB9LFxyXG4gICAgICAgIHBhbGVCbHVlOiB7IGtleTogJ3BiJywgY29sb3I6ICcjMDAzMDg4Jywgb3BhY2l0eTogMC40LCBsaW5lV2lkdGg6IDE1IH0sXHJcbiAgICAgICAgcGFsZUdyZWVuOiB7IGtleTogJ3BnJywgY29sb3I6ICcjMTU3ODFCJywgb3BhY2l0eTogMC40LCBsaW5lV2lkdGg6IDE1IH0sXHJcbiAgICAgICAgcGFsZVJlZDogeyBrZXk6ICdwcicsIGNvbG9yOiAnIzg4MjAyMCcsIG9wYWNpdHk6IDAuNCwgbGluZVdpZHRoOiAxNSB9LFxyXG4gICAgICAgIHBhbGVHcmV5OiB7IGtleTogJ3BncicsIGNvbG9yOiAnIzRhNGE0YScsIG9wYWNpdHk6IDAuMzUsIGxpbmVXaWR0aDogMTUgfVxyXG4gICAgICB9LFxyXG4gICAgICBwaWVjZXM6IHtcclxuICAgICAgICBiYXNlVXJsOiAnaHR0cHM6Ly9saWNoZXNzMS5vcmcvYXNzZXRzL3BpZWNlL2NidXJuZXR0LydcclxuICAgICAgfSxcclxuICAgICAgcHJldlN2Z0hhc2g6ICcnXHJcbiAgICB9LFxyXG4gICAgaG9sZDogdGltZXIoKVxyXG4gIH07XHJcbn1cclxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xyXG5pbXBvcnQgeyBrZXkycG9zLCBjb21wdXRlSXNUcmlkZW50IH0gZnJvbSAnLi91dGlsJ1xyXG5pbXBvcnQgeyBEcmF3YWJsZSwgRHJhd1NoYXBlLCBEcmF3U2hhcGVQaWVjZSwgRHJhd0JydXNoLCBEcmF3QnJ1c2hlcywgRHJhd01vZGlmaWVycyB9IGZyb20gJy4vZHJhdydcclxuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWU6IHN0cmluZyk6IFNWR0VsZW1lbnQge1xyXG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgdGFnTmFtZSk7XHJcbn1cclxuXHJcbmludGVyZmFjZSBTaGFwZSB7XHJcbiAgc2hhcGU6IERyYXdTaGFwZTtcclxuICBjdXJyZW50OiBib29sZWFuO1xyXG4gIGhhc2g6IEhhc2g7XHJcbn1cclxuXHJcbmludGVyZmFjZSBDdXN0b21CcnVzaGVzIHtcclxuICBbaGFzaDogc3RyaW5nXTogRHJhd0JydXNoXHJcbn1cclxuXHJcbmludGVyZmFjZSBBcnJvd0Rlc3RzIHtcclxuICBba2V5OiBzdHJpbmddOiBudW1iZXI7IC8vIGhvdyBtYW55IGFycm93cyBsYW5kIG9uIGEgc3F1YXJlXHJcbn1cclxuXHJcbnR5cGUgSGFzaCA9IHN0cmluZztcclxuXHJcbmxldCBpc1RyaWRlbnQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyU3ZnKHN0YXRlOiBTdGF0ZSwgcm9vdDogU1ZHRWxlbWVudCk6IHZvaWQge1xyXG5cclxuICBjb25zdCBkID0gc3RhdGUuZHJhd2FibGUsXHJcbiAgY3VyID0gZC5jdXJyZW50LFxyXG4gIGFycm93RGVzdHM6IEFycm93RGVzdHMgPSB7fTtcclxuXHJcbiAgZC5zaGFwZXMuY29uY2F0KGQuYXV0b1NoYXBlcykuY29uY2F0KGN1ciA/IFtjdXJdIDogW10pLmZvckVhY2gocyA9PiB7XHJcbiAgICBpZiAocy5kZXN0KSBhcnJvd0Rlc3RzW3MuZGVzdF0gPSAoYXJyb3dEZXN0c1tzLmRlc3RdIHx8IDApICsgMTtcclxuICB9KTtcclxuXHJcbiAgY29uc3Qgc2hhcGVzOiBTaGFwZVtdID0gZC5zaGFwZXMuY29uY2F0KGQuYXV0b1NoYXBlcykubWFwKChzOiBEcmF3U2hhcGUpID0+IHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHNoYXBlOiBzLFxyXG4gICAgICBjdXJyZW50OiBmYWxzZSxcclxuICAgICAgaGFzaDogc2hhcGVIYXNoKHMsIGFycm93RGVzdHMsIGZhbHNlKVxyXG4gICAgfTtcclxuICB9KTtcclxuICBpZiAoY3VyKSBzaGFwZXMucHVzaCh7XHJcbiAgICBzaGFwZTogY3VyIGFzIERyYXdTaGFwZSxcclxuICAgIGN1cnJlbnQ6IHRydWUsXHJcbiAgICBoYXNoOiBzaGFwZUhhc2goY3VyLCBhcnJvd0Rlc3RzLCB0cnVlKVxyXG4gIH0pO1xyXG5cclxuICBjb25zdCBmdWxsSGFzaCA9IHNoYXBlcy5tYXAoc2MgPT4gc2MuaGFzaCkuam9pbignJyk7XHJcbiAgaWYgKGZ1bGxIYXNoID09PSBzdGF0ZS5kcmF3YWJsZS5wcmV2U3ZnSGFzaCkgcmV0dXJuO1xyXG4gIHN0YXRlLmRyYXdhYmxlLnByZXZTdmdIYXNoID0gZnVsbEhhc2g7XHJcblxyXG4gIGNvbnN0IGRlZnNFbCA9IHJvb3QuZmlyc3RDaGlsZCBhcyBTVkdFbGVtZW50O1xyXG5cclxuICBzeW5jRGVmcyhkLCBzaGFwZXMsIGRlZnNFbCk7XHJcbiAgc3luY1NoYXBlcyhzdGF0ZSwgc2hhcGVzLCBkLmJydXNoZXMsIGFycm93RGVzdHMsIHJvb3QsIGRlZnNFbCk7XHJcbn1cclxuXHJcbi8vIGFwcGVuZCBvbmx5LiBEb24ndCB0cnkgdG8gdXBkYXRlL3JlbW92ZS5cclxuZnVuY3Rpb24gc3luY0RlZnMoZDogRHJhd2FibGUsIHNoYXBlczogU2hhcGVbXSwgZGVmc0VsOiBTVkdFbGVtZW50KSB7XHJcbiAgY29uc3QgYnJ1c2hlczogQ3VzdG9tQnJ1c2hlcyA9IHt9O1xyXG4gIGxldCBicnVzaDogRHJhd0JydXNoO1xyXG4gIHNoYXBlcy5mb3JFYWNoKHMgPT4ge1xyXG4gICAgaWYgKHMuc2hhcGUuZGVzdCkge1xyXG4gICAgICBicnVzaCA9IGQuYnJ1c2hlc1tzLnNoYXBlLmJydXNoXTtcclxuICAgICAgaWYgKHMuc2hhcGUubW9kaWZpZXJzKSBicnVzaCA9IG1ha2VDdXN0b21CcnVzaChicnVzaCwgcy5zaGFwZS5tb2RpZmllcnMpO1xyXG4gICAgICBicnVzaGVzW2JydXNoLmtleV0gPSBicnVzaDtcclxuICAgIH1cclxuICB9KTtcclxuICBjb25zdCBrZXlzSW5Eb206IHtba2V5OiBzdHJpbmddOiBib29sZWFufSA9IHt9O1xyXG4gIGxldCBlbDogU1ZHRWxlbWVudCA9IGRlZnNFbC5maXJzdENoaWxkIGFzIFNWR0VsZW1lbnQ7XHJcbiAgd2hpbGUoZWwpIHtcclxuICAgIGtleXNJbkRvbVtlbC5nZXRBdHRyaWJ1dGUoJ2NnS2V5JykgYXMgc3RyaW5nXSA9IHRydWU7XHJcbiAgICBlbCA9IGVsLm5leHRTaWJsaW5nIGFzIFNWR0VsZW1lbnQ7XHJcbiAgfVxyXG4gIGZvciAobGV0IGtleSBpbiBicnVzaGVzKSB7XHJcbiAgICBpZiAoIWtleXNJbkRvbVtrZXldKSBkZWZzRWwuYXBwZW5kQ2hpbGQocmVuZGVyTWFya2VyKGJydXNoZXNba2V5XSkpO1xyXG4gIH1cclxufVxyXG5cclxuLy8gYXBwZW5kIGFuZCByZW1vdmUgb25seS4gTm8gdXBkYXRlcy5cclxuZnVuY3Rpb24gc3luY1NoYXBlcyhzdGF0ZTogU3RhdGUsIHNoYXBlczogU2hhcGVbXSwgYnJ1c2hlczogRHJhd0JydXNoZXMsIGFycm93RGVzdHM6IEFycm93RGVzdHMsIHJvb3Q6IFNWR0VsZW1lbnQsIGRlZnNFbDogU1ZHRWxlbWVudCk6IHZvaWQge1xyXG4gIGlmIChpc1RyaWRlbnQgPT09IHVuZGVmaW5lZCkgaXNUcmlkZW50ID0gY29tcHV0ZUlzVHJpZGVudCgpO1xyXG4gIGNvbnN0IGJvdW5kcyA9IHN0YXRlLmRvbS5ib3VuZHMoKSxcclxuICBoYXNoZXNJbkRvbToge1toYXNoOiBzdHJpbmddOiBib29sZWFufSA9IHt9LFxyXG4gIHRvUmVtb3ZlOiBTVkdFbGVtZW50W10gPSBbXTtcclxuICBzaGFwZXMuZm9yRWFjaChzYyA9PiB7IGhhc2hlc0luRG9tW3NjLmhhc2hdID0gZmFsc2U7IH0pO1xyXG4gIGxldCBlbDogU1ZHRWxlbWVudCA9IGRlZnNFbC5uZXh0U2libGluZyBhcyBTVkdFbGVtZW50LCBlbEhhc2g6IEhhc2g7XHJcbiAgd2hpbGUoZWwpIHtcclxuICAgIGVsSGFzaCA9IGVsLmdldEF0dHJpYnV0ZSgnY2dIYXNoJykgYXMgSGFzaDtcclxuICAgIC8vIGZvdW5kIGEgc2hhcGUgZWxlbWVudCB0aGF0J3MgaGVyZSB0byBzdGF5XHJcbiAgICBpZiAoaGFzaGVzSW5Eb20uaGFzT3duUHJvcGVydHkoZWxIYXNoKSkgaGFzaGVzSW5Eb21bZWxIYXNoXSA9IHRydWU7XHJcbiAgICAvLyBvciByZW1vdmUgaXRcclxuICAgIGVsc2UgdG9SZW1vdmUucHVzaChlbCk7XHJcbiAgICBlbCA9IGVsLm5leHRTaWJsaW5nIGFzIFNWR0VsZW1lbnQ7XHJcbiAgfVxyXG4gIC8vIHJlbW92ZSBvbGQgc2hhcGVzXHJcbiAgdG9SZW1vdmUuZm9yRWFjaChlbCA9PiByb290LnJlbW92ZUNoaWxkKGVsKSk7XHJcbiAgLy8gaW5zZXJ0IHNoYXBlcyB0aGF0IGFyZSBub3QgeWV0IGluIGRvbVxyXG4gIHNoYXBlcy5mb3JFYWNoKHNjID0+IHtcclxuICAgIGlmICghaGFzaGVzSW5Eb21bc2MuaGFzaF0pIHJvb3QuYXBwZW5kQ2hpbGQocmVuZGVyU2hhcGUoc3RhdGUsIHNjLCBicnVzaGVzLCBhcnJvd0Rlc3RzLCBib3VuZHMpKTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2hhcGVIYXNoKHtvcmlnLCBkZXN0LCBicnVzaCwgcGllY2UsIG1vZGlmaWVyc306IERyYXdTaGFwZSwgYXJyb3dEZXN0czogQXJyb3dEZXN0cywgY3VycmVudDogYm9vbGVhbik6IEhhc2gge1xyXG4gIHJldHVybiBbY3VycmVudCwgb3JpZywgZGVzdCwgYnJ1c2gsIGRlc3QgJiYgYXJyb3dEZXN0c1tkZXN0XSxcclxuICAgIHBpZWNlICYmIHBpZWNlSGFzaChwaWVjZSksXHJcbiAgICBtb2RpZmllcnMgJiYgbW9kaWZpZXJzSGFzaChtb2RpZmllcnMpXHJcbiAgXS5maWx0ZXIoeCA9PiB4KS5qb2luKCcnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGllY2VIYXNoKHBpZWNlOiBEcmF3U2hhcGVQaWVjZSk6IEhhc2gge1xyXG4gIHJldHVybiBbcGllY2UuY29sb3IsIHBpZWNlLnJvbGUsIHBpZWNlLnNjYWxlXS5maWx0ZXIoeCA9PiB4KS5qb2luKCcnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbW9kaWZpZXJzSGFzaChtOiBEcmF3TW9kaWZpZXJzKTogSGFzaCB7XHJcbiAgcmV0dXJuICcnICsgKG0ubGluZVdpZHRoIHx8ICcnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVuZGVyU2hhcGUoc3RhdGU6IFN0YXRlLCB7c2hhcGUsIGN1cnJlbnQsIGhhc2h9OiBTaGFwZSwgYnJ1c2hlczogRHJhd0JydXNoZXMsIGFycm93RGVzdHM6IEFycm93RGVzdHMsIGJvdW5kczogQ2xpZW50UmVjdCk6IFNWR0VsZW1lbnQge1xyXG4gIGxldCBlbDogU1ZHRWxlbWVudDtcclxuICBpZiAoc2hhcGUucGllY2UpIGVsID0gcmVuZGVyUGllY2UoXHJcbiAgICBzdGF0ZS5kcmF3YWJsZS5waWVjZXMuYmFzZVVybCxcclxuICAgIG9yaWVudChrZXkycG9zKHNoYXBlLm9yaWcpLCBzdGF0ZS5vcmllbnRhdGlvbiksXHJcbiAgICBzaGFwZS5waWVjZSxcclxuICAgIGJvdW5kcyk7XHJcbiAgZWxzZSB7XHJcbiAgICBjb25zdCBvcmlnID0gb3JpZW50KGtleTJwb3Moc2hhcGUub3JpZyksIHN0YXRlLm9yaWVudGF0aW9uKTtcclxuICAgIGlmIChzaGFwZS5vcmlnICYmIHNoYXBlLmRlc3QpIHtcclxuICAgICAgbGV0IGJydXNoOiBEcmF3QnJ1c2ggPSBicnVzaGVzW3NoYXBlLmJydXNoXTtcclxuICAgICAgaWYgKHNoYXBlLm1vZGlmaWVycykgYnJ1c2ggPSBtYWtlQ3VzdG9tQnJ1c2goYnJ1c2gsIHNoYXBlLm1vZGlmaWVycyk7XHJcbiAgICAgIGVsID0gcmVuZGVyQXJyb3coXHJcbiAgICAgICAgYnJ1c2gsXHJcbiAgICAgICAgb3JpZyxcclxuICAgICAgICBvcmllbnQoa2V5MnBvcyhzaGFwZS5kZXN0KSwgc3RhdGUub3JpZW50YXRpb24pLFxyXG4gICAgICAgIGN1cnJlbnQsXHJcbiAgICAgICAgYXJyb3dEZXN0c1tzaGFwZS5kZXN0XSA+IDEsXHJcbiAgICAgICAgYm91bmRzKTtcclxuICAgIH1cclxuICAgIGVsc2UgZWwgPSByZW5kZXJDaXJjbGUoYnJ1c2hlc1tzaGFwZS5icnVzaF0sIG9yaWcsIGN1cnJlbnQsIGJvdW5kcyk7XHJcbiAgfVxyXG4gIGVsLnNldEF0dHJpYnV0ZSgnY2dIYXNoJywgaGFzaCk7XHJcbiAgcmV0dXJuIGVsO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJDaXJjbGUoYnJ1c2g6IERyYXdCcnVzaCwgcG9zOiBjZy5Qb3MsIGN1cnJlbnQ6IGJvb2xlYW4sIGJvdW5kczogQ2xpZW50UmVjdCk6IFNWR0VsZW1lbnQge1xyXG4gIGNvbnN0IG8gPSBwb3MycHgocG9zLCBib3VuZHMpLFxyXG4gIHdpZHRoID0gY2lyY2xlV2lkdGgoY3VycmVudCwgYm91bmRzKSxcclxuICByYWRpdXMgPSAoYm91bmRzLndpZHRoICsgYm91bmRzLmhlaWdodCkgLyAzMjtcclxuICByZXR1cm4gc2V0QXR0cmlidXRlcyhjcmVhdGVFbGVtZW50KCdjaXJjbGUnKSwge1xyXG4gICAgc3Ryb2tlOiBicnVzaC5jb2xvcixcclxuICAgICdzdHJva2Utd2lkdGgnOiB3aWR0aCxcclxuICAgIGZpbGw6ICdub25lJyxcclxuICAgIG9wYWNpdHk6IG9wYWNpdHkoYnJ1c2gsIGN1cnJlbnQpLFxyXG4gICAgY3g6IG9bMF0sXHJcbiAgICBjeTogb1sxXSxcclxuICAgIHI6IHJhZGl1cyAtIHdpZHRoIC8gMlxyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJBcnJvdyhicnVzaDogRHJhd0JydXNoLCBvcmlnOiBjZy5Qb3MsIGRlc3Q6IGNnLlBvcywgY3VycmVudDogYm9vbGVhbiwgc2hvcnRlbjogYm9vbGVhbiwgYm91bmRzOiBDbGllbnRSZWN0KTogU1ZHRWxlbWVudCB7XHJcbiAgY29uc3QgbSA9IGFycm93TWFyZ2luKGJvdW5kcywgc2hvcnRlbiAmJiAhY3VycmVudCksXHJcbiAgYSA9IHBvczJweChvcmlnLCBib3VuZHMpLFxyXG4gIGIgPSBwb3MycHgoZGVzdCwgYm91bmRzKSxcclxuICBkeCA9IGJbMF0gLSBhWzBdLFxyXG4gIGR5ID0gYlsxXSAtIGFbMV0sXHJcbiAgYW5nbGUgPSBNYXRoLmF0YW4yKGR5LCBkeCksXHJcbiAgeG8gPSBNYXRoLmNvcyhhbmdsZSkgKiBtLFxyXG4gIHlvID0gTWF0aC5zaW4oYW5nbGUpICogbTtcclxuICByZXR1cm4gc2V0QXR0cmlidXRlcyhjcmVhdGVFbGVtZW50KCdsaW5lJyksIHtcclxuICAgIHN0cm9rZTogYnJ1c2guY29sb3IsXHJcbiAgICAnc3Ryb2tlLXdpZHRoJzogbGluZVdpZHRoKGJydXNoLCBjdXJyZW50LCBib3VuZHMpLFxyXG4gICAgJ3N0cm9rZS1saW5lY2FwJzogJ3JvdW5kJyxcclxuICAgICdtYXJrZXItZW5kJzogaXNUcmlkZW50ID8gdW5kZWZpbmVkIDogJ3VybCgjYXJyb3doZWFkLScgKyBicnVzaC5rZXkgKyAnKScsXHJcbiAgICBvcGFjaXR5OiBvcGFjaXR5KGJydXNoLCBjdXJyZW50KSxcclxuICAgIHgxOiBhWzBdLFxyXG4gICAgeTE6IGFbMV0sXHJcbiAgICB4MjogYlswXSAtIHhvLFxyXG4gICAgeTI6IGJbMV0gLSB5b1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJQaWVjZShiYXNlVXJsOiBzdHJpbmcsIHBvczogY2cuUG9zLCBwaWVjZTogRHJhd1NoYXBlUGllY2UsIGJvdW5kczogQ2xpZW50UmVjdCk6IFNWR0VsZW1lbnQge1xyXG4gIGNvbnN0IG8gPSBwb3MycHgocG9zLCBib3VuZHMpLFxyXG4gIHNpemUgPSBib3VuZHMud2lkdGggLyA4ICogKHBpZWNlLnNjYWxlIHx8IDEpLFxyXG4gIG5hbWUgPSBwaWVjZS5jb2xvclswXSArIChwaWVjZS5yb2xlID09PSAna25pZ2h0JyA/ICduJyA6IHBpZWNlLnJvbGVbMF0pLnRvVXBwZXJDYXNlKCk7XHJcbiAgcmV0dXJuIHNldEF0dHJpYnV0ZXMoY3JlYXRlRWxlbWVudCgnaW1hZ2UnKSwge1xyXG4gICAgY2xhc3NOYW1lOiBgJHtwaWVjZS5yb2xlfSAke3BpZWNlLmNvbG9yfWAsXHJcbiAgICB4OiBvWzBdIC0gc2l6ZSAvIDIsXHJcbiAgICB5OiBvWzFdIC0gc2l6ZSAvIDIsXHJcbiAgICB3aWR0aDogc2l6ZSxcclxuICAgIGhlaWdodDogc2l6ZSxcclxuICAgIGhyZWY6IGJhc2VVcmwgKyBuYW1lICsgJy5zdmcnXHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlck1hcmtlcihicnVzaDogRHJhd0JydXNoKTogU1ZHRWxlbWVudCB7XHJcbiAgY29uc3QgbWFya2VyID0gc2V0QXR0cmlidXRlcyhjcmVhdGVFbGVtZW50KCdtYXJrZXInKSwge1xyXG4gICAgaWQ6ICdhcnJvd2hlYWQtJyArIGJydXNoLmtleSxcclxuICAgIG9yaWVudDogJ2F1dG8nLFxyXG4gICAgbWFya2VyV2lkdGg6IDQsXHJcbiAgICBtYXJrZXJIZWlnaHQ6IDgsXHJcbiAgICByZWZYOiAyLjA1LFxyXG4gICAgcmVmWTogMi4wMVxyXG4gIH0pO1xyXG4gIG1hcmtlci5hcHBlbmRDaGlsZChzZXRBdHRyaWJ1dGVzKGNyZWF0ZUVsZW1lbnQoJ3BhdGgnKSwge1xyXG4gICAgZDogJ00wLDAgVjQgTDMsMiBaJyxcclxuICAgIGZpbGw6IGJydXNoLmNvbG9yXHJcbiAgfSkpO1xyXG4gIG1hcmtlci5zZXRBdHRyaWJ1dGUoJ2NnS2V5JywgYnJ1c2gua2V5KTtcclxuICByZXR1cm4gbWFya2VyO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGVzKGVsOiBTVkdFbGVtZW50LCBhdHRyczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSk6IFNWR0VsZW1lbnQge1xyXG4gIGZvciAobGV0IGtleSBpbiBhdHRycykgZWwuc2V0QXR0cmlidXRlKGtleSwgYXR0cnNba2V5XSk7XHJcbiAgcmV0dXJuIGVsO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvcmllbnQocG9zOiBjZy5Qb3MsIGNvbG9yOiBjZy5Db2xvcik6IGNnLlBvcyB7XHJcbiAgcmV0dXJuIGNvbG9yID09PSAnd2hpdGUnID8gcG9zIDogWzkgLSBwb3NbMF0sIDkgLSBwb3NbMV1dO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtYWtlQ3VzdG9tQnJ1c2goYmFzZTogRHJhd0JydXNoLCBtb2RpZmllcnM6IERyYXdNb2RpZmllcnMpOiBEcmF3QnJ1c2gge1xyXG4gIGNvbnN0IGJydXNoOiBQYXJ0aWFsPERyYXdCcnVzaD4gPSB7XHJcbiAgICBjb2xvcjogYmFzZS5jb2xvcixcclxuICAgIG9wYWNpdHk6IE1hdGgucm91bmQoYmFzZS5vcGFjaXR5ICogMTApIC8gMTAsXHJcbiAgICBsaW5lV2lkdGg6IE1hdGgucm91bmQobW9kaWZpZXJzLmxpbmVXaWR0aCB8fCBiYXNlLmxpbmVXaWR0aClcclxuICB9O1xyXG4gIGJydXNoLmtleSA9IFtiYXNlLmtleSwgbW9kaWZpZXJzLmxpbmVXaWR0aF0uZmlsdGVyKHggPT4geCkuam9pbignJyk7XHJcbiAgcmV0dXJuIGJydXNoIGFzIERyYXdCcnVzaDtcclxufVxyXG5cclxuZnVuY3Rpb24gY2lyY2xlV2lkdGgoY3VycmVudDogYm9vbGVhbiwgYm91bmRzOiBDbGllbnRSZWN0KTogbnVtYmVyIHtcclxuICByZXR1cm4gKGN1cnJlbnQgPyAzIDogNCkgLyA1MTIgKiBib3VuZHMud2lkdGg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGxpbmVXaWR0aChicnVzaDogRHJhd0JydXNoLCBjdXJyZW50OiBib29sZWFuLCBib3VuZHM6IENsaWVudFJlY3QpOiBudW1iZXIge1xyXG4gIHJldHVybiAoYnJ1c2gubGluZVdpZHRoIHx8IDEwKSAqIChjdXJyZW50ID8gMC44NSA6IDEpIC8gNTEyICogYm91bmRzLndpZHRoO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvcGFjaXR5KGJydXNoOiBEcmF3QnJ1c2gsIGN1cnJlbnQ6IGJvb2xlYW4pOiBudW1iZXIge1xyXG4gIHJldHVybiAoYnJ1c2gub3BhY2l0eSB8fCAxKSAqIChjdXJyZW50ID8gMC45IDogMSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFycm93TWFyZ2luKGJvdW5kczogQ2xpZW50UmVjdCwgc2hvcnRlbjogYm9vbGVhbik6IG51bWJlciB7XHJcbiAgcmV0dXJuIGlzVHJpZGVudCA/IDAgOiAoKHNob3J0ZW4gPyAyMCA6IDEwKSAvIDUxMiAqIGJvdW5kcy53aWR0aCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBvczJweChwb3M6IGNnLlBvcywgYm91bmRzOiBDbGllbnRSZWN0KTogY2cuTnVtYmVyUGFpciB7XHJcbiAgcmV0dXJuIFsocG9zWzBdIC0gMC41KSAqIGJvdW5kcy53aWR0aCAvIDgsICg4LjUgLSBwb3NbMV0pICogYm91bmRzLmhlaWdodCAvIDhdO1xyXG59XHJcbiIsImV4cG9ydCB0eXBlIENvbG9yID0gJ3doaXRlJyB8ICdibGFjayc7XHJcbmV4cG9ydCB0eXBlIFJvbGUgPSAna2luZycgfCAncXVlZW4nIHwgJ3Jvb2snIHwgJ2Jpc2hvcCcgfCAna25pZ2h0JyB8ICdwYXduJztcclxuZXhwb3J0IHR5cGUgS2V5ID0gJ2EwJyB8ICdhMScgfCAnYjEnIHwgJ2MxJyB8ICdkMScgfCAnZTEnIHwgJ2YxJyB8ICdnMScgfCAnaDEnIHwgJ2EyJyB8ICdiMicgfCAnYzInIHwgJ2QyJyB8ICdlMicgfCAnZjInIHwgJ2cyJyB8ICdoMicgfCAnYTMnIHwgJ2IzJyB8ICdjMycgfCAnZDMnIHwgJ2UzJyB8ICdmMycgfCAnZzMnIHwgJ2gzJyB8ICdhNCcgfCAnYjQnIHwgJ2M0JyB8ICdkNCcgfCAnZTQnIHwgJ2Y0JyB8ICdnNCcgfCAnaDQnIHwgJ2E1JyB8ICdiNScgfCAnYzUnIHwgJ2Q1JyB8ICdlNScgfCAnZjUnIHwgJ2c1JyB8ICdoNScgfCAnYTYnIHwgJ2I2JyB8ICdjNicgfCAnZDYnIHwgJ2U2JyB8ICdmNicgfCAnZzYnIHwgJ2g2JyB8ICdhNycgfCAnYjcnIHwgJ2M3JyB8ICdkNycgfCAnZTcnIHwgJ2Y3JyB8ICdnNycgfCAnaDcnIHwgJ2E4JyB8ICdiOCcgfCAnYzgnIHwgJ2Q4JyB8ICdlOCcgfCAnZjgnIHwgJ2c4JyB8ICdoOCc7XHJcbmV4cG9ydCB0eXBlIEZpbGUgPSAnYScgfCAnYicgfCAnYycgfCAnZCcgfCAnZScgfCAnZicgfCAnZycgfCAnaCc7XHJcbmV4cG9ydCB0eXBlIFJhbmsgPSAxIHwgMiB8IDMgfCA0IHwgNSB8IDYgfCA3IHwgODtcclxuZXhwb3J0IHR5cGUgRkVOID0gc3RyaW5nO1xyXG5leHBvcnQgdHlwZSBQb3MgPSBbbnVtYmVyLCBudW1iZXJdO1xyXG5leHBvcnQgaW50ZXJmYWNlIFBpZWNlIHtcclxuICByb2xlOiBSb2xlO1xyXG4gIGNvbG9yOiBDb2xvcjtcclxuICBwcm9tb3RlZD86IGJvb2xlYW47XHJcbn1cclxuZXhwb3J0IGludGVyZmFjZSBEcm9wIHtcclxuICByb2xlOiBSb2xlO1xyXG4gIGtleTogS2V5O1xyXG59XHJcbmV4cG9ydCBpbnRlcmZhY2UgUGllY2VzIHtcclxuICBba2V5OiBzdHJpbmddOiBQaWVjZTtcclxufVxyXG5leHBvcnQgaW50ZXJmYWNlIFBpZWNlc0RpZmYge1xyXG4gIFtrZXk6IHN0cmluZ106IFBpZWNlIHwgbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgS2V5UGFpciA9IFtLZXksIEtleV07XHJcblxyXG5leHBvcnQgdHlwZSBOdW1iZXJQYWlyID0gW251bWJlciwgbnVtYmVyXTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGVzdHMge1xyXG4gIFtrZXk6IHN0cmluZ106IEtleVtdXHJcbn1cclxuZXhwb3J0IGludGVyZmFjZSBNYXRlcmlhbERpZmZTaWRlIHtcclxuICBbcm9sZTogc3RyaW5nXTogbnVtYmVyO1xyXG59XHJcbmV4cG9ydCBpbnRlcmZhY2UgTWF0ZXJpYWxEaWZmIHtcclxuICB3aGl0ZTogTWF0ZXJpYWxEaWZmU2lkZTtcclxuICBibGFjazogTWF0ZXJpYWxEaWZmU2lkZTtcclxufVxyXG5leHBvcnQgaW50ZXJmYWNlIEVsZW1lbnRzIHtcclxuICBib2FyZDogSFRNTEVsZW1lbnQ7XHJcbiAgb3Zlcj86IEhUTUxFbGVtZW50O1xyXG4gIGdob3N0PzogSFRNTEVsZW1lbnQ7XHJcbiAgc3ZnPzogU1ZHRWxlbWVudDtcclxufVxyXG5leHBvcnQgaW50ZXJmYWNlIERvbSB7XHJcbiAgZWxlbWVudHM6IEVsZW1lbnRzLFxyXG4gIGJvdW5kczogTWVtbzxDbGllbnRSZWN0PjtcclxuICByZWRyYXc6ICgpID0+IHZvaWQ7XHJcbiAgcmVkcmF3Tm93OiAoc2tpcFN2Zz86IGJvb2xlYW4pID0+IHZvaWQ7XHJcbiAgdW5iaW5kPzogVW5iaW5kO1xyXG4gIGRlc3Ryb3llZD86IGJvb2xlYW47XHJcbiAgcmVsYXRpdmU/OiBib29sZWFuOyAvLyBkb24ndCBjb21wdXRlIGJvdW5kcywgdXNlIHJlbGF0aXZlICUgdG8gcGxhY2UgcGllY2VzXHJcbn1cclxuZXhwb3J0IGludGVyZmFjZSBFeHBsb2Rpbmcge1xyXG4gIHN0YWdlOiBudW1iZXI7XHJcbiAga2V5czogS2V5W107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTW92ZU1ldGFkYXRhIHtcclxuICBwcmVtb3ZlOiBib29sZWFuO1xyXG4gIGN0cmxLZXk/OiBib29sZWFuO1xyXG4gIGhvbGRUaW1lPzogbnVtYmVyO1xyXG4gIGNhcHR1cmVkPzogUGllY2U7XHJcbiAgcHJlZHJvcD86IGJvb2xlYW47XHJcbn1cclxuZXhwb3J0IGludGVyZmFjZSBTZXRQcmVtb3ZlTWV0YWRhdGEge1xyXG4gIGN0cmxLZXk/OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBXaW5kb3dFdmVudCA9ICdvbnNjcm9sbCcgfCAnb25yZXNpemUnO1xyXG5cclxuZXhwb3J0IHR5cGUgTW91Y2hFdmVudCA9IE1vdXNlRXZlbnQgJiBUb3VjaEV2ZW50O1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBLZXllZE5vZGUgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XHJcbiAgY2dLZXk6IEtleTtcclxufVxyXG5leHBvcnQgaW50ZXJmYWNlIFBpZWNlTm9kZSBleHRlbmRzIEtleWVkTm9kZSB7XHJcbiAgY2dQaWVjZTogc3RyaW5nO1xyXG4gIGNnQW5pbWF0aW5nPzogYm9vbGVhbjtcclxuICBjZ0ZhZGluZz86IGJvb2xlYW47XHJcbiAgY2dEcmFnZ2luZz86IGJvb2xlYW47XHJcbn1cclxuZXhwb3J0IGludGVyZmFjZSBTcXVhcmVOb2RlIGV4dGVuZHMgS2V5ZWROb2RlIHsgfVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNZW1vPEE+IHsgKCk6IEE7IGNsZWFyOiAoKSA9PiB2b2lkOyB9XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFRpbWVyIHtcclxuICBzdGFydDogKCkgPT4gdm9pZDtcclxuICBjYW5jZWw6ICgpID0+IHZvaWQ7XHJcbiAgc3RvcDogKCkgPT4gbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBSZWRyYXcgPSAoKSA9PiB2b2lkO1xyXG5leHBvcnQgdHlwZSBVbmJpbmQgPSAoKSA9PiB2b2lkO1xyXG5leHBvcnQgdHlwZSBUaW1lc3RhbXAgPSBudW1iZXI7XHJcbmV4cG9ydCB0eXBlIE1pbGxpc2Vjb25kcyA9IG51bWJlcjtcclxuXHJcbmV4cG9ydCBjb25zdCBmaWxlczogRmlsZVtdID0gWydhJywgJ2InLCAnYycsICdkJywgJ2UnLCAnZicsICdnJywgJ2gnXTtcclxuZXhwb3J0IGNvbnN0IHJhbmtzOiBSYW5rW10gPSBbMSwgMiwgMywgNCwgNSwgNiwgNywgOF07XHJcbiIsImltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnO1xyXG5cclxuZXhwb3J0IGNvbnN0IGNvbG9yczogY2cuQ29sb3JbXSA9IFsnd2hpdGUnLCAnYmxhY2snXTtcclxuXHJcbmV4cG9ydCBjb25zdCBpbnZSYW5rczogY2cuUmFua1tdID0gWzgsIDcsIDYsIDUsIDQsIDMsIDIsIDFdO1xyXG5cclxuZXhwb3J0IGNvbnN0IGFsbEtleXM6IGNnLktleVtdID0gQXJyYXkucHJvdG90eXBlLmNvbmNhdCguLi5jZy5maWxlcy5tYXAoYyA9PiBjZy5yYW5rcy5tYXAociA9PiBjK3IpKSk7XHJcblxyXG5leHBvcnQgY29uc3QgcG9zMmtleSA9IChwb3M6IGNnLlBvcykgPT4gYWxsS2V5c1s4ICogcG9zWzBdICsgcG9zWzFdIC0gOV07XHJcblxyXG5leHBvcnQgY29uc3Qga2V5MnBvcyA9IChrOiBjZy5LZXkpID0+IFtrLmNoYXJDb2RlQXQoMCkgLSA5Niwgay5jaGFyQ29kZUF0KDEpIC0gNDhdIGFzIGNnLlBvcztcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtZW1vPEE+KGY6ICgpID0+IEEpOiBjZy5NZW1vPEE+IHtcclxuICBsZXQgdjogQSB8IHVuZGVmaW5lZDtcclxuICBjb25zdCByZXQ6IGFueSA9ICgpID0+IHtcclxuICAgIGlmICh2ID09PSB1bmRlZmluZWQpIHYgPSBmKCk7XHJcbiAgICByZXR1cm4gdjtcclxuICB9O1xyXG4gIHJldC5jbGVhciA9ICgpID0+IHsgdiA9IHVuZGVmaW5lZDsgfTtcclxuICByZXR1cm4gcmV0O1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgdGltZXI6ICgpID0+IGNnLlRpbWVyID0gKCkgPT4ge1xyXG4gIGxldCBzdGFydEF0OiBudW1iZXIgfCB1bmRlZmluZWQ7XHJcbiAgcmV0dXJuIHtcclxuICAgIHN0YXJ0KCkgeyBzdGFydEF0ID0gRGF0ZS5ub3coKTsgfSxcclxuICAgIGNhbmNlbCgpIHsgc3RhcnRBdCA9IHVuZGVmaW5lZDsgfSxcclxuICAgIHN0b3AoKSB7XHJcbiAgICAgIGlmICghc3RhcnRBdCkgcmV0dXJuIDA7XHJcbiAgICAgIGNvbnN0IHRpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRBdDtcclxuICAgICAgc3RhcnRBdCA9IHVuZGVmaW5lZDtcclxuICAgICAgcmV0dXJuIHRpbWU7XHJcbiAgICB9XHJcbiAgfTtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IG9wcG9zaXRlID0gKGM6IGNnLkNvbG9yKSA9PiBjID09PSAnd2hpdGUnID8gJ2JsYWNrJyA6ICd3aGl0ZSc7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY29udGFpbnNYPFg+KHhzOiBYW10gfCB1bmRlZmluZWQsIHg6IFgpOiBib29sZWFuIHtcclxuICByZXR1cm4geHMgPyB4cy5pbmRleE9mKHgpICE9PSAtMSA6IGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgZGlzdGFuY2VTcTogKHBvczE6IGNnLlBvcywgcG9zMjogY2cuUG9zKSA9PiBudW1iZXIgPSAocG9zMSwgcG9zMikgPT4ge1xyXG4gIHJldHVybiBNYXRoLnBvdyhwb3MxWzBdIC0gcG9zMlswXSwgMikgKyBNYXRoLnBvdyhwb3MxWzFdIC0gcG9zMlsxXSwgMik7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBzYW1lUGllY2U6IChwMTogY2cuUGllY2UsIHAyOiBjZy5QaWVjZSkgPT4gYm9vbGVhbiA9IChwMSwgcDIpID0+XHJcbiAgcDEucm9sZSA9PT0gcDIucm9sZSAmJiBwMS5jb2xvciA9PT0gcDIuY29sb3I7XHJcblxyXG5leHBvcnQgY29uc3QgY29tcHV0ZUlzVHJpZGVudCA9ICgpID0+IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50LmluZGV4T2YoJ1RyaWRlbnQvJykgPiAtMTtcclxuXHJcbmNvbnN0IHBvc1RvVHJhbnNsYXRlQmFzZTogKHBvczogY2cuUG9zLCBhc1doaXRlOiBib29sZWFuLCB4RmFjdG9yOiBudW1iZXIsIHlGYWN0b3I6IG51bWJlcikgPT4gY2cuTnVtYmVyUGFpciA9XHJcbihwb3MsIGFzV2hpdGUsIHhGYWN0b3IsIHlGYWN0b3IpID0+IFtcclxuICAoYXNXaGl0ZSA/IHBvc1swXSAtIDEgOiA4IC0gcG9zWzBdKSAqIHhGYWN0b3IsXHJcbiAgKGFzV2hpdGUgPyA4IC0gcG9zWzFdIDogcG9zWzFdIC0gMSkgKiB5RmFjdG9yXHJcbl07XHJcblxyXG5leHBvcnQgY29uc3QgcG9zVG9UcmFuc2xhdGVBYnMgPSAoYm91bmRzOiBDbGllbnRSZWN0KSA9PiB7XHJcbiAgY29uc3QgeEZhY3RvciA9IGJvdW5kcy53aWR0aCAvIDgsXHJcbiAgeUZhY3RvciA9IGJvdW5kcy5oZWlnaHQgLyA4O1xyXG4gIHJldHVybiAocG9zOiBjZy5Qb3MsIGFzV2hpdGU6IGJvb2xlYW4pID0+IHBvc1RvVHJhbnNsYXRlQmFzZShwb3MsIGFzV2hpdGUsIHhGYWN0b3IsIHlGYWN0b3IpO1xyXG59O1xyXG5cclxuXHJcbmV4cG9ydCBjb25zdCBwb3NUb1RyYW5zbGF0ZVJlbDogKHBvczogY2cuUG9zLCBhc1doaXRlOiBib29sZWFuKSA9PiBjZy5OdW1iZXJQYWlyID1cclxuICAocG9zLCBhc1doaXRlKSA9PiBwb3NUb1RyYW5zbGF0ZUJhc2UocG9zLCBhc1doaXRlLCAxMi41LCAxMi41KTtcclxuXHJcblxyXG5cclxuXHJcbmV4cG9ydCBjb25zdCB0cmFuc2xhdGVBYnMgPSAoZWw6IEhUTUxFbGVtZW50LCBwb3M6IGNnLlBvcywgcm90YXRlPzpib29sZWFuKSA9PiB7XHJcbmxldCB0YXJnZXRTdHJpbmcgPSBgdHJhbnNsYXRlKCR7cG9zWzBdfXB4LCR7cG9zWzFdfXB4KSBgO1xyXG5cclxuaWYocm90YXRlKXtcclxuXHR0YXJnZXRTdHJpbmcrPSAncm90YXRlKDE4MGRlZyknO1xyXG59XHJcbiAgZWwuc3R5bGUudHJhbnNmb3JtID0gdGFyZ2V0U3RyaW5nO1xyXG59XHJcblxyXG5cclxuXHJcbmV4cG9ydCBjb25zdCB0cmFuc2xhdGVSZWwgPSAoZWw6IEhUTUxFbGVtZW50LCBwZXJjZW50czogY2cuTnVtYmVyUGFpcixyb3RhdGU/OmJvb2xlYW4pID0+IHtcclxuICBlbC5zdHlsZS5sZWZ0ID0gcGVyY2VudHNbMF0gKyAnJSc7XHJcbiAgZWwuc3R5bGUudG9wID0gcGVyY2VudHNbMV0gKyAnJSc7XHJcblxyXG4gIGlmKHJvdGF0ZSl7XHJcbiAgXHRlbC5zdHlsZS50cmFuc2Zvcm0gPSAncm90YXRlKDE4MGRlZyknO1xyXG4gIH1cclxuICBlbHNle1xyXG4gIFx0ZWwuc3R5bGUudHJhbnNmb3JtID0gXCJcIjtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCB0cmFuc2xhdGVBd2F5ID0gKGVsOiBIVE1MRWxlbWVudCkgPT4gdHJhbnNsYXRlQWJzKGVsLCBbLTk5OTk5LCAtOTk5OTldKTtcclxuXHJcbi8vIHRvdWNoZW5kIGhhcyBubyBwb3NpdGlvbiFcclxuZXhwb3J0IGNvbnN0IGV2ZW50UG9zaXRpb246IChlOiBjZy5Nb3VjaEV2ZW50KSA9PiBjZy5OdW1iZXJQYWlyIHwgdW5kZWZpbmVkID0gZSA9PiB7XHJcbiAgaWYgKGUuY2xpZW50WCB8fCBlLmNsaWVudFggPT09IDApIHJldHVybiBbZS5jbGllbnRYLCBlLmNsaWVudFldO1xyXG4gIGlmIChlLnRvdWNoZXMgJiYgZS50YXJnZXRUb3VjaGVzWzBdKSByZXR1cm4gW2UudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRYLCBlLnRhcmdldFRvdWNoZXNbMF0uY2xpZW50WV07XHJcbiAgcmV0dXJuIHVuZGVmaW5lZDtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGlzUmlnaHRCdXR0b24gPSAoZTogTW91c2VFdmVudCkgPT4gZS5idXR0b25zID09PSAyIHx8IGUuYnV0dG9uID09PSAyO1xyXG5cclxuZXhwb3J0IGNvbnN0IGNyZWF0ZUVsID0gKHRhZ05hbWU6IHN0cmluZywgY2xhc3NOYW1lPzogc3RyaW5nKSA9PiB7XHJcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xyXG4gIGlmIChjbGFzc05hbWUpIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcclxuICByZXR1cm4gZWw7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCByYWYgPSAod2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCB3aW5kb3cuc2V0VGltZW91dCkuYmluZCh3aW5kb3cpO1xyXG4iLCJpbXBvcnQgeyBTdGF0ZSB9IGZyb20gJy4vc3RhdGUnXHJcbmltcG9ydCB7IGNvbG9ycywgdHJhbnNsYXRlQXdheSwgY3JlYXRlRWwgfSBmcm9tICcuL3V0aWwnXHJcbmltcG9ydCB7IGZpbGVzLCByYW5rcyB9IGZyb20gJy4vdHlwZXMnXHJcbmltcG9ydCB7IGNyZWF0ZUVsZW1lbnQgYXMgY3JlYXRlU1ZHIH0gZnJvbSAnLi9zdmcnXHJcbmltcG9ydCB7IEVsZW1lbnRzIH0gZnJvbSAnLi90eXBlcydcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHdyYXAoZWxlbWVudDogSFRNTEVsZW1lbnQsIHM6IFN0YXRlLCBib3VuZHM/OiBDbGllbnRSZWN0KTogRWxlbWVudHMge1xyXG5cclxuICBlbGVtZW50LmlubmVySFRNTCA9ICcnO1xyXG5cclxuICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NnLWJvYXJkLXdyYXAnKTtcclxuICBjb2xvcnMuZm9yRWFjaChjID0+IHtcclxuICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnb3JpZW50YXRpb24tJyArIGMsIHMub3JpZW50YXRpb24gPT09IGMpO1xyXG4gIH0pO1xyXG4gIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbWFuaXB1bGFibGUnLCAhcy52aWV3T25seSk7XHJcblxyXG4gIGNvbnN0IGJvYXJkID0gY3JlYXRlRWwoJ2RpdicsICdjZy1ib2FyZCcpO1xyXG5cclxuICBlbGVtZW50LmFwcGVuZENoaWxkKGJvYXJkKTtcclxuXHJcbiAgbGV0IHN2ZzogU1ZHRWxlbWVudCB8IHVuZGVmaW5lZDtcclxuICBpZiAocy5kcmF3YWJsZS52aXNpYmxlICYmIGJvdW5kcykge1xyXG4gICAgc3ZnID0gY3JlYXRlU1ZHKCdzdmcnKTtcclxuICAgIHN2Zy5hcHBlbmRDaGlsZChjcmVhdGVTVkcoJ2RlZnMnKSk7XHJcbiAgICBlbGVtZW50LmFwcGVuZENoaWxkKHN2Zyk7XHJcbiAgfVxyXG5cclxuICBpZiAocy5jb29yZGluYXRlcykge1xyXG4gICAgY29uc3Qgb3JpZW50Q2xhc3MgPSBzLm9yaWVudGF0aW9uID09PSAnYmxhY2snID8gJyBibGFjaycgOiAnJztcclxuICAgIGVsZW1lbnQuYXBwZW5kQ2hpbGQocmVuZGVyQ29vcmRzKHJhbmtzLCAncmFua3MnICsgb3JpZW50Q2xhc3MpKTtcclxuICAgIGVsZW1lbnQuYXBwZW5kQ2hpbGQocmVuZGVyQ29vcmRzKGZpbGVzLCAnZmlsZXMnICsgb3JpZW50Q2xhc3MpKTtcclxuICB9XHJcblxyXG4gIGxldCBvdmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcclxuICBpZiAoYm91bmRzICYmIChzLm1vdmFibGUuc2hvd0Rlc3RzIHx8IHMucHJlbW92YWJsZS5zaG93RGVzdHMpKSB7XHJcbiAgICBvdmVyID0gY3JlYXRlRWwoJ2RpdicsICdvdmVyJyk7XHJcbiAgICB0cmFuc2xhdGVBd2F5KG92ZXIpO1xyXG4gICAgb3Zlci5zdHlsZS53aWR0aCA9IChib3VuZHMud2lkdGggLyA4KSArICdweCc7XHJcbiAgICBvdmVyLnN0eWxlLmhlaWdodCA9IChib3VuZHMuaGVpZ2h0IC8gOCkgKyAncHgnO1xyXG4gICAgZWxlbWVudC5hcHBlbmRDaGlsZChvdmVyKTtcclxuICB9XHJcblxyXG4gIGxldCBnaG9zdDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XHJcbiAgaWYgKGJvdW5kcyAmJiBzLmRyYWdnYWJsZS5zaG93R2hvc3QpIHtcclxuICAgIGdob3N0ID0gY3JlYXRlRWwoJ3BpZWNlJywgJ2dob3N0Jyk7XHJcbiAgICB0cmFuc2xhdGVBd2F5KGdob3N0KTtcclxuICAgIGVsZW1lbnQuYXBwZW5kQ2hpbGQoZ2hvc3QpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGJvYXJkOiBib2FyZCxcclxuICAgIG92ZXI6IG92ZXIsXHJcbiAgICBnaG9zdDogZ2hvc3QsXHJcbiAgICBzdmc6IHN2Z1xyXG4gIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlckNvb3JkcyhlbGVtczogYW55W10sIGNsYXNzTmFtZTogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xyXG4gIGNvbnN0IGVsID0gY3JlYXRlRWwoJ2Nvb3JkcycsIGNsYXNzTmFtZSk7XHJcbiAgbGV0IGY6IEhUTUxFbGVtZW50O1xyXG4gIGZvciAobGV0IGkgaW4gZWxlbXMpIHtcclxuICAgIGYgPSBjcmVhdGVFbCgnY29vcmQnKTtcclxuICAgIGYudGV4dENvbnRlbnQgPSBlbGVtc1tpXTtcclxuICAgIGVsLmFwcGVuZENoaWxkKGYpO1xyXG4gIH1cclxuICByZXR1cm4gZWw7XHJcbn1cclxuIl19

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const { calculatePointsFromBounds, getContourPoints } = require('./math');
const Critic = require('./critic');

class Analysis {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
        this.critic = new Critic(goatsheep);
        this.goatsheep.solutions = [];
        goatsheep.objects.forEach((object)=>{
            this.goatsheep.solutions.push(this.analyze.bind(this)(object));
        });
        this.solutions = this.goatsheep.solutions;
    }

    analyze(object) {
        let cells = this.calculateCells(object);
        let solution;
        let solutions = [];
        let possibleSolutions = cells.map(this.critic.critiquePosition.bind(this.critic));
        possibleSolutions = this.critic.rankPosition(possibleSolutions);
        let bestSolution = { score: 0, isFeasible: false };
        for (let i = 0; i < possibleSolutions.length; i++) {
            solution = possibleSolutions[i];
            this.critic.critique(solution);
            if (solution.excluded) continue;
            solutions.push(solution);
            bestSolution = solution.score > bestSolution.score ? solution : bestSolution;
            if (bestSolution.score > .6 + .3 * (1 - i / cells.length))
                break;
        }
        solutions = this.critic.rank(solutions);
        if (bestSolution.score > 0) {
            this.goatsheep.exclude.push(solutions[0].cell);
        }
        return this.critic.rank(solutions);
    }

    generateCellsForPoint(point, object) {
        let cells = [{
            top: point.y - object.height,
            left: point.x - object.width,
            orientation: 'NW'
        }, {
            top: point.y,
            left: point.x - object.width,
            orientation: 'SW'
        }, {
            top: point.y,
            left: point.x,
            orientation: 'SE'
        }, {
            top: point.y - object.height,
            left: point.x,
            orientation: 'NE'
        }];

        cells.forEach((c) => {
            c.intersection = point;
            c.width = object.width;
            c.height = object.height;
        });

        return cells;
    }

    fixCells(cells, object) {
        let offset = { x: 0, y: 0 };
        const { width, height } = this.goatsheep;
        const area = object.width * object.height;
        const maxLeft = width - object.width;
        const maxTop = height - object.height;
        cells.forEach((c) => {
            if (c.top < 0) {
                c.top = 0;
            } else if (c.top > maxTop) {
                c.top = maxTop;
            }
            if (c.left < 0) {
                c.left = 0;
            } else if (c.left > maxLeft) {
                c.left = maxLeft;
            }
            c.points = calculatePointsFromBounds(c);
            c.area = area;
        });
    }

    calculateCells(object) {
        let points = getContourPoints(this.goatsheep.contours[0]);
        let cells = points.map((point) => this.generateCellsForPoint(point, object));
        cells = [].concat.apply([], cells);
        this.fixCells(cells, object);

        return cells;
    }
}

module.exports = Analysis;
},{"./critic":2,"./math":4}],2:[function(require,module,exports){
const { intersectionPercentage, rectRectOverlap, getRectCentroid } = require('./math');

class Critic {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
    }

    critiquePosition(cell) {
        let solution = new Solution(this.goatsheep, cell);
        this.calculatePositionScore(solution);

        return solution;
    }

    critique(solution) {
        return this.calculateTotalScore(solution);
    }

    getSolutionDistance(solutionA, solutionB) {
        // TODO: Rect/Rect distance
        const centroidA = getRectCentroid(solutionA.cell);
        const centroidB = getRectCentroid(solutionB.cell);
        const dist = Math.sqrt(Math.pow(centroidA.x - centroidB.x, 2) + Math.pow(centroidA.y - centroidB.y, 2));
        const maxDist = Math.sqrt(Math.pow(this.goatsheep.width, 2) + Math.pow(this.goatsheep.height, 2));
        return dist / maxDist;
    }

    calculatePositionScore(solution) {
        // Overlap with excluded areas
        const collisions = this.goatsheep.exclude.map((excludedArea) => rectRectOverlap(excludedArea, solution.cell));
        solution.excluded = this.goatsheep.exclude.length ? collisions.includes(true) : false;
        if (solution.excluded) return solution.positionScore = 0;
        // Distance to other objects
        let score = 1;
        if (this.goatsheep.solutions.length) {
            const distancesToOtherObjects = this.goatsheep.solutions.map(([solutionB]) => {
                return this.getSolutionDistance.bind(this)(solution, solutionB);
            });
            const distanceToObjects = Math.min.apply(null, distancesToOtherObjects);
            score = distanceToObjects;
        }
        const distanceFromBottom = (this.goatsheep.height - solution.cell.top - solution.cell.height) / this.goatsheep.height;
        score *= distanceFromBottom;

        return solution.positionScore = score;  // Apply to solution
    }

    calculateTotalScore(solution) {
        solution.freeArea = 1 - intersectionPercentage(solution.cell, this.goatsheep.contours[0], this.goatsheep.debug);
        return solution.score = 0.5 * (solution.positionScore + solution.freeArea);  // Apply to solution
    }

    rank(solutions) {
        // Rank given critiques
        return solutions.sort((a, b) => b.score - a.score);
    }

    rankPosition(solutions) {
        // Rank given position critiques
        return solutions.sort((a, b) => b.positionScore - a.positionScore);
    }
}

class Solution {
    constructor(goatsheep, cell) {
        this.goatsheep = goatsheep;
        this.cell = cell;
        this.excluded = true;
        this.freeArea = -1;
        this.score = 0;
    }
}

module.exports = Critic;
},{"./math":4}],3:[function(require,module,exports){
const math = require('./math');
const { sanitizeContours, generateContours, calculatePointsFromBounds } = math;
const Analysis = require('./analysis');

function validateContour(contour) {
    if (!Array.isArray(contour)) throw new Error('contour must be an array');
    if (contour.length === 0) throw new Error('contour cannot be empty');
    for (let { x, y } of contour) {
        if (!(typeof x === 'number') || !(typeof y === 'number'))
            throw new Error('contour must be an array of { x : Number, y : Number }');
    }
}

function validatePayload(payload) {
    if (payload == null) throw new Error('payload not defined');
    if (payload.contour == null && !Array.isArray(payload.contours))
        throw new Error('payload must have a valid contour or contours field');
    for (let k of ['width', 'height'])
        if (!(typeof payload[k] === 'number')) throw new Error(`payload must have a valid numeric field ${k}`);

    if (!Array.isArray(payload.objects)) throw new Error('payload must have an array of object { width, height }');
    if (payload.objects.length < 1) throw new Error('payload objects must have more than one item');
    for (let o of payload.objects)
        if (isNaN(o.width) || isNaN(o.height)) throw new Error('payload objects must have valid numeric width and height properties');
    if (payload.exclude && !Array.isArray(payload.exclude))
        throw new Error('exclude field must be an array');
    for (let area of payload.exclude)
        for (let k of ['width', 'height', 'top', 'left'])
            if (!(typeof area[k] === 'number')) throw new Error(`excluded areas must have a valid numeric field ${k}`);
    if (payload.contour) {
        validateContour(payload.contour);
    } else {
        payload.contours.map(validateContour);
    }
}

class Goatsheep {
    constructor(payload) {
        this.debug = payload.debug || false;
        this.init(payload);
        this.analyze();
    }

    init(payload) {
        validatePayload(payload);
        let contours = payload.contour ? [payload.contour] : payload.contours;
        sanitizeContours(contours);
        this.contours = generateContours(contours);
        for (let k of ['width', 'height', 'objects'])
            this[k] = payload[k];
        this.exclude = payload.exclude.map((area) => {
            area.points = calculatePointsFromBounds(area);
            return area;
        });
    }

    analyze() {
        this.analysis = new Analysis(this);
        this.solutions = this.analysis.solutions;
    }
}

module.exports = Goatsheep;
module.exports.validate = (payload) => {
    try {
        validatePayload(payload);
    } catch (e) {
        return e;
    }
    return true;
};
module.exports.Math = math;
},{"./analysis":1,"./math":4}],4:[function(require,module,exports){
const convexHull = require('convex-hull')
const intersect = require('polygon-clipping').intersection
const MAX_STEPS = 20;   // Steps to traverse contour

function sumArray(arr) {
    return arr.reduce((a, b) => a + b, 0)
}

function sanitizeContour(contour) {
    const last = contour[contour.length - 1];
    if (contour[0].x != last.x || contour[0].y != last.y)
        contour.push(contour[0])
}

function sanitizeContours(contours) {
    contours.map(sanitizeContour);
}

function calculatePointsFromBounds(bounds) {
    let xMin = bounds.left;
    let yMin = bounds.top;
    let xMax = xMin + bounds.width;
    let yMax = yMin + bounds.height;

    return [{ x: xMin, y: yMin }, { x: xMax, y: yMin }, { x: xMax, y: yMax }, { x: xMin, y: yMax }, { x: xMin, y: yMin }];
}

function getBounds(contour) {
    let xMin, yMi, xMax, yMax;
    xs = contour.map(({ x }) => x);
    ys = contour.map(({ y }) => y);
    xMin = xMax = contour[0].x;
    yMin = yMax = contour[0].y;
    xMin = Math.min(...xs);
    xMax = Math.max(...xs);
    yMin = Math.min(...ys);
    yMax = Math.max(...ys);

    let bounds = {
        width: xMax - xMin,
        height: yMax - yMin,
        top: yMin,
        left: xMin
    }

    bounds.points = calculatePointsFromBounds(bounds);

    return bounds;
}

function translatePolygon(polygon) {
    return polygon.points.map(({ x, y }) => [x, y]);
}

function rectRectOverlap(rectA, rectB) {
    return (rectA.left < rectB.left + rectB.width && rectA.left + rectA.width > rectB.left &&
        rectA.top < rectB.top + rectB.height && rectA.top + rectA.height > rectB.top);
}

// Return % of coverage over polygonA from polygonB
function intersectionPercentage(polygonA, polygonB, debug=false) {
    let totalArea = polygonA.area ? polygonA.area : getArea(polygonA.points);
    let polyA = translatePolygon(polygonA);
    let polyB = translatePolygon(polygonB);
    let intersection;
    let intersectionArea = 0;
    try {
        intersection = intersect([polyA], [polyB]);
        if (intersection.length) {
            intersection = { "type": "Feature", "properties": {}, "geometry": { "type": "MultiPolygon", "coordinates": intersection } };
        } else {
            intersection = false;
        }
    } catch (e) {
        if (debug) {
            console.error('[goatsheep] intersection calculation error:');
            console.error(`intersect([polyA], [polyB])\npolyA:${JSON.stringify(polyA, null, 0)}\npolyB:${JSON.stringify(polyB, null, 0)}`)
            console.error(e);
            // TODO: Check exception, handle return value accordingly
        }
        return 1; // Assume total overlap
    }

    if (intersection) {
        let type = intersection.geometry.type;
        if (type === 'Polygon' || type === 'MultiPolygon') {
            intersectionArea = getPolygonArea(intersection.geometry);
        } else if (type === 'Point' || type == 'LineString') {
            intersectionArea = 0;
        } else if (type === 'GeometryCollection') {
            for (let geometry of intersection.geometry.geometries) {
                if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
                    intersectionArea += getPolygonArea(geometry);
                }
            }
        } else {
            if (debug) {
                console.warn('[goatsheep] Intersection geometry not supported: ' + type);
            }
            intersectionArea = totalArea;
        }
    }

    return intersectionArea / totalArea;
}

function getPolygonArea(geometry) {
    let area = 0;
    for (let i = 0; i < geometry.coordinates.length; i++) {
        const coords = geometry.coordinates[i];
        area -= getArea(coords.map(([x, y]) => ({ x, y })));    // Remove holes if any
    }

    return getArea(geometry.coordinates[0].map(([x, y]) => ({ x, y })));
}

function _getArea(contour) {
    const bs = new Array(contour.length - 1);
    for (let i = 0; i < contour.length - 1; i++)
        bs[i] = contour[i].x * contour[i + 1].y - contour[i + 1].x * contour[i].y;

    const area = 0.5 * sumArray(bs);

    return { bs, area };
}

function getContourProperties(contour) {
    let { bs, area } = _getArea(contour);
    let x = 0;
    let y = 0;
    for (let i = 0; i < contour.length - 1; i++) {
        x += (contour[i].x + contour[i + 1].x) * bs[i];
        y += (contour[i].y + contour[i + 1].y) * bs[i];
    }
    x /= 6 * area;
    y /= 6 * area;
    const centroid = { x, y };
    const clockwise = area < 0
    area = Math.abs(area);
    const bounds = getBounds(contour);
    let pointArray = contour.map(({ x, y }) => [x, y]);
    let alpha = convexHull(pointArray).map(([i]) => { return { x: pointArray[i][0], y: pointArray[i][1] }; });

    return { centroid, area, clockwise, bounds, alpha };
}

function generateContour(contour) {
    return new Contour(contour);
}

function generateContours(contours) {
    return contours.map(generateContour);
}

function getArea(points) {
    const { area } = _getArea(points);

    return Math.abs(area);
}

function pointPointDistance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function lerpPoints(b, a, t) {
    return {
        x: a.x * t + b.x * (1 - t),
        y: a.y * t + b.y * (1 - t),
    }
}

function getContourPoints({ points }) {
    let point = points[0];
    let i = 0;
    let distances = new Array(points.length - 1);
    for (; i < distances.length; i++) {
        distances[i] = pointPointDistance(points[i], points[i + 1]);
    }
    const totalDistance = sumArray(distances);
    const step = totalDistance / MAX_STEPS;
    const selection = [];
    let distance = 0;
    i = 0;
    while (i < points.length - 1) {
        selection.push(lerpPoints(points[i], points[i + 1], distance / distances[i]));
        distance += step;
        while (distance > distances[i]) {
            distance -= distances[i];
            i++;
        }
    }
    return selection;
}

function getRectCentroid(rect) {
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

class Contour {
    constructor(contour) {
        const { centroid, area, clockwise, bounds, alpha } = getContourProperties(contour);
        this.points = contour;
        this.centroid = centroid;
        this.area = area;
        this.clockwise = clockwise;
        this.bounds = bounds;
        this.alpha = alpha;
    }
}

module.exports = {
    // Expose methods
    sanitizeContour: sanitizeContour,
    sanitizeContours: sanitizeContours,
    generateContour: generateContour,
    generateContours: generateContours,
    getArea: getArea,
    calculatePointsFromBounds: calculatePointsFromBounds,
    getContourPoints: getContourPoints,
    intersectionPercentage: intersectionPercentage,
    rectRectOverlap: rectRectOverlap,
    getRectCentroid: getRectCentroid,
    // Expose classes
    Contour: Contour
};
},{"convex-hull":7,"polygon-clipping":13}],5:[function(require,module,exports){
'use strict'

module.exports = affineHull

var orient = require('robust-orientation')

function linearlyIndependent(points, d) {
  var nhull = new Array(d+1)
  for(var i=0; i<points.length; ++i) {
    nhull[i] = points[i]
  }
  for(var i=0; i<=points.length; ++i) {
    for(var j=points.length; j<=d; ++j) {
      var x = new Array(d)
      for(var k=0; k<d; ++k) {
        x[k] = Math.pow(j+1-i, k)
      }
      nhull[j] = x
    }
    var o = orient.apply(void 0, nhull)
    if(o) {
      return true
    }
  }
  return false
}

function affineHull(points) {
  var n = points.length
  if(n === 0) {
    return []
  }
  if(n === 1) {
    return [0]
  }
  var d = points[0].length
  var frame = [ points[0] ]
  var index = [ 0 ]
  for(var i=1; i<n; ++i) {
    frame.push(points[i])
    if(!linearlyIndependent(frame, d)) {
      frame.pop()
      continue
    }
    index.push(i)
    if(index.length === d+1) {
      return index
    }
  }
  return index
}
},{"robust-orientation":14}],6:[function(require,module,exports){
/**
 * Bit twiddling hacks for JavaScript.
 *
 * Author: Mikola Lysenko
 *
 * Ported from Stanford bit twiddling hack library:
 *    http://graphics.stanford.edu/~seander/bithacks.html
 */

"use strict"; "use restrict";

//Number of bits in an integer
var INT_BITS = 32;

//Constants
exports.INT_BITS  = INT_BITS;
exports.INT_MAX   =  0x7fffffff;
exports.INT_MIN   = -1<<(INT_BITS-1);

//Returns -1, 0, +1 depending on sign of x
exports.sign = function(v) {
  return (v > 0) - (v < 0);
}

//Computes absolute value of integer
exports.abs = function(v) {
  var mask = v >> (INT_BITS-1);
  return (v ^ mask) - mask;
}

//Computes minimum of integers x and y
exports.min = function(x, y) {
  return y ^ ((x ^ y) & -(x < y));
}

//Computes maximum of integers x and y
exports.max = function(x, y) {
  return x ^ ((x ^ y) & -(x < y));
}

//Checks if a number is a power of two
exports.isPow2 = function(v) {
  return !(v & (v-1)) && (!!v);
}

//Computes log base 2 of v
exports.log2 = function(v) {
  var r, shift;
  r =     (v > 0xFFFF) << 4; v >>>= r;
  shift = (v > 0xFF  ) << 3; v >>>= shift; r |= shift;
  shift = (v > 0xF   ) << 2; v >>>= shift; r |= shift;
  shift = (v > 0x3   ) << 1; v >>>= shift; r |= shift;
  return r | (v >> 1);
}

//Computes log base 10 of v
exports.log10 = function(v) {
  return  (v >= 1000000000) ? 9 : (v >= 100000000) ? 8 : (v >= 10000000) ? 7 :
          (v >= 1000000) ? 6 : (v >= 100000) ? 5 : (v >= 10000) ? 4 :
          (v >= 1000) ? 3 : (v >= 100) ? 2 : (v >= 10) ? 1 : 0;
}

//Counts number of bits
exports.popCount = function(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}

//Counts number of trailing zeros
function countTrailingZeros(v) {
  var c = 32;
  v &= -v;
  if (v) c--;
  if (v & 0x0000FFFF) c -= 16;
  if (v & 0x00FF00FF) c -= 8;
  if (v & 0x0F0F0F0F) c -= 4;
  if (v & 0x33333333) c -= 2;
  if (v & 0x55555555) c -= 1;
  return c;
}
exports.countTrailingZeros = countTrailingZeros;

//Rounds to next power of 2
exports.nextPow2 = function(v) {
  v += v === 0;
  --v;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
}

//Rounds down to previous power of 2
exports.prevPow2 = function(v) {
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v - (v>>>1);
}

//Computes parity of word
exports.parity = function(v) {
  v ^= v >>> 16;
  v ^= v >>> 8;
  v ^= v >>> 4;
  v &= 0xf;
  return (0x6996 >>> v) & 1;
}

var REVERSE_TABLE = new Array(256);

(function(tab) {
  for(var i=0; i<256; ++i) {
    var v = i, r = i, s = 7;
    for (v >>>= 1; v; v >>>= 1) {
      r <<= 1;
      r |= v & 1;
      --s;
    }
    tab[i] = (r << s) & 0xff;
  }
})(REVERSE_TABLE);

//Reverse bits in a 32 bit word
exports.reverse = function(v) {
  return  (REVERSE_TABLE[ v         & 0xff] << 24) |
          (REVERSE_TABLE[(v >>> 8)  & 0xff] << 16) |
          (REVERSE_TABLE[(v >>> 16) & 0xff] << 8)  |
           REVERSE_TABLE[(v >>> 24) & 0xff];
}

//Interleave bits of 2 coordinates with 16 bits.  Useful for fast quadtree codes
exports.interleave2 = function(x, y) {
  x &= 0xFFFF;
  x = (x | (x << 8)) & 0x00FF00FF;
  x = (x | (x << 4)) & 0x0F0F0F0F;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;

  y &= 0xFFFF;
  y = (y | (y << 8)) & 0x00FF00FF;
  y = (y | (y << 4)) & 0x0F0F0F0F;
  y = (y | (y << 2)) & 0x33333333;
  y = (y | (y << 1)) & 0x55555555;

  return x | (y << 1);
}

//Extracts the nth interleaved component
exports.deinterleave2 = function(v, n) {
  v = (v >>> n) & 0x55555555;
  v = (v | (v >>> 1))  & 0x33333333;
  v = (v | (v >>> 2))  & 0x0F0F0F0F;
  v = (v | (v >>> 4))  & 0x00FF00FF;
  v = (v | (v >>> 16)) & 0x000FFFF;
  return (v << 16) >> 16;
}


//Interleave bits of 3 coordinates, each with 10 bits.  Useful for fast octree codes
exports.interleave3 = function(x, y, z) {
  x &= 0x3FF;
  x  = (x | (x<<16)) & 4278190335;
  x  = (x | (x<<8))  & 251719695;
  x  = (x | (x<<4))  & 3272356035;
  x  = (x | (x<<2))  & 1227133513;

  y &= 0x3FF;
  y  = (y | (y<<16)) & 4278190335;
  y  = (y | (y<<8))  & 251719695;
  y  = (y | (y<<4))  & 3272356035;
  y  = (y | (y<<2))  & 1227133513;
  x |= (y << 1);

  z &= 0x3FF;
  z  = (z | (z<<16)) & 4278190335;
  z  = (z | (z<<8))  & 251719695;
  z  = (z | (z<<4))  & 3272356035;
  z  = (z | (z<<2))  & 1227133513;

  return x | (z << 2);
}

//Extracts nth interleaved component of a 3-tuple
exports.deinterleave3 = function(v, n) {
  v = (v >>> n)       & 1227133513;
  v = (v | (v>>>2))   & 3272356035;
  v = (v | (v>>>4))   & 251719695;
  v = (v | (v>>>8))   & 4278190335;
  v = (v | (v>>>16))  & 0x3FF;
  return (v<<22)>>22;
}

//Computes next combination in colexicographic order (this is mistakenly called nextPermutation on the bit twiddling hacks page)
exports.nextCombination = function(v) {
  var t = v | (v - 1);
  return (t + 1) | (((~t & -~t) - 1) >>> (countTrailingZeros(v) + 1));
}


},{}],7:[function(require,module,exports){
"use strict"

var convexHull1d = require('./lib/ch1d')
var convexHull2d = require('./lib/ch2d')
var convexHullnd = require('./lib/chnd')

module.exports = convexHull

function convexHull(points) {
  var n = points.length
  if(n === 0) {
    return []
  } else if(n === 1) {
    return [[0]]
  }
  var d = points[0].length
  if(d === 0) {
    return []
  } else if(d === 1) {
    return convexHull1d(points)
  } else if(d === 2) {
    return convexHull2d(points)
  }
  return convexHullnd(points, d)
}
},{"./lib/ch1d":8,"./lib/ch2d":9,"./lib/chnd":10}],8:[function(require,module,exports){
"use strict"

module.exports = convexHull1d

function convexHull1d(points) {
  var lo = 0
  var hi = 0
  for(var i=1; i<points.length; ++i) {
    if(points[i][0] < points[lo][0]) {
      lo = i
    }
    if(points[i][0] > points[hi][0]) {
      hi = i
    }
  }
  if(lo < hi) {
    return [[lo], [hi]]
  } else if(lo > hi) {
    return [[hi], [lo]]
  } else {
    return [[lo]]
  }
}
},{}],9:[function(require,module,exports){
'use strict'

module.exports = convexHull2D

var monotoneHull = require('monotone-convex-hull-2d')

function convexHull2D(points) {
  var hull = monotoneHull(points)
  var h = hull.length
  if(h <= 2) {
    return []
  }
  var edges = new Array(h)
  var a = hull[h-1]
  for(var i=0; i<h; ++i) {
    var b = hull[i]
    edges[i] = [a,b]
    a = b
  }
  return edges
}

},{"monotone-convex-hull-2d":12}],10:[function(require,module,exports){
'use strict'

module.exports = convexHullnD

var ich = require('incremental-convex-hull')
var aff = require('affine-hull')

function permute(points, front) {
  var n = points.length
  var npoints = new Array(n)
  for(var i=0; i<front.length; ++i) {
    npoints[i] = points[front[i]]
  }
  var ptr = front.length
  for(var i=0; i<n; ++i) {
    if(front.indexOf(i) < 0) {
      npoints[ptr++] = points[i]
    }
  }
  return npoints
}

function invPermute(cells, front) {
  var nc = cells.length
  var nf = front.length
  for(var i=0; i<nc; ++i) {
    var c = cells[i]
    for(var j=0; j<c.length; ++j) {
      var x = c[j]
      if(x < nf) {
        c[j] = front[x]
      } else {
        x = x - nf
        for(var k=0; k<nf; ++k) {
          if(x >= front[k]) {
            x += 1
          }
        }
        c[j] = x
      }
    }
  }
  return cells
}

function convexHullnD(points, d) {
  try {
    return ich(points, true)
  } catch(e) {
    //If point set is degenerate, try to find a basis and rerun it
    var ah = aff(points)
    if(ah.length <= d) {
      //No basis, no try
      return []
    }
    var npoints = permute(points, ah)
    var nhull   = ich(npoints, true)
    return invPermute(nhull, ah)
  }
}
},{"affine-hull":5,"incremental-convex-hull":11}],11:[function(require,module,exports){
"use strict"

//High level idea:
// 1. Use Clarkson's incremental construction to find convex hull
// 2. Point location in triangulation by jump and walk

module.exports = incrementalConvexHull

var orient = require("robust-orientation")
var compareCell = require("simplicial-complex").compareCells

function compareInt(a, b) {
  return a - b
}

function Simplex(vertices, adjacent, boundary) {
  this.vertices = vertices
  this.adjacent = adjacent
  this.boundary = boundary
  this.lastVisited = -1
}

Simplex.prototype.flip = function() {
  var t = this.vertices[0]
  this.vertices[0] = this.vertices[1]
  this.vertices[1] = t
  var u = this.adjacent[0]
  this.adjacent[0] = this.adjacent[1]
  this.adjacent[1] = u
}

function GlueFacet(vertices, cell, index) {
  this.vertices = vertices
  this.cell = cell
  this.index = index
}

function compareGlue(a, b) {
  return compareCell(a.vertices, b.vertices)
}

function bakeOrient(d) {
  var code = ["function orient(){var tuple=this.tuple;return test("]
  for(var i=0; i<=d; ++i) {
    if(i > 0) {
      code.push(",")
    }
    code.push("tuple[", i, "]")
  }
  code.push(")}return orient")
  var proc = new Function("test", code.join(""))
  var test = orient[d+1]
  if(!test) {
    test = orient
  }
  return proc(test)
}

var BAKED = []

function Triangulation(dimension, vertices, simplices) {
  this.dimension = dimension
  this.vertices = vertices
  this.simplices = simplices
  this.interior = simplices.filter(function(c) {
    return !c.boundary
  })

  this.tuple = new Array(dimension+1)
  for(var i=0; i<=dimension; ++i) {
    this.tuple[i] = this.vertices[i]
  }

  var o = BAKED[dimension]
  if(!o) {
    o = BAKED[dimension] = bakeOrient(dimension)
  }
  this.orient = o
}

var proto = Triangulation.prototype

//Degenerate situation where we are on boundary, but coplanar to face
proto.handleBoundaryDegeneracy = function(cell, point) {
  var d = this.dimension
  var n = this.vertices.length - 1
  var tuple = this.tuple
  var verts = this.vertices

  //Dumb solution: Just do dfs from boundary cell until we find any peak, or terminate
  var toVisit = [ cell ]
  cell.lastVisited = -n
  while(toVisit.length > 0) {
    cell = toVisit.pop()
    var cellVerts = cell.vertices
    var cellAdj = cell.adjacent
    for(var i=0; i<=d; ++i) {
      var neighbor = cellAdj[i]
      if(!neighbor.boundary || neighbor.lastVisited <= -n) {
        continue
      }
      var nv = neighbor.vertices
      for(var j=0; j<=d; ++j) {
        var vv = nv[j]
        if(vv < 0) {
          tuple[j] = point
        } else {
          tuple[j] = verts[vv]
        }
      }
      var o = this.orient()
      if(o > 0) {
        return neighbor
      }
      neighbor.lastVisited = -n
      if(o === 0) {
        toVisit.push(neighbor)
      }
    }
  }
  return null
}

proto.walk = function(point, random) {
  //Alias local properties
  var n = this.vertices.length - 1
  var d = this.dimension
  var verts = this.vertices
  var tuple = this.tuple

  //Compute initial jump cell
  var initIndex = random ? (this.interior.length * Math.random())|0 : (this.interior.length-1)
  var cell = this.interior[ initIndex ]

  //Start walking
outerLoop:
  while(!cell.boundary) {
    var cellVerts = cell.vertices
    var cellAdj = cell.adjacent

    for(var i=0; i<=d; ++i) {
      tuple[i] = verts[cellVerts[i]]
    }
    cell.lastVisited = n

    //Find farthest adjacent cell
    for(var i=0; i<=d; ++i) {
      var neighbor = cellAdj[i]
      if(neighbor.lastVisited >= n) {
        continue
      }
      var prev = tuple[i]
      tuple[i] = point
      var o = this.orient()
      tuple[i] = prev
      if(o < 0) {
        cell = neighbor
        continue outerLoop
      } else {
        if(!neighbor.boundary) {
          neighbor.lastVisited = n
        } else {
          neighbor.lastVisited = -n
        }
      }
    }
    return
  }

  return cell
}

proto.addPeaks = function(point, cell) {
  var n = this.vertices.length - 1
  var d = this.dimension
  var verts = this.vertices
  var tuple = this.tuple
  var interior = this.interior
  var simplices = this.simplices

  //Walking finished at boundary, time to add peaks
  var tovisit = [ cell ]

  //Stretch initial boundary cell into a peak
  cell.lastVisited = n
  cell.vertices[cell.vertices.indexOf(-1)] = n
  cell.boundary = false
  interior.push(cell)

  //Record a list of all new boundaries created by added peaks so we can glue them together when we are all done
  var glueFacets = []

  //Do a traversal of the boundary walking outward from starting peak
  while(tovisit.length > 0) {
    //Pop off peak and walk over adjacent cells
    var cell = tovisit.pop()
    var cellVerts = cell.vertices
    var cellAdj = cell.adjacent
    var indexOfN = cellVerts.indexOf(n)
    if(indexOfN < 0) {
      continue
    }

    for(var i=0; i<=d; ++i) {
      if(i === indexOfN) {
        continue
      }

      //For each boundary neighbor of the cell
      var neighbor = cellAdj[i]
      if(!neighbor.boundary || neighbor.lastVisited >= n) {
        continue
      }

      var nv = neighbor.vertices

      //Test if neighbor is a peak
      if(neighbor.lastVisited !== -n) {
        //Compute orientation of p relative to each boundary peak
        var indexOfNeg1 = 0
        for(var j=0; j<=d; ++j) {
          if(nv[j] < 0) {
            indexOfNeg1 = j
            tuple[j] = point
          } else {
            tuple[j] = verts[nv[j]]
          }
        }
        var o = this.orient()

        //Test if neighbor cell is also a peak
        if(o > 0) {
          nv[indexOfNeg1] = n
          neighbor.boundary = false
          interior.push(neighbor)
          tovisit.push(neighbor)
          neighbor.lastVisited = n
          continue
        } else {
          neighbor.lastVisited = -n
        }
      }

      var na = neighbor.adjacent

      //Otherwise, replace neighbor with new face
      var vverts = cellVerts.slice()
      var vadj = cellAdj.slice()
      var ncell = new Simplex(vverts, vadj, true)
      simplices.push(ncell)

      //Connect to neighbor
      var opposite = na.indexOf(cell)
      if(opposite < 0) {
        continue
      }
      na[opposite] = ncell
      vadj[indexOfN] = neighbor

      //Connect to cell
      vverts[i] = -1
      vadj[i] = cell
      cellAdj[i] = ncell

      //Flip facet
      ncell.flip()

      //Add to glue list
      for(var j=0; j<=d; ++j) {
        var uu = vverts[j]
        if(uu < 0 || uu === n) {
          continue
        }
        var nface = new Array(d-1)
        var nptr = 0
        for(var k=0; k<=d; ++k) {
          var vv = vverts[k]
          if(vv < 0 || k === j) {
            continue
          }
          nface[nptr++] = vv
        }
        glueFacets.push(new GlueFacet(nface, ncell, j))
      }
    }
  }

  //Glue boundary facets together
  glueFacets.sort(compareGlue)

  for(var i=0; i+1<glueFacets.length; i+=2) {
    var a = glueFacets[i]
    var b = glueFacets[i+1]
    var ai = a.index
    var bi = b.index
    if(ai < 0 || bi < 0) {
      continue
    }
    a.cell.adjacent[a.index] = b.cell
    b.cell.adjacent[b.index] = a.cell
  }
}

proto.insert = function(point, random) {
  //Add point
  var verts = this.vertices
  verts.push(point)

  var cell = this.walk(point, random)
  if(!cell) {
    return
  }

  //Alias local properties
  var d = this.dimension
  var tuple = this.tuple

  //Degenerate case: If point is coplanar to cell, then walk until we find a non-degenerate boundary
  for(var i=0; i<=d; ++i) {
    var vv = cell.vertices[i]
    if(vv < 0) {
      tuple[i] = point
    } else {
      tuple[i] = verts[vv]
    }
  }
  var o = this.orient(tuple)
  if(o < 0) {
    return
  } else if(o === 0) {
    cell = this.handleBoundaryDegeneracy(cell, point)
    if(!cell) {
      return
    }
  }

  //Add peaks
  this.addPeaks(point, cell)
}

//Extract all boundary cells
proto.boundary = function() {
  var d = this.dimension
  var boundary = []
  var cells = this.simplices
  var nc = cells.length
  for(var i=0; i<nc; ++i) {
    var c = cells[i]
    if(c.boundary) {
      var bcell = new Array(d)
      var cv = c.vertices
      var ptr = 0
      var parity = 0
      for(var j=0; j<=d; ++j) {
        if(cv[j] >= 0) {
          bcell[ptr++] = cv[j]
        } else {
          parity = j&1
        }
      }
      if(parity === (d&1)) {
        var t = bcell[0]
        bcell[0] = bcell[1]
        bcell[1] = t
      }
      boundary.push(bcell)
    }
  }
  return boundary
}

function incrementalConvexHull(points, randomSearch) {
  var n = points.length
  if(n === 0) {
    throw new Error("Must have at least d+1 points")
  }
  var d = points[0].length
  if(n <= d) {
    throw new Error("Must input at least d+1 points")
  }

  //FIXME: This could be degenerate, but need to select d+1 non-coplanar points to bootstrap process
  var initialSimplex = points.slice(0, d+1)

  //Make sure initial simplex is positively oriented
  var o = orient.apply(void 0, initialSimplex)
  if(o === 0) {
    throw new Error("Input not in general position")
  }
  var initialCoords = new Array(d+1)
  for(var i=0; i<=d; ++i) {
    initialCoords[i] = i
  }
  if(o < 0) {
    initialCoords[0] = 1
    initialCoords[1] = 0
  }

  //Create initial topological index, glue pointers together (kind of messy)
  var initialCell = new Simplex(initialCoords, new Array(d+1), false)
  var boundary = initialCell.adjacent
  var list = new Array(d+2)
  for(var i=0; i<=d; ++i) {
    var verts = initialCoords.slice()
    for(var j=0; j<=d; ++j) {
      if(j === i) {
        verts[j] = -1
      }
    }
    var t = verts[0]
    verts[0] = verts[1]
    verts[1] = t
    var cell = new Simplex(verts, new Array(d+1), true)
    boundary[i] = cell
    list[i] = cell
  }
  list[d+1] = initialCell
  for(var i=0; i<=d; ++i) {
    var verts = boundary[i].vertices
    var adj = boundary[i].adjacent
    for(var j=0; j<=d; ++j) {
      var v = verts[j]
      if(v < 0) {
        adj[j] = initialCell
        continue
      }
      for(var k=0; k<=d; ++k) {
        if(boundary[k].vertices.indexOf(v) < 0) {
          adj[j] = boundary[k]
        }
      }
    }
  }

  //Initialize triangles
  var triangles = new Triangulation(d, initialSimplex, list)

  //Insert remaining points
  var useRandom = !!randomSearch
  for(var i=d+1; i<n; ++i) {
    triangles.insert(points[i], useRandom)
  }

  //Extract boundary cells
  return triangles.boundary()
}
},{"robust-orientation":14,"simplicial-complex":18}],12:[function(require,module,exports){
'use strict'

module.exports = monotoneConvexHull2D

var orient = require('robust-orientation')[3]

function monotoneConvexHull2D(points) {
  var n = points.length

  if(n < 3) {
    var result = new Array(n)
    for(var i=0; i<n; ++i) {
      result[i] = i
    }

    if(n === 2 &&
       points[0][0] === points[1][0] &&
       points[0][1] === points[1][1]) {
      return [0]
    }

    return result
  }

  //Sort point indices along x-axis
  var sorted = new Array(n)
  for(var i=0; i<n; ++i) {
    sorted[i] = i
  }
  sorted.sort(function(a,b) {
    var d = points[a][0]-points[b][0]
    if(d) {
      return d
    }
    return points[a][1] - points[b][1]
  })

  //Construct upper and lower hulls
  var lower = [sorted[0], sorted[1]]
  var upper = [sorted[0], sorted[1]]

  for(var i=2; i<n; ++i) {
    var idx = sorted[i]
    var p   = points[idx]

    //Insert into lower list
    var m = lower.length
    while(m > 1 && orient(
        points[lower[m-2]],
        points[lower[m-1]],
        p) <= 0) {
      m -= 1
      lower.pop()
    }
    lower.push(idx)

    //Insert into upper list
    m = upper.length
    while(m > 1 && orient(
        points[upper[m-2]],
        points[upper[m-1]],
        p) >= 0) {
      m -= 1
      upper.pop()
    }
    upper.push(idx)
  }

  //Merge lists together
  var result = new Array(upper.length + lower.length - 2)
  var ptr    = 0
  for(var i=0, nl=lower.length; i<nl; ++i) {
    result[ptr++] = lower[i]
  }
  for(var j=upper.length-2; j>0; --j) {
    result[ptr++] = upper[j]
  }

  //Return result
  return result
}
},{"robust-orientation":14}],13:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.polygonClipping = factory());
}(this, function () { 'use strict';

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  /* follows "An implementation of top-down splaying"
   * by D. Sleator <sleator@cs.cmu.edu> March 1992
   */

  /**
   * @typedef {*} Key
   */

  /**
   * @typedef {*} Value
   */

  /**
   * @typedef {function(node:Node):void} Visitor
   */

  /**
   * @typedef {function(a:Key, b:Key):number} Comparator
   */

  /**
   * @param {function(node:Node):string} NodePrinter
   */

  /**
   * @typedef {Object}  Node
   * @property {Key}    Key
   * @property {Value=} data
   * @property {Node}   left
   * @property {Node}   right
   */
  var Node = function Node(key, data) {
    _classCallCheck(this, Node);

    this.key = key;
    this.data = data;
    this.left = null;
    this.right = null;
  };

  function DEFAULT_COMPARE(a, b) {
    return a > b ? 1 : a < b ? -1 : 0;
  }
  /**
   * Simple top down splay, not requiring i to be in the tree t.
   * @param {Key} i
   * @param {Node?} t
   * @param {Comparator} comparator
   */


  function splay(i, t, comparator) {
    if (t === null) return t;
    var l, r, y;
    var N = new Node();
    l = r = N;

    while (true) {
      var cmp = comparator(i, t.key); //if (i < t.key) {

      if (cmp < 0) {
        if (t.left === null) break; //if (i < t.left.key) {

        if (comparator(i, t.left.key) < 0) {
          y = t.left;
          /* rotate right */

          t.left = y.right;
          y.right = t;
          t = y;
          if (t.left === null) break;
        }

        r.left = t;
        /* link right */

        r = t;
        t = t.left; //} else if (i > t.key) {
      } else if (cmp > 0) {
        if (t.right === null) break; //if (i > t.right.key) {

        if (comparator(i, t.right.key) > 0) {
          y = t.right;
          /* rotate left */

          t.right = y.left;
          y.left = t;
          t = y;
          if (t.right === null) break;
        }

        l.right = t;
        /* link left */

        l = t;
        t = t.right;
      } else {
        break;
      }
    }
    /* assemble */


    l.right = t.left;
    r.left = t.right;
    t.left = N.right;
    t.right = N.left;
    return t;
  }
  /**
   * @param  {Key}        i
   * @param  {Value}      data
   * @param  {Comparator} comparator
   * @param  {Tree}       tree
   * @return {Node}      root
   */


  function _insert(i, data, t, comparator, tree) {
    var node = new Node(i, data);
    tree._size++;

    if (t === null) {
      node.left = node.right = null;
      return node;
    }

    t = splay(i, t, comparator);
    var cmp = comparator(i, t.key);

    if (cmp < 0) {
      node.left = t.left;
      node.right = t;
      t.left = null;
    } else if (cmp >= 0) {
      node.right = t.right;
      node.left = t;
      t.right = null;
    }

    return node;
  }
  /**
   * Insert i into the tree t, unless it's already there.
   * @param  {Key}        i
   * @param  {Value}      data
   * @param  {Comparator} comparator
   * @param  {Tree}       tree
   * @return {Node}       root
   */


  function _add(i, data, t, comparator, tree) {
    var node = new Node(i, data);

    if (t === null) {
      node.left = node.right = null;
      tree._size++;
      return node;
    }

    t = splay(i, t, comparator);
    var cmp = comparator(i, t.key);
    if (cmp === 0) return t;else {
      if (cmp < 0) {
        node.left = t.left;
        node.right = t;
        t.left = null;
      } else if (cmp > 0) {
        node.right = t.right;
        node.left = t;
        t.right = null;
      }

      tree._size++;
      return node;
    }
  }
  /**
   * Deletes i from the tree if it's there
   * @param {Key}        i
   * @param {Tree}       tree
   * @param {Comparator} comparator
   * @param {Tree}       tree
   * @return {Node}      new root
   */


  function _remove(i, t, comparator, tree) {
    var x;
    if (t === null) return null;
    t = splay(i, t, comparator);
    var cmp = comparator(i, t.key);

    if (cmp === 0) {
      /* found it */
      if (t.left === null) {
        x = t.right;
      } else {
        x = splay(i, t.left, comparator);
        x.right = t.right;
      }

      tree._size--;
      return x;
    }

    return t;
    /* It wasn't there */
  }

  function _split(key, v, comparator) {
    var left, right;

    if (v === null) {
      left = right = null;
    } else {
      v = splay(key, v, comparator);
      var cmp = comparator(v.key, key);

      if (cmp === 0) {
        left = v.left;
        right = v.right;
      } else if (cmp < 0) {
        right = v.right;
        v.right = null;
        left = v;
      } else {
        left = v.left;
        v.left = null;
        right = v;
      }
    }

    return {
      left: left,
      right: right
    };
  }

  function merge(left, right, comparator) {
    if (right === null) return left;
    if (left === null) return right;
    right = splay(left.key, right, comparator);
    right.left = left;
    return right;
  }
  /**
   * Prints level of the tree
   * @param  {Node}                        root
   * @param  {String}                      prefix
   * @param  {Boolean}                     isTail
   * @param  {Array<string>}               out
   * @param  {Function(node:Node):String}  printNode
   */


  function printRow(root, prefix, isTail, out, printNode) {
    if (root) {
      out("".concat(prefix).concat(isTail ? '└── ' : '├── ').concat(printNode(root), "\n"));
      var indent = prefix + (isTail ? '    ' : '│   ');
      if (root.left) printRow(root.left, indent, false, out, printNode);
      if (root.right) printRow(root.right, indent, true, out, printNode);
    }
  }

  var Tree =
  /*#__PURE__*/
  function () {
    function Tree() {
      var comparator = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_COMPARE;

      _classCallCheck(this, Tree);

      this._comparator = comparator;
      this._root = null;
      this._size = 0;
    }
    /**
     * Inserts a key, allows duplicates
     * @param  {Key}    key
     * @param  {Value=} data
     * @return {Node|null}
     */


    _createClass(Tree, [{
      key: "insert",
      value: function insert(key, data) {
        return this._root = _insert(key, data, this._root, this._comparator, this);
      }
      /**
       * Adds a key, if it is not present in the tree
       * @param  {Key}    key
       * @param  {Value=} data
       * @return {Node|null}
       */

    }, {
      key: "add",
      value: function add(key, data) {
        return this._root = _add(key, data, this._root, this._comparator, this);
      }
      /**
       * @param  {Key} key
       * @return {Node|null}
       */

    }, {
      key: "remove",
      value: function remove(key) {
        this._root = _remove(key, this._root, this._comparator, this);
      }
      /**
       * Removes and returns the node with smallest key
       * @return {?Node}
       */

    }, {
      key: "pop",
      value: function pop() {
        var node = this._root;

        if (node) {
          while (node.left) {
            node = node.left;
          }

          this._root = splay(node.key, this._root, this._comparator);
          this._root = _remove(node.key, this._root, this._comparator, this);
          return {
            key: node.key,
            data: node.data
          };
        }

        return null;
      }
      /**
       * @param  {Key} key
       * @return {Node|null}
       */

    }, {
      key: "findStatic",
      value: function findStatic(key) {
        var current = this._root;
        var compare = this._comparator;

        while (current) {
          var cmp = compare(key, current.key);
          if (cmp === 0) return current;else if (cmp < 0) current = current.left;else current = current.right;
        }

        return null;
      }
      /**
       * @param  {Key} key
       * @return {Node|null}
       */

    }, {
      key: "find",
      value: function find(key) {
        if (this._root) {
          this._root = splay(key, this._root, this._comparator);
          if (this._comparator(key, this._root.key) !== 0) return null;
        }

        return this._root;
      }
      /**
       * @param  {Key} key
       * @return {Boolean}
       */

    }, {
      key: "contains",
      value: function contains(key) {
        var current = this._root;
        var compare = this._comparator;

        while (current) {
          var cmp = compare(key, current.key);
          if (cmp === 0) return true;else if (cmp < 0) current = current.left;else current = current.right;
        }

        return false;
      }
      /**
       * @param  {Visitor} visitor
       * @param  {*=}      ctx
       * @return {SplayTree}
       */

    }, {
      key: "forEach",
      value: function forEach(visitor, ctx) {
        var current = this._root;
        var Q = [];
        /* Initialize stack s */

        var done = false;

        while (!done) {
          if (current !== null) {
            Q.push(current);
            current = current.left;
          } else {
            if (Q.length !== 0) {
              current = Q.pop();
              visitor.call(ctx, current);
              current = current.right;
            } else done = true;
          }
        }

        return this;
      }
      /**
       * Walk key range from `low` to `high`. Stops if `fn` returns a value.
       * @param  {Key}      low
       * @param  {Key}      high
       * @param  {Function} fn
       * @param  {*?}       ctx
       * @return {SplayTree}
       */

    }, {
      key: "range",
      value: function range(low, high, fn, ctx) {
        var Q = [];
        var compare = this._comparator;
        var node = this._root,
            cmp;

        while (Q.length !== 0 || node) {
          if (node) {
            Q.push(node);
            node = node.left;
          } else {
            node = Q.pop();
            cmp = compare(node.key, high);

            if (cmp > 0) {
              break;
            } else if (compare(node.key, low) >= 0) {
              if (fn.call(ctx, node)) return this; // stop if smth is returned
            }

            node = node.right;
          }
        }

        return this;
      }
      /**
       * Returns array of keys
       * @return {Array<Key>}
       */

    }, {
      key: "keys",
      value: function keys() {
        var keys = [];
        this.forEach(function (_ref) {
          var key = _ref.key;
          return keys.push(key);
        });
        return keys;
      }
      /**
       * Returns array of all the data in the nodes
       * @return {Array<Value>}
       */

    }, {
      key: "values",
      value: function values() {
        var values = [];
        this.forEach(function (_ref2) {
          var data = _ref2.data;
          return values.push(data);
        });
        return values;
      }
      /**
       * @return {Key|null}
       */

    }, {
      key: "min",
      value: function min() {
        if (this._root) return this.minNode(this._root).key;
        return null;
      }
      /**
       * @return {Key|null}
       */

    }, {
      key: "max",
      value: function max() {
        if (this._root) return this.maxNode(this._root).key;
        return null;
      }
      /**
       * @return {Node|null}
       */

    }, {
      key: "minNode",
      value: function minNode() {
        var t = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this._root;
        if (t) while (t.left) {
          t = t.left;
        }
        return t;
      }
      /**
       * @return {Node|null}
       */

    }, {
      key: "maxNode",
      value: function maxNode() {
        var t = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this._root;
        if (t) while (t.right) {
          t = t.right;
        }
        return t;
      }
      /**
       * Returns node at given index
       * @param  {number} index
       * @return {?Node}
       */

    }, {
      key: "at",
      value: function at(index) {
        var current = this._root,
            done = false,
            i = 0;
        var Q = [];

        while (!done) {
          if (current) {
            Q.push(current);
            current = current.left;
          } else {
            if (Q.length > 0) {
              current = Q.pop();
              if (i === index) return current;
              i++;
              current = current.right;
            } else done = true;
          }
        }

        return null;
      }
      /**
       * @param  {Node}   d
       * @return {Node|null}
       */

    }, {
      key: "next",
      value: function next(d) {
        var root = this._root;
        var successor = null;

        if (d.right) {
          successor = d.right;

          while (successor.left) {
            successor = successor.left;
          }

          return successor;
        }

        var comparator = this._comparator;

        while (root) {
          var cmp = comparator(d.key, root.key);
          if (cmp === 0) break;else if (cmp < 0) {
            successor = root;
            root = root.left;
          } else root = root.right;
        }

        return successor;
      }
      /**
       * @param  {Node} d
       * @return {Node|null}
       */

    }, {
      key: "prev",
      value: function prev(d) {
        var root = this._root;
        var predecessor = null;

        if (d.left !== null) {
          predecessor = d.left;

          while (predecessor.right) {
            predecessor = predecessor.right;
          }

          return predecessor;
        }

        var comparator = this._comparator;

        while (root) {
          var cmp = comparator(d.key, root.key);
          if (cmp === 0) break;else if (cmp < 0) root = root.left;else {
            predecessor = root;
            root = root.right;
          }
        }

        return predecessor;
      }
      /**
       * @return {SplayTree}
       */

    }, {
      key: "clear",
      value: function clear() {
        this._root = null;
        this._size = 0;
        return this;
      }
      /**
       * @return {NodeList}
       */

    }, {
      key: "toList",
      value: function toList() {
        return _toList(this._root);
      }
      /**
       * Bulk-load items. Both array have to be same size
       * @param  {Array<Key>}    keys
       * @param  {Array<Value>}  [values]
       * @param  {Boolean}       [presort=false] Pre-sort keys and values, using
       *                                         tree's comparator. Sorting is done
       *                                         in-place
       * @return {AVLTree}
       */

    }, {
      key: "load",
      value: function load() {
        var keys = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
        var values = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
        var presort = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        var size = keys.length;
        var comparator = this._comparator; // sort if needed

        if (presort) sort(keys, values, 0, size - 1, comparator);

        if (this._root === null) {
          // empty tree
          this._root = loadRecursive(this._root, keys, values, 0, size);
          this._size = size;
        } else {
          // that re-builds the whole tree from two in-order traversals
          var mergedList = mergeLists(this.toList(), createList(keys, values), comparator);
          size = this._size + size;
          this._root = sortedListToBST({
            head: mergedList
          }, 0, size);
        }

        return this;
      }
      /**
       * @return {Boolean}
       */

    }, {
      key: "isEmpty",
      value: function isEmpty() {
        return this._root === null;
      }
    }, {
      key: "toString",

      /**
       * @param  {NodePrinter=} printNode
       * @return {String}
       */
      value: function toString() {
        var printNode = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function (n) {
          return n.key;
        };
        var out = [];
        printRow(this._root, '', true, function (v) {
          return out.push(v);
        }, printNode);
        return out.join('');
      }
    }, {
      key: "update",
      value: function update(key, newKey, newData) {
        var comparator = this._comparator;

        var _split2 = _split(key, this._root, comparator),
            left = _split2.left,
            right = _split2.right;

        this._size--;

        if (comparator(key, newKey) < 0) {
          right = _insert(newKey, newData, right, comparator, this);
        } else {
          left = _insert(newKey, newData, left, comparator, this);
        }

        this._root = merge(left, right, comparator);
      }
    }, {
      key: "split",
      value: function split(key) {
        return _split(key, this._root, this._comparator);
      }
    }, {
      key: "size",
      get: function get() {
        return this._size;
      }
    }]);

    return Tree;
  }();

  function loadRecursive(parent, keys, values, start, end) {
    var size = end - start;

    if (size > 0) {
      var middle = start + Math.floor(size / 2);
      var key = keys[middle];
      var data = values[middle];
      var node = {
        key: key,
        data: data,
        parent: parent
      };
      node.left = loadRecursive(node, keys, values, start, middle);
      node.right = loadRecursive(node, keys, values, middle + 1, end);
      return node;
    }

    return null;
  }

  function createList(keys, values) {
    var head = {
      next: null
    };
    var p = head;

    for (var i = 0; i < keys.length; i++) {
      p = p.next = {
        key: keys[i],
        data: values[i]
      };
    }

    p.next = null;
    return head.next;
  }

  function _toList(root) {
    var current = root;
    var Q = [],
        done = false;
    var head = {
      next: null
    };
    var p = head;

    while (!done) {
      if (current) {
        Q.push(current);
        current = current.left;
      } else {
        if (Q.length > 0) {
          current = p = p.next = Q.pop();
          current = current.right;
        } else done = true;
      }
    }

    p.next = null; // that'll work even if the tree was empty

    return head.next;
  }

  function sortedListToBST(list, start, end) {
    var size = end - start;

    if (size > 0) {
      var middle = start + Math.floor(size / 2);
      var left = sortedListToBST(list, start, middle);
      var root = list.head;
      root.left = left;
      list.head = list.head.next;
      root.right = sortedListToBST(list, middle + 1, end);
      return root;
    }

    return null;
  }

  function mergeLists(l1, l2) {
    var compare = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function (a, b) {
      return a - b;
    };
    var head = {}; // dummy

    var p = head;
    var p1 = l1;
    var p2 = l2;

    while (p1 !== null && p2 !== null) {
      if (compare(p1.key, p2.key) < 0) {
        p.next = p1;
        p1 = p1.next;
      } else {
        p.next = p2;
        p2 = p2.next;
      }

      p = p.next;
    }

    if (p1 !== null) p.next = p1;else if (p2 !== null) p.next = p2;
    return head.next;
  }

  function sort(keys, values, left, right, compare) {
    if (left >= right) return;
    var pivot = keys[left + right >> 1];
    var i = left - 1;
    var j = right + 1;

    while (true) {
      do {
        i++;
      } while (compare(keys[i], pivot) < 0);

      do {
        j--;
      } while (compare(keys[j], pivot) > 0);

      if (i >= j) break;
      var tmp = keys[i];
      keys[i] = keys[j];
      keys[j] = tmp;
      tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }

    sort(keys, values, left, j, compare);
    sort(keys, values, j + 1, right, compare);
  }

  /* Javascript doesn't do integer math. Everything is
   * floating point with percision Number.EPSILON.
   *
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON
   */
  var epsilon = Number.EPSILON; // IE Polyfill

  if (epsilon === undefined) epsilon = Math.pow(2, -52);
  var EPSILON_SQ = epsilon * epsilon;
  /* FLP comparator */

  var cmp = function cmp(a, b) {
    // check if they're both 0
    if (-epsilon < a && a < epsilon) {
      if (-epsilon < b && b < epsilon) {
        return 0;
      }
    } // check if they're flp equal


    if ((a - b) * (a - b) < EPSILON_SQ * a * b) {
      return 0;
    } // normal comparison


    return a < b ? -1 : 1;
  };
  /* FLP point comparator, favors point encountered first by sweep line */

  var cmpPoints = function cmpPoints(aPt, bPt) {
    if (aPt === bPt) return 0; // fist compare X, then compare Y

    var a = aPt.x;
    var b = bPt.x; // inlined version of cmp() for performance boost

    if (a <= -epsilon || epsilon <= a || b <= -epsilon || epsilon <= b) {
      var diff = a - b;

      if (diff * diff >= EPSILON_SQ * a * b) {
        return a < b ? -1 : 1;
      }
    }

    a = aPt.y;
    b = bPt.y; // inlined version of cmp() for performance boost

    if (a <= -epsilon || epsilon <= a || b <= -epsilon || epsilon <= b) {
      var _diff = a - b;

      if (_diff * _diff >= EPSILON_SQ * a * b) {
        return a < b ? -1 : 1;
      }
    } // they're the same


    return 0;
  };
  /* Greedy comparison. Two numbers are defined to touch
   * if their midpoint is indistinguishable from either. */

  var touch = function touch(a, b) {
    var m = (a + b) / 2;
    return cmp(m, a) === 0 || cmp(m, b) === 0;
  };
  /* Greedy comparison. Two points are defined to touch
   * if their midpoint is indistinguishable from either. */

  var touchPoints = function touchPoints(aPt, bPt) {
    var mPt = {
      x: (aPt.x + bPt.x) / 2,
      y: (aPt.y + bPt.y) / 2
    };
    return cmpPoints(mPt, aPt) === 0 || cmpPoints(mPt, bPt) === 0;
  };

  /* Cross Product of two vectors with first point at origin */

  var crossProduct = function crossProduct(a, b) {
    return a.x * b.y - a.y * b.x;
  };
  /* Dot Product of two vectors with first point at origin */

  var dotProduct = function dotProduct(a, b) {
    return a.x * b.x + a.y * b.y;
  };
  /* Comparator for two vectors with same starting point */

  var compareVectorAngles = function compareVectorAngles(basePt, endPt1, endPt2) {
    var v1 = {
      x: endPt1.x - basePt.x,
      y: endPt1.y - basePt.y
    };
    var v2 = {
      x: endPt2.x - basePt.x,
      y: endPt2.y - basePt.y
    };
    var kross = crossProduct(v1, v2);
    return cmp(kross, 0);
  };
  var length = function length(v) {
    return Math.sqrt(dotProduct(v, v));
  };
  /* Get the sine of the angle from pShared -> pAngle to pShaed -> pBase */

  var sineOfAngle = function sineOfAngle(pShared, pBase, pAngle) {
    var vBase = {
      x: pBase.x - pShared.x,
      y: pBase.y - pShared.y
    };
    var vAngle = {
      x: pAngle.x - pShared.x,
      y: pAngle.y - pShared.y
    };
    return crossProduct(vAngle, vBase) / length(vAngle) / length(vBase);
  };
  /* Get the cosine of the angle from pShared -> pAngle to pShaed -> pBase */

  var cosineOfAngle = function cosineOfAngle(pShared, pBase, pAngle) {
    var vBase = {
      x: pBase.x - pShared.x,
      y: pBase.y - pShared.y
    };
    var vAngle = {
      x: pAngle.x - pShared.x,
      y: pAngle.y - pShared.y
    };
    return dotProduct(vAngle, vBase) / length(vAngle) / length(vBase);
  };
  /* Get the closest point on an line (defined by two points)
   * to another point. */

  var closestPoint = function closestPoint(ptA1, ptA2, ptB) {
    if (ptA1.x === ptA2.x) return {
      x: ptA1.x,
      y: ptB.y // vertical vector

    };
    if (ptA1.y === ptA2.y) return {
      x: ptB.x,
      y: ptA1.y // horizontal vector
      // use the closer point as a base for calcuation

    };
    var v1 = {
      x: ptA1.x - ptB.x,
      y: ptA1.y - ptB.y
    };
    var v2 = {
      x: ptA2.x - ptB.x,
      y: ptA2.y - ptB.y
    };
    var basePt = ptA1;
    var awayPt = ptA2;

    if (dotProduct(v1, v1) > dotProduct(v2, v2)) {
      awayPt = ptA1;
      basePt = ptA2;
    }

    var vA = {
      x: awayPt.x - basePt.x,
      y: awayPt.y - basePt.y
    };
    var vB = {
      x: ptB.x - basePt.x,
      y: ptB.y - basePt.y
    };
    var dist = dotProduct(vA, vB) / dotProduct(vA, vA);
    return {
      x: basePt.x + dist * vA.x,
      y: basePt.y + dist * vA.y
    };
  };
  /* Get the x coordinate where the given line (defined by a point and vector)
   * crosses the horizontal line with the given y coordiante.
   * In the case of parrallel lines (including overlapping ones) returns null. */

  var horizontalIntersection = function horizontalIntersection(pt, v, y) {
    if (v.y === 0) return null;
    return {
      x: pt.x + v.x / v.y * (y - pt.y),
      y: y
    };
  };
  /* Get the y coordinate where the given line (defined by a point and vector)
   * crosses the vertical line with the given x coordiante.
   * In the case of parrallel lines (including overlapping ones) returns null. */

  var verticalIntersection = function verticalIntersection(pt, v, x) {
    if (v.x === 0) return null;
    return {
      x: x,
      y: pt.y + v.y / v.x * (x - pt.x)
    };
  };
  /* Get the intersection of two lines, each defined by a base point and a vector.
   * In the case of parrallel lines (including overlapping ones) returns null. */

  var intersection = function intersection(pt1, v1, pt2, v2) {
    // take some shortcuts for vertical and horizontal lines
    // this also ensures we don't calculate an intersection and then discover
    // it's actually outside the bounding box of the line
    if (v1.x === 0) return verticalIntersection(pt2, v2, pt1.x);
    if (v2.x === 0) return verticalIntersection(pt1, v1, pt2.x);
    if (v1.y === 0) return horizontalIntersection(pt2, v2, pt1.y);
    if (v2.y === 0) return horizontalIntersection(pt1, v1, pt2.y); // General case for non-overlapping segments.
    // This algorithm is based on Schneider and Eberly.
    // http://www.cimec.org.ar/~ncalvo/Schneider_Eberly.pdf - pg 244

    var kross = crossProduct(v1, v2);
    if (kross == 0) return null;
    var ve = {
      x: pt2.x - pt1.x,
      y: pt2.y - pt1.y
    };
    var d1 = crossProduct(ve, v1) / kross;
    var d2 = crossProduct(ve, v2) / kross; // take the average of the two calculations to minimize rounding error

    var x1 = pt1.x + d2 * v1.x,
        x2 = pt2.x + d1 * v2.x;
    var y1 = pt1.y + d2 * v1.y,
        y2 = pt2.y + d1 * v2.y;
    var x = (x1 + x2) / 2;
    var y = (y1 + y2) / 2;
    return {
      x: x,
      y: y
    };
  };

  /* Given input geometry as a standard array-of-arrays geojson-style
   * geometry, return one that uses objects as points, for better perf */

  var pointsAsObjects = function pointsAsObjects(geom) {
    // we can handle well-formed multipolys and polys
    var output = [];

    if (!Array.isArray(geom)) {
      throw new Error('Input is not a Polygon or MultiPolygon');
    }

    for (var i = 0, iMax = geom.length; i < iMax; i++) {
      if (!Array.isArray(geom[i]) || geom[i].length == 0) {
        throw new Error('Input is not a Polygon or MultiPolygon');
      }

      output.push([]);

      for (var j = 0, jMax = geom[i].length; j < jMax; j++) {
        if (!Array.isArray(geom[i][j]) || geom[i][j].length == 0) {
          throw new Error('Input is not a Polygon or MultiPolygon');
        }

        if (Array.isArray(geom[i][j][0])) {
          // multipolygon
          output[i].push([]);

          for (var k = 0, kMax = geom[i][j].length; k < kMax; k++) {
            if (!Array.isArray(geom[i][j][k]) || geom[i][j][k].length < 2) {
              throw new Error('Input is not a Polygon or MultiPolygon');
            }

            if (geom[i][j][k].length > 2) {
              throw new Error('Input has more than two coordinates. ' + 'Only 2-dimensional polygons supported.');
            }

            output[i][j].push({
              x: geom[i][j][k][0],
              y: geom[i][j][k][1]
            });
          }
        } else {
          // polygon
          if (geom[i][j].length < 2) {
            throw new Error('Input is not a Polygon or MultiPolygon');
          }

          if (geom[i][j].length > 2) {
            throw new Error('Input has more than two coordinates. ' + 'Only 2-dimensional polygons supported.');
          }

          output[i].push({
            x: geom[i][j][0],
            y: geom[i][j][1]
          });
        }
      }
    }

    return output;
  };
  /* WARN: input modified directly */

  var forceMultiPoly = function forceMultiPoly(geom) {
    if (Array.isArray(geom)) {
      if (geom.length === 0) return; // allow empty multipolys

      if (Array.isArray(geom[0])) {
        if (Array.isArray(geom[0][0])) {
          if (typeof geom[0][0][0].x === 'number' && typeof geom[0][0][0].y === 'number') {
            // multipolygon
            return;
          }
        }

        if (typeof geom[0][0].x === 'number' && typeof geom[0][0].y === 'number') {
          // polygon
          geom.unshift(geom.splice(0));
          return;
        }
      }
    }

    throw new Error('Unrecognized input - not a polygon nor multipolygon');
  };
  /* WARN: input modified directly */

  var cleanMultiPoly = function cleanMultiPoly(multipoly) {
    var i = 0;

    while (i < multipoly.length) {
      var poly = multipoly[i];

      if (poly.length === 0) {
        multipoly.splice(i, 1);
        continue;
      }

      var exteriorRing = poly[0];
      cleanRing(exteriorRing); // poly is dropped if exteriorRing is degenerate

      if (exteriorRing.length === 0) {
        multipoly.splice(i, 1);
        continue;
      }

      var j = 1;

      while (j < poly.length) {
        var interiorRing = poly[j];
        cleanRing(interiorRing);
        if (interiorRing.length === 0) poly.splice(j, 1);else j++;
      }

      i++;
    }
  };
  /* Clean ring:
   *  - remove duplicate points
   *  - remove colinear points
   *  - remove rings with no area (less than 3 distinct points)
   *  - un-close rings (last point should not repeat first)
   *
   * WARN: input modified directly */

  var cleanRing = function cleanRing(ring) {
    if (ring.length === 0) return;
    if (cmpPoints(ring[0], ring[ring.length - 1]) === 0) ring.pop();

    var isPointUncessary = function isPointUncessary(prevPt, pt, nextPt) {
      return cmpPoints(prevPt, pt) === 0 || cmpPoints(pt, nextPt) === 0 || compareVectorAngles(pt, prevPt, nextPt) === 0;
    };

    var i = 0;
    var prevPt, nextPt;

    while (i < ring.length) {
      prevPt = i === 0 ? ring[ring.length - 1] : ring[i - 1];
      nextPt = i === ring.length - 1 ? ring[0] : ring[i + 1];
      if (isPointUncessary(prevPt, ring[i], nextPt)) ring.splice(i, 1);else i++;
    } // if our ring has less than 3 distinct points now (so is degenerate)
    // shrink it down to the empty array to communicate to our caller to
    // drop it


    while (ring.length < 3 && ring.length > 0) {
      ring.pop();
    }
  };

  // segments and sweep events when all else is identical

  var sweepEventId = 0;

  var SweepEvent =
  /*#__PURE__*/
  function () {
    _createClass(SweepEvent, null, [{
      key: "compare",
      value: function compare(a, b) {
        // if the events are already linked, then we know the points are equal
        if (a.point !== b.point) {
          // favor event with a point that the sweep line hits first
          var cmpX = cmp(a.point.x, b.point.x);
          if (cmpX !== 0) return cmpX;
          var cmpY = cmp(a.point.y, b.point.y);
          if (cmpY !== 0) return cmpY; // Points are equal, so go ahead and link these events.

          a.link(b);
        } // favor right events over left


        if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1; // are they identical?

        if (a === b) return 0; // The calcuations of relative segment angle below can give different
        // results after segment splitting due to rounding errors.
        // To maintain sweep event queue ordering, we thus skip these calculations
        // if we already know the segements to be colinear (one of the requirements
        // of the 'consumedBy' relationship).

        var aConsumedBy = a;
        var bConsumedBy = b;

        while (aConsumedBy.consumedBy) {
          aConsumedBy = aConsumedBy.consumedBy;
        }

        while (bConsumedBy.consumedBy) {
          bConsumedBy = bConsumedBy.consumedBy;
        }

        if (aConsumedBy !== bConsumedBy) {
          // favor vertical segments for left events, and non-vertical for right
          // https://github.com/mfogel/polygon-clipping/issues/29
          var aVert = a.segment.isVertical();
          var bVert = b.segment.isVertical();
          if (aVert && !bVert) return a.isLeft ? 1 : -1;
          if (!aVert && bVert) return a.isLeft ? -1 : 1; // Favor events where the line segment is lower.
          // Sometimes, because one segment is longer than the other,
          // one of these comparisons will return 0 and the other won't.

          var pointSegCmp = a.segment.compareVertically(b.otherSE.point);
          if (pointSegCmp === 1) return -1;
          if (pointSegCmp === -1) return 1;
          var otherPointSegCmp = b.segment.compareVertically(a.otherSE.point);
          if (otherPointSegCmp !== 0) return otherPointSegCmp; // NOTE:  We don't sort on segment length because that changes
          //        as segments are divided.
        } // as a tie-breaker, favor lower creation id


        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        throw new Error("SweepEvent comparison failed at [".concat(a.point.x, ", ").concat(a.point.y, "]"));
      } // Warning: 'point' input will be modified and re-used (for performance)

    }]);

    function SweepEvent(point, isLeft) {
      _classCallCheck(this, SweepEvent);

      if (point.events === undefined) point.events = [this];else point.events.push(this);
      this.point = point;
      this.isLeft = isLeft;
      this.id = ++sweepEventId; // this.segment, this.otherSE set by factory
    }

    _createClass(SweepEvent, [{
      key: "link",
      value: function link(other) {
        if (other.point === this.point) {
          throw new Error('Tried to link already linked events');
        }

        var otherEvents = other.point.events;

        for (var i = 0, iMax = otherEvents.length; i < iMax; i++) {
          var evt = otherEvents[i];
          this.point.events.push(evt);
          evt.point = this.point;
        }

        this.segment.checkForConsuming();
        other.segment.checkForConsuming();
      }
    }, {
      key: "getAvailableLinkedEvents",
      value: function getAvailableLinkedEvents() {
        // point.events is always of length 2 or greater
        var events = [];

        for (var i = 0, iMax = this.point.events.length; i < iMax; i++) {
          var evt = this.point.events[i];

          if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
            events.push(evt);
          }
        }

        return events;
      }
      /**
       * Returns a comparator function for sorting linked events that will
       * favor the event that will give us the smallest left-side angle.
       * All ring construction starts as low as possible heading to the right,
       * so by always turning left as sharp as possible we'll get polygons
       * without uncessary loops & holes.
       *
       * The comparator function has a compute cache such that it avoids
       * re-computing already-computed values.
       */

    }, {
      key: "getLeftmostComparator",
      value: function getLeftmostComparator(baseEvent) {
        var _this = this;

        var cache = new Map();

        var fillCache = function fillCache(linkedEvent) {
          var nextEvent = linkedEvent.otherSE;
          cache.set(linkedEvent, {
            sine: sineOfAngle(_this.point, baseEvent.point, nextEvent.point),
            cosine: cosineOfAngle(_this.point, baseEvent.point, nextEvent.point)
          });
        };

        return function (a, b) {
          if (!cache.has(a)) fillCache(a);
          if (!cache.has(b)) fillCache(b);

          var _cache$get = cache.get(a),
              asine = _cache$get.sine,
              acosine = _cache$get.cosine;

          var _cache$get2 = cache.get(b),
              bsine = _cache$get2.sine,
              bcosine = _cache$get2.cosine;

          var cmpZeroASine = cmp(asine, 0);
          var cmpZeroBSine = cmp(bsine, 0);
          if (cmpZeroASine >= 0 && cmpZeroBSine >= 0) return cmp(bcosine, acosine);
          if (cmpZeroASine < 0 && cmpZeroBSine < 0) return cmp(acosine, bcosine);
          return cmp(bsine, asine);
        };
      }
    }]);

    return SweepEvent;
  }();

  /**
   * A bounding box has the format:
   *
   *  { ll: { x: xmin, y: ymin }, ur: { x: xmax, y: ymax } }
   *
   */

  var isInBbox = function isInBbox(bbox, point) {
    return cmp(bbox.ll.x, point.x) <= 0 && cmp(point.x, bbox.ur.x) <= 0 && cmp(bbox.ll.y, point.y) <= 0 && cmp(point.y, bbox.ur.y) <= 0;
  };
  /* Greedy comparison with a bbox. A point is defined to 'touch'
   * a bbox if:
   *  - it is inside the bbox
   *  - it 'touches' one of the sides (another greedy comparison) */

  var touchesBbox = function touchesBbox(bbox, point) {
    return (cmp(bbox.ll.x, point.x) <= 0 || touch(bbox.ll.x, point.x)) && (cmp(point.x, bbox.ur.x) <= 0 || touch(point.x, bbox.ur.x)) && (cmp(bbox.ll.y, point.y) <= 0 || touch(bbox.ll.y, point.y)) && (cmp(point.y, bbox.ur.y) <= 0 || touch(point.y, bbox.ur.y));
  };
  /* Returns either null, or a bbox (aka an ordered pair of points)
   * If there is only one point of overlap, a bbox with identical points
   * will be returned */

  var getBboxOverlap = function getBboxOverlap(b1, b2) {
    // check if the bboxes overlap at all
    if (cmp(b2.ur.x, b1.ll.x) < 0 || cmp(b1.ur.x, b2.ll.x) < 0 || cmp(b2.ur.y, b1.ll.y) < 0 || cmp(b1.ur.y, b2.ll.y) < 0) return null; // find the middle two X values

    var lowerX = b1.ll.x < b2.ll.x ? b2.ll.x : b1.ll.x;
    var upperX = b1.ur.x < b2.ur.x ? b1.ur.x : b2.ur.x; // find the middle two Y values

    var lowerY = b1.ll.y < b2.ll.y ? b2.ll.y : b1.ll.y;
    var upperY = b1.ur.y < b2.ur.y ? b1.ur.y : b2.ur.y; // put those middle values together to get the overlap

    return {
      ll: {
        x: lowerX,
        y: lowerY
      },
      ur: {
        x: upperX,
        y: upperY
      }
    };
  };

  var Segment =
  /*#__PURE__*/
  function () {
    _createClass(Segment, null, [{
      key: "compare",
      value: function compare(a, b) {
        var alx = a.leftSE.point.x;
        var aly = a.leftSE.point.y;
        var blx = b.leftSE.point.x;
        var bly = b.leftSE.point.y;
        var arx = a.rightSE.point.x;
        var brx = b.rightSE.point.x; // check if they're even in the same vertical plane

        if (cmp(brx, alx) < 0) return 1;
        if (cmp(arx, blx) < 0) return -1; // check for a consumption relationship. if present,
        // avoid the segment angle calculations (can yield
        // inconsistent results after splitting)

        var aConsumedBy = a;
        var bConsumedBy = b;

        while (aConsumedBy.consumedBy) {
          aConsumedBy = aConsumedBy.consumedBy;
        }

        while (bConsumedBy.consumedBy) {
          bConsumedBy = bConsumedBy.consumedBy;
        } // for segment angle comparisons


        var aCmpBLeft, aCmpBRight, bCmpALeft, bCmpARight;

        if (aConsumedBy === bConsumedBy) {
          // are they identical?
          if (a === b) return 0; // colinear segments with matching left-endpoints, fall back
          // on creation order of left sweep events as a tie-breaker

          var aId = a.leftSE.id;
          var bId = b.leftSE.id;
          if (aId < bId) return -1;
          if (aId > bId) return 1;
        } else if ( // are a and b colinear?
        (aCmpBLeft = a.comparePoint(b.leftSE.point)) === 0 && (aCmpBRight = a.comparePoint(b.rightSE.point)) === 0 && (bCmpALeft = b.comparePoint(a.leftSE.point)) === 0 && (bCmpARight = b.comparePoint(a.rightSE.point)) === 0) {
          // a & b are colinear
          // colinear segments with non-matching left-endpoints, consider
          // the more-left endpoint to be earlier
          var cmpLX = cmp(alx, blx);
          if (cmpLX !== 0) return cmpLX; // NOTE: we do not use segment length to break a tie here, because
          //       when segments are split their length changes
          // colinear segments with matching left-endpoints, fall back
          // on creation order of left sweep events as a tie-breaker

          var _aId = a.leftSE.id;
          var _bId = b.leftSE.id;
          if (_aId < _bId) return -1;
          if (_aId > _bId) return 1;
        } else {
          // a & b are not colinear
          var _cmpLX = cmp(alx, blx); // if the left endpoints are not in the same vertical line,
          // consider the placement of the left event of the right-more segment
          // with respect to the left-more segment.


          if (_cmpLX < 0) {
            if (aCmpBLeft > 0) return -1;
            if (aCmpBLeft < 0) return 1; // NOTE: fall-through is necessary here. why? Can that be avoided?
          }

          if (_cmpLX > 0) {
            if (bCmpALeft === undefined) bCmpALeft = b.comparePoint(a.leftSE.point);
            if (bCmpALeft !== 0) return bCmpALeft; // NOTE: fall-through is necessary here. why? Can that be avoided?
          }

          var cmpLY = cmp(aly, bly); // if left endpoints are in the same vertical line, lower means ealier

          if (cmpLY !== 0) return cmpLY; // left endpoints match exactly
          // special case verticals due to rounding errors
          // part of https://github.com/mfogel/polygon-clipping/issues/29

          var aVert = a.isVertical();
          if (aVert !== b.isVertical()) return aVert ? 1 : -1; // sometimes, because one segment is longer than the other,
          // one of these comparisons will return 0 and the other won't

          if (aCmpBRight === undefined) aCmpBRight = a.comparePoint(b.rightSE.point);
          if (aCmpBRight > 0) return -1;
          if (aCmpBRight < 0) return 1;
          if (bCmpARight === undefined) bCmpARight = b.comparePoint(a.rightSE.point);
          if (bCmpARight !== 0) return bCmpARight;
        }

        throw new Error('Segment comparison of ' + "[".concat(a.leftSE.point.x, ", ").concat(a.leftSE.point.y, "] -> [").concat(a.rightSE.point.x, ", ").concat(a.rightSE.point.y, "] ") + 'against ' + "[".concat(b.leftSE.point.x, ", ").concat(b.leftSE.point.y, "] -> [").concat(b.rightSE.point.x, ", ").concat(b.rightSE.point.y, "] ") + 'failed. Please submit a bug report.');
      }
      /* Warning: a reference to ringsIn input will be stored,
       *  and possibly will be later modified */

    }]);

    function Segment(leftSE, rightSE, ringsIn) {
      _classCallCheck(this, Segment);

      this.leftSE = leftSE;
      leftSE.segment = this;
      leftSE.otherSE = rightSE;
      this.rightSE = rightSE;
      rightSE.segment = this;
      rightSE.otherSE = leftSE;
      this.ringsIn = ringsIn;
      this._cache = {}; // left unset for performance, set later in algorithm
      // this.ringOut, this.consumedBy, this.prev
    }

    _createClass(Segment, [{
      key: "replaceRightSE",

      /* When a segment is split, the rightSE is replaced with a new sweep event */
      value: function replaceRightSE(newRightSE) {
        this.rightSE = newRightSE;
        this.rightSE.segment = this;
        this.rightSE.otherSE = this.leftSE;
        this.leftSE.otherSE = this.rightSE;
      }
    }, {
      key: "bbox",
      value: function bbox() {
        var y1 = this.leftSE.point.y;
        var y2 = this.rightSE.point.y;
        return {
          ll: {
            x: this.leftSE.point.x,
            y: y1 < y2 ? y1 : y2
          },
          ur: {
            x: this.rightSE.point.x,
            y: y1 > y2 ? y1 : y2
          }
        };
      }
      /* A vector from the left point to the right */

    }, {
      key: "vector",
      value: function vector() {
        return {
          x: this.rightSE.point.x - this.leftSE.point.x,
          y: this.rightSE.point.y - this.leftSE.point.y
        };
      }
    }, {
      key: "isVertical",
      value: function isVertical() {
        return cmp(this.leftSE.point.x, this.rightSE.point.x) === 0;
      }
    }, {
      key: "isAnEndpoint",
      value: function isAnEndpoint(point) {
        return cmpPoints(point, this.leftSE.point) === 0 || cmpPoints(point, this.rightSE.point) === 0;
      }
      /* Compare this segment with a point. Return value indicates:
       *     1: point lies above or to the left of segment
       *     0: point is colinear to segment
       *    -1: point is below or to the right of segment */

    }, {
      key: "comparePoint",
      value: function comparePoint(point) {
        if (this.isAnEndpoint(point)) return 0;
        var interPt = closestPoint(this.leftSE.point, this.rightSE.point, point);
        var cmpY = cmp(point.y, interPt.y);
        if (cmpY !== 0) return cmpY;
        var cmpX = cmp(point.x, interPt.x);
        var segCmpX = cmp(this.leftSE.point.y, this.rightSE.point.y); // depending on if our segment angles up or down,
        // the x coord comparison means oppposite things

        if (cmpX > 0) return segCmpX;

        if (cmpX < 0) {
          if (segCmpX > 0) return -1;
          if (segCmpX < 0) return 1;
        }

        return 0;
      }
      /* Compare point vertically with segment.
       *    1: point is below segment
       *    0: segment appears to be vertical
       *   -1: point is above segment */

    }, {
      key: "compareVertically",
      value: function compareVertically(point) {
        if (this.isAnEndpoint(point)) return 0;
        var interPt = verticalIntersection(this.leftSE.point, this.vector(), point.x); // Trying to be as exact as possible here, hence not using flp comparisons

        if (interPt !== null) {
          if (point.y < interPt.y) return -1;
          if (point.y > interPt.y) return 1;
        }

        return 0;
      }
      /* Does the point in question touch the given segment?
       * Greedy - essentially a 2 * Number.EPSILON comparison.
       * If it's not possible to add an independent point between the
       * point and the segment, we say the point 'touches' the segment. */

    }, {
      key: "touches",
      value: function touches(point) {
        if (!touchesBbox(this.bbox(), point)) return false; // if the points have been linked already, performance boost use that

        if (point === this.leftSE.point || point === this.rightSE.point) return true;
        var cPt1 = closestPoint(this.leftSE.point, this.rightSE.point, point);
        var avgPt1 = {
          x: (cPt1.x + point.x) / 2,
          y: (cPt1.y + point.y) / 2
        };
        return touchPoints(avgPt1, cPt1) || touchPoints(avgPt1, point);
      }
      /**
       * Given another segment, returns the first non-trivial intersection
       * between the two segments (in terms of sweep line ordering), if it exists.
       *
       * A 'non-trivial' intersection is one that will cause one or both of the
       * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
       *
       *   * endpoint of segA with endpoint of segB --> trivial
       *   * endpoint of segA with point along segB --> non-trivial
       *   * endpoint of segB with point along segA --> non-trivial
       *   * point along segA with point along segB --> non-trivial
       *
       * If no non-trivial intersection exists, return null
       * Else, return null.
       */

    }, {
      key: "getIntersection",
      value: function getIntersection(other) {
        // If bboxes don't overlap, there can't be any intersections
        var bboxOverlap = getBboxOverlap(this.bbox(), other.bbox());
        if (bboxOverlap === null) return null; // We first check to see if the endpoints can be considered intersections.
        // This will 'snap' intersections to endpoints if possible, and will
        // handle cases of colinearity.
        // does each endpoint touch the other segment?

        var touchesOtherLSE = this.touches(other.leftSE.point);
        var touchesThisLSE = other.touches(this.leftSE.point);
        var touchesOtherRSE = this.touches(other.rightSE.point);
        var touchesThisRSE = other.touches(this.rightSE.point); // do left endpoints match?

        if (touchesThisLSE && touchesOtherLSE) {
          // these two cases are for colinear segments with matching left
          // endpoints, and one segment being longer than the other
          if (touchesThisRSE && !touchesOtherRSE) return this.rightSE.point;
          if (!touchesThisRSE && touchesOtherRSE) return other.rightSE.point; // either the two segments match exactly (two trival intersections)
          // or just on their left endpoint (one trivial intersection

          return null;
        } // does this left endpoint matches (other doesn't)


        if (touchesThisLSE) {
          // check for segments that just intersect on opposing endpoints
          if (touchesOtherRSE && cmpPoints(this.leftSE.point, other.rightSE.point) === 0) return null; // t-intersection on left endpoint

          return this.leftSE.point;
        } // does other left endpoint matches (this doesn't)


        if (touchesOtherLSE) {
          // check for segments that just intersect on opposing endpoints
          if (touchesThisRSE && cmpPoints(this.rightSE.point, other.leftSE.point) === 0) return null; // t-intersection on left endpoint

          return other.leftSE.point;
        } // trivial intersection on right endpoints


        if (touchesThisRSE && touchesOtherRSE) return null; // t-intersections on just one right endpoint

        if (touchesThisRSE) return this.rightSE.point;
        if (touchesOtherRSE) return other.rightSE.point; // None of our endpoints intersect. Look for a general intersection between
        // infinite lines laid over the segments

        var pt = intersection(this.leftSE.point, this.vector(), other.leftSE.point, other.vector()); // are the segments parrallel? Note that if they were colinear with overlap,
        // they would have an endpoint intersection and that case was already handled above

        if (pt === null) return null; // is the intersection found between the lines not on the segments?

        if (!isInBbox(bboxOverlap, pt)) return null; // We don't need to check if we need to 'snap' to an endpoint,
        // because the endpoint cmps we did eariler were greedy

        return pt;
      }
      /**
       * Split the given segment into multiple segments on the given points.
       *  * Each existing segment will retain its leftSE and a new rightSE will be
       *    generated for it.
       *  * A new segment will be generated which will adopt the original segment's
       *    rightSE, and a new leftSE will be generated for it.
       *  * If there are more than two points given to split on, new segments
       *    in the middle will be generated with new leftSE and rightSE's.
       *  * An array of the newly generated SweepEvents will be returned.
       *
       * Warning: input array of points is modified
       */

    }, {
      key: "split",
      value: function split(points) {
        // sort the points in sweep line order
        points.sort(cmpPoints);
        var prevSeg = this;
        var prevPoint = null;
        var newEvents = [];

        for (var i = 0, iMax = points.length; i < iMax; i++) {
          var point = points[i]; // skip repeated points

          if (prevPoint && cmpPoints(prevPoint, point) === 0) continue;
          var alreadyLinked = point.events !== undefined;
          var newLeftSE = new SweepEvent(point, true);
          var newRightSE = new SweepEvent(point, false);
          var oldRightSE = prevSeg.rightSE;
          prevSeg.replaceRightSE(newRightSE);
          newEvents.push(newRightSE);
          newEvents.push(newLeftSE);
          prevSeg = new Segment(newLeftSE, oldRightSE, prevSeg.ringsIn.slice()); // in the point we just used to create new sweep events with was already
          // linked to other events, we need to check if either of the affected
          // segments should be consumed

          if (alreadyLinked) {
            newLeftSE.segment.checkForConsuming();
            newRightSE.segment.checkForConsuming();
          }

          prevPoint = point;
        }

        return newEvents;
      }
      /* Do a pass over the linked events and to see if any segments
       * should be consumed. If so, do it. */

    }, {
      key: "checkForConsuming",
      value: function checkForConsuming() {
        if (this.leftSE.point.events.length === 1) return;
        if (this.rightSE.point.events.length === 1) return;

        for (var i = 0, iMax = this.leftSE.point.events.length; i < iMax; i++) {
          var le = this.leftSE.point.events[i];
          if (le === this.leftSE) continue;

          for (var j = 0, jMax = this.rightSE.point.events.length; j < jMax; j++) {
            var re = this.rightSE.point.events[j];
            if (re === this.rightSE) continue;
            if (le.segment === re.segment) this.consume(le.segment);
          }
        }
      }
      /* Consume another segment. We take their ringsIn under our wing
       * and mark them as consumed. Use for perfectly overlapping segments */

    }, {
      key: "consume",
      value: function consume(other) {
        var consumer = this;
        var consumee = other;

        while (consumer.consumedBy) {
          consumer = consumer.consumedBy;
        }

        while (consumee.consumedBy) {
          consumee = consumee.consumedBy;
        }

        var cmp$$1 = Segment.compare(consumer, consumee);
        if (cmp$$1 === 0) return; // already consumed
        // the winner of the consumption is the earlier segment
        // according to sweep line ordering

        if (cmp$$1 > 0) {
          var tmp = consumer;
          consumer = consumee;
          consumee = tmp;
        } // make sure a segment doesn't consume it's prev


        if (consumer.prev === consumee) {
          var _tmp = consumer;
          consumer = consumee;
          consumee = _tmp;
        }

        for (var i = 0, iMax = consumee.ringsIn.length; i < iMax; i++) {
          consumer.ringsIn.push(consumee.ringsIn[i]);
        }

        consumee.ringsIn = null;
        consumee.consumedBy = consumer; // mark sweep events consumed as to maintain ordering in sweep event queue

        consumee.leftSE.consumedBy = consumer.leftSE;
        consumee.rightSE.consumedBy = consumer.rightSE;
      }
      /* The first segment previous segment chain that is in the result */

    }, {
      key: "prevInResult",
      value: function prevInResult() {
        var key = 'prevInResult';
        if (this._cache[key] === undefined) this._cache[key] = this["_".concat(key)]();
        return this._cache[key];
      }
    }, {
      key: "_prevInResult",
      value: function _prevInResult() {
        if (!this.prev) return null;
        if (this.prev.isInResult()) return this.prev;
        return this.prev.prevInResult();
      }
    }, {
      key: "ringsBefore",
      value: function ringsBefore() {
        var key = 'ringsBefore';
        if (this._cache[key] === undefined) this._cache[key] = this["_".concat(key)]();
        return this._cache[key];
      }
    }, {
      key: "_ringsBefore",
      value: function _ringsBefore() {
        if (!this.prev) return [];
        return (this.prev.consumedBy || this.prev).ringsAfter();
      }
    }, {
      key: "ringsAfter",
      value: function ringsAfter() {
        var key = 'ringsAfter';
        if (this._cache[key] === undefined) this._cache[key] = this["_".concat(key)]();
        return this._cache[key];
      }
    }, {
      key: "_ringsAfter",
      value: function _ringsAfter() {
        var rings = this.ringsBefore().slice(0);

        for (var i = 0, iMax = this.ringsIn.length; i < iMax; i++) {
          var ring = this.ringsIn[i];
          var index = rings.indexOf(ring);
          if (index === -1) rings.push(ring);else rings.splice(index, 1);
        }

        return rings;
      }
    }, {
      key: "multiPolysBefore",
      value: function multiPolysBefore() {
        var key = 'multiPolysBefore';
        if (this._cache[key] === undefined) this._cache[key] = this["_".concat(key)]();
        return this._cache[key];
      }
    }, {
      key: "_multiPolysBefore",
      value: function _multiPolysBefore() {
        if (!this.prev) return [];
        return (this.prev.consumedBy || this.prev).multiPolysAfter();
      }
    }, {
      key: "multiPolysAfter",
      value: function multiPolysAfter() {
        var key = 'multiPolysAfter';
        if (this._cache[key] === undefined) this._cache[key] = this["_".concat(key)]();
        return this._cache[key];
      }
    }, {
      key: "_multiPolysAfter",
      value: function _multiPolysAfter() {
        // first calcualte our polysAfter
        var polysAfter = [];
        var polysExclude = [];
        var ringsAfter = this.ringsAfter();

        for (var i = 0, iMax = ringsAfter.length; i < iMax; i++) {
          var ring = ringsAfter[i];
          var poly = ring.poly;
          if (polysExclude.indexOf(poly) !== -1) continue;
          if (ring.isExterior) polysAfter.push(poly);else {
            if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
            var index = polysAfter.indexOf(ring.poly);
            if (index !== -1) polysAfter.splice(index, 1);
          }
        } // now calculate our multiPolysAfter


        var mps = [];

        for (var _i = 0, _iMax = polysAfter.length; _i < _iMax; _i++) {
          var mp = polysAfter[_i].multiPoly;
          if (mps.indexOf(mp) === -1) mps.push(mp);
        }

        return mps;
      }
      /* Is this segment part of the final result? */

    }, {
      key: "isInResult",
      value: function isInResult() {
        var key = 'isInResult';
        if (this._cache[key] === undefined) this._cache[key] = this["_".concat(key)]();
        return this._cache[key];
      }
    }, {
      key: "_isInResult",
      value: function _isInResult() {
        // if we've been consumed, we're not in the result
        if (this.consumedBy) return false;
        var mpsBefore = this.multiPolysBefore();
        var mpsAfter = this.multiPolysAfter();

        switch (operation.type) {
          case 'union':
            {
              // UNION - included iff:
              //  * On one side of us there is 0 poly interiors AND
              //  * On the other side there is 1 or more.
              var noBefores = mpsBefore.length === 0;
              var noAfters = mpsAfter.length === 0;
              return noBefores !== noAfters;
            }

          case 'intersection':
            {
              // INTERSECTION - included iff:
              //  * on one side of us all multipolys are rep. with poly interiors AND
              //  * on the other side of us, not all multipolys are repsented
              //    with poly interiors
              var least;
              var most;

              if (mpsBefore.length < mpsAfter.length) {
                least = mpsBefore.length;
                most = mpsAfter.length;
              } else {
                least = mpsAfter.length;
                most = mpsBefore.length;
              }

              return most === operation.numMultiPolys && least < most;
            }

          case 'xor':
            {
              // XOR - included iff:
              //  * the difference between the number of multipolys represented
              //    with poly interiors on our two sides is an odd number
              var diff = Math.abs(mpsBefore.length - mpsAfter.length);
              return diff % 2 === 1;
            }

          case 'difference':
            {
              // DIFFERENCE included iff:
              //  * on exactly one side, we have just the subject
              var isJustSubject = function isJustSubject(mps) {
                return mps.length === 1 && mps[0].isSubject;
              };

              return isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
            }

          default:
            throw new Error("Unrecognized operation type found ".concat(operation.type));
        }
      }
    }], [{
      key: "fromRing",
      value: function fromRing(point1, point2, ring) {
        var leftSE, rightSE;
        var ptCmp = cmpPoints(point1, point2);

        if (ptCmp < 0) {
          leftSE = new SweepEvent(point1, true);
          rightSE = new SweepEvent(point2, false);
        } else if (ptCmp > 0) {
          leftSE = new SweepEvent(point2, true);
          rightSE = new SweepEvent(point1, false);
        } else {
          throw new Error("Tried to create degenerate segment at [".concat(point1.x, ", ").concat(point2.y, "]"));
        }

        return new Segment(leftSE, rightSE, [ring]);
      }
    }]);

    return Segment;
  }();

  var RingIn =
  /*#__PURE__*/
  function () {
    function RingIn(geomRing, poly, isExterior) {
      _classCallCheck(this, RingIn);

      this.poly = poly;
      this.isExterior = isExterior;
      this.segments = [];
      var prevPoint = geomRing[0];

      for (var i = 1, iMax = geomRing.length; i < iMax; i++) {
        var point = geomRing[i];
        this.segments.push(Segment.fromRing(prevPoint, point, this));
        prevPoint = point;
      }

      this.segments.push(Segment.fromRing(prevPoint, geomRing[0], this));
    }

    _createClass(RingIn, [{
      key: "getSweepEvents",
      value: function getSweepEvents() {
        var sweepEvents = [];

        for (var i = 0, iMax = this.segments.length; i < iMax; i++) {
          var segment = this.segments[i];
          sweepEvents.push(segment.leftSE);
          sweepEvents.push(segment.rightSE);
        }

        return sweepEvents;
      }
    }]);

    return RingIn;
  }();
  var PolyIn =
  /*#__PURE__*/
  function () {
    function PolyIn(geomPoly, multiPoly) {
      _classCallCheck(this, PolyIn);

      this.exteriorRing = new RingIn(geomPoly[0], this, true);
      this.interiorRings = [];

      for (var i = 1, iMax = geomPoly.length; i < iMax; i++) {
        this.interiorRings.push(new RingIn(geomPoly[i], this, false));
      }

      this.multiPoly = multiPoly;
    }

    _createClass(PolyIn, [{
      key: "getSweepEvents",
      value: function getSweepEvents() {
        var sweepEvents = this.exteriorRing.getSweepEvents();

        for (var i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
          var ringSweepEvents = this.interiorRings[i].getSweepEvents();

          for (var j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
            sweepEvents.push(ringSweepEvents[j]);
          }
        }

        return sweepEvents;
      }
    }]);

    return PolyIn;
  }();
  var MultiPolyIn =
  /*#__PURE__*/
  function () {
    function MultiPolyIn(geomMultiPoly) {
      _classCallCheck(this, MultiPolyIn);

      this.polys = [];

      for (var i = 0, iMax = geomMultiPoly.length; i < iMax; i++) {
        this.polys.push(new PolyIn(geomMultiPoly[i], this));
      }

      this.isSubject = false;
    }

    _createClass(MultiPolyIn, [{
      key: "markAsSubject",
      value: function markAsSubject() {
        this.isSubject = true;
      }
    }, {
      key: "getSweepEvents",
      value: function getSweepEvents() {
        var sweepEvents = [];

        for (var i = 0, iMax = this.polys.length; i < iMax; i++) {
          var polySweepEvents = this.polys[i].getSweepEvents();

          for (var j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
            sweepEvents.push(polySweepEvents[j]);
          }
        }

        return sweepEvents;
      }
    }]);

    return MultiPolyIn;
  }();

  var RingOut =
  /*#__PURE__*/
  function () {
    _createClass(RingOut, null, [{
      key: "factory",

      /* Given the segments from the sweep line pass, compute & return a series
       * of closed rings from all the segments marked to be part of the result */
      value: function factory(allSegments) {
        var ringsOut = [];

        for (var i = 0, iMax = allSegments.length; i < iMax; i++) {
          var segment = allSegments[i];
          if (!segment.isInResult() || segment.ringOut) continue;
          var prevEvent = null;
          var event = segment.leftSE;
          var nextEvent = segment.rightSE;
          var events = [event];
          var startingPoint = event.point;
          var intersectionLEs = [];
          /* Walk the chain of linked events to form a closed ring */

          while (true) {
            prevEvent = event;
            event = nextEvent;
            events.push(event);
            /* Is the ring complete? */

            if (event.point === startingPoint) break;

            while (true) {
              var availableLEs = event.getAvailableLinkedEvents();
              /* Did we hit a dead end? This shouldn't happen. Indicates some earlier
               * part of the algorithm malfunctioned... please file a bug report. */

              if (availableLEs.length === 0) {
                var firstPt = events[0].point;
                var lastPt = events[events.length - 1].point;
                throw new Error("Unable to complete output ring starting at [".concat(firstPt.x, ",") + " ".concat(firstPt.y, "]. Last matching segment found ends at") + " [".concat(lastPt.x, ", ").concat(lastPt.y, "]."));
              }
              /* Only one way to go, so cotinue on the path */


              if (availableLEs.length === 1) {
                nextEvent = availableLEs[0].otherSE;
                break;
              }
              /* We must have an intersection. Check for a completed loop */


              var indexLE = null;

              for (var j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
                if (intersectionLEs[j].point === event.point) {
                  indexLE = j;
                  break;
                }
              }
              /* Found a completed loop. Cut that off and make a ring */


              if (indexLE !== null) {
                var intersectionLE = intersectionLEs.splice(indexLE)[0];
                var ringEvents = events.splice(intersectionLE.index);
                ringEvents.unshift(ringEvents[0].otherSE);
                ringsOut.push(new RingOut(ringEvents.reverse()));
                continue;
              }
              /* register the intersection */


              intersectionLEs.push({
                index: events.length,
                point: event.point
              });
              /* Choose the left-most option to continue the walk */

              var comparator = event.getLeftmostComparator(prevEvent);
              nextEvent = availableLEs.sort(comparator)[0].otherSE;
              break;
            }
          }

          ringsOut.push(new RingOut(events));
        }

        return ringsOut;
      }
    }]);

    function RingOut(events) {
      _classCallCheck(this, RingOut);

      this.events = events;

      for (var i = 0, iMax = events.length; i < iMax; i++) {
        events[i].segment.ringOut = this;
      }

      this.poly = null;
    }

    _createClass(RingOut, [{
      key: "getGeom",
      value: function getGeom() {
        // Remove superfluous points (ie extra points along a straight line),
        var prevPt = this.events[0].point;
        var points = [prevPt];

        for (var i = 1, iMax = this.events.length - 1; i < iMax; i++) {
          var _pt = this.events[i].point;
          var _nextPt = this.events[i + 1].point;
          if (compareVectorAngles(_pt, prevPt, _nextPt) === 0) continue;
          points.push(_pt);
          prevPt = _pt;
        } // ring was all (within rounding error of angle calc) colinear points


        if (points.length === 1) return null; // check if the starting point is necessary

        var pt = points[0];
        var nextPt = points[1];
        if (compareVectorAngles(pt, prevPt, nextPt) === 0) points.shift();
        points.push(points[0]);
        var step = this.isExteriorRing() ? 1 : -1;
        var iStart = this.isExteriorRing() ? 0 : points.length - 1;
        var iEnd = this.isExteriorRing() ? points.length : -1;
        var orderedPoints = [];

        for (var _i = iStart; _i != iEnd; _i += step) {
          orderedPoints.push([points[_i].x, points[_i].y]);
        }

        return orderedPoints;
      }
    }, {
      key: "isExteriorRing",
      value: function isExteriorRing() {
        if (this._isExteriorRing === undefined) {
          var enclosing = this.enclosingRing();
          this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
        }

        return this._isExteriorRing;
      }
    }, {
      key: "enclosingRing",
      value: function enclosingRing() {
        if (this._enclosingRing === undefined) {
          this._enclosingRing = this._calcEnclosingRing();
        }

        return this._enclosingRing;
      }
      /* Returns the ring that encloses this one, if any */

    }, {
      key: "_calcEnclosingRing",
      value: function _calcEnclosingRing() {
        // start with the ealier sweep line event so that the prevSeg
        // chain doesn't lead us inside of a loop of ours
        var leftMostEvt = this.events[0];

        for (var i = 1, iMax = this.events.length; i < iMax; i++) {
          var evt = this.events[i];
          if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
        }

        var prevSeg = leftMostEvt.segment.prevInResult();
        var prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;

        while (true) {
          // no segment found, thus no ring can enclose us
          if (!prevSeg) return null; // no segments below prev segment found, thus the ring of the prev
          // segment must loop back around and enclose us

          if (!prevPrevSeg) return prevSeg.ringOut; // if the two segments are of different rings, the ring of the prev
          // segment must either loop around us or the ring of the prev prev
          // seg, which would make us and the ring of the prev peers

          if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
            if (prevPrevSeg.ringOut.enclosingRing() !== prevSeg.ringOut) {
              return prevSeg.ringOut;
            } else return prevSeg.ringOut.enclosingRing();
          } // two segments are from the same ring, so this was a penisula
          // of that ring. iterate downward, keep searching


          prevSeg = prevPrevSeg.prevInResult();
          prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
        }
      }
    }]);

    return RingOut;
  }();
  var PolyOut =
  /*#__PURE__*/
  function () {
    function PolyOut(exteriorRing) {
      _classCallCheck(this, PolyOut);

      this.exteriorRing = exteriorRing;
      exteriorRing.poly = this;
      this.interiorRings = [];
    }

    _createClass(PolyOut, [{
      key: "addInterior",
      value: function addInterior(ring) {
        this.interiorRings.push(ring);
        ring.poly = this;
      }
    }, {
      key: "getGeom",
      value: function getGeom() {
        var geom = [this.exteriorRing.getGeom()]; // exterior ring was all (within rounding error of angle calc) colinear points

        if (geom[0] === null) return null;

        for (var i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
          var ringGeom = this.interiorRings[i].getGeom(); // interior ring was all (within rounding error of angle calc) colinear points

          if (ringGeom === null) continue;
          geom.push(ringGeom);
        }

        return geom;
      }
    }]);

    return PolyOut;
  }();
  var MultiPolyOut =
  /*#__PURE__*/
  function () {
    function MultiPolyOut(rings) {
      _classCallCheck(this, MultiPolyOut);

      this.rings = rings;
      this.polys = this._composePolys(rings);
    }

    _createClass(MultiPolyOut, [{
      key: "getGeom",
      value: function getGeom() {
        var geom = [];

        for (var i = 0, iMax = this.polys.length; i < iMax; i++) {
          var polyGeom = this.polys[i].getGeom(); // exterior ring was all (within rounding error of angle calc) colinear points

          if (polyGeom === null) continue;
          geom.push(polyGeom);
        }

        return geom;
      }
    }, {
      key: "_composePolys",
      value: function _composePolys(rings) {
        var polys = [];

        for (var i = 0, iMax = rings.length; i < iMax; i++) {
          var ring = rings[i];
          if (ring.poly) continue;
          if (ring.isExteriorRing()) polys.push(new PolyOut(ring));else {
            var enclosingRing = ring.enclosingRing();
            if (!enclosingRing.poly) polys.push(new PolyOut(enclosingRing));
            enclosingRing.poly.addInterior(ring);
          }
        }

        return polys;
      }
    }]);

    return MultiPolyOut;
  }();

  /**
   * NOTE:  We must be careful not to change any segments while
   *        they are in the SplayTree. AFAIK, there's no way to tell
   *        the tree to rebalance itself - thus before splitting
   *        a segment that's in the tree, we remove it from the tree,
   *        do the split, then re-insert it. (Even though splitting a
   *        segment *shouldn't* change its correct position in the
   *        sweep line tree, the reality is because of rounding errors,
   *        it sometimes does.)
   */

  var SweepLine =
  /*#__PURE__*/
  function () {
    function SweepLine(queue) {
      var comparator = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Segment.compare;

      _classCallCheck(this, SweepLine);

      this.queue = queue;
      this.tree = new Tree(comparator);
      this.segments = [];
    }

    _createClass(SweepLine, [{
      key: "process",
      value: function process(event) {
        var segment = event.segment;
        var newEvents = []; // if we've already been consumed by another segment,
        // clean up our body parts and get out

        if (event.consumedBy) {
          if (event.isLeft) this.queue.remove(event.otherSE);else this.tree.remove(segment);
          return newEvents;
        }

        var node = event.isLeft ? this.tree.insert(segment) : this.tree.find(segment);
        if (!node) throw new Error('Unable to find segment ' + "#".concat(segment.leftSE.id, " [").concat(segment.leftSE.point.x, ", ").concat(segment.leftSE.point.y, "] -> ") + "#".concat(segment.rightSE.id, " [").concat(segment.rightSE.point.x, ", ").concat(segment.rightSE.point.y, "] ") + 'in SweepLine tree. Please submit a bug report.');
        var prevNode = node;
        var nextNode = node;
        var prevSeg = undefined;
        var nextSeg = undefined; // skip consumed segments still in tree

        while (prevSeg === undefined) {
          prevNode = this.tree.prev(prevNode);
          if (prevNode === null) prevSeg = null;else if (prevNode.key.consumedBy === undefined) prevSeg = prevNode.key;
        } // skip consumed segments still in tree


        while (nextSeg === undefined) {
          nextNode = this.tree.next(nextNode);
          if (nextNode === null) nextSeg = null;else if (nextNode.key.consumedBy === undefined) nextSeg = nextNode.key;
        }

        if (event.isLeft) {
          // TODO: would it make sense to just stop and bail out at the first time we're split?
          //       rather than split ourselves multiple times?
          var mySplitters = []; // Check for intersections against the previous segment in the sweep line

          if (prevSeg) {
            var prevInter = prevSeg.getIntersection(segment);

            if (prevInter !== null) {
              if (!segment.isAnEndpoint(prevInter)) mySplitters.push(prevInter);

              if (!prevSeg.isAnEndpoint(prevInter)) {
                var newEventsFromSplit = this._splitSafely(prevSeg, prevInter);

                for (var i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
            }
          } // Check for intersections against the next segment in the sweep line


          if (nextSeg) {
            var nextInter = nextSeg.getIntersection(segment);

            if (nextInter !== null) {
              if (!segment.isAnEndpoint(nextInter)) mySplitters.push(nextInter);

              if (!nextSeg.isAnEndpoint(nextInter)) {
                var _newEventsFromSplit = this._splitSafely(nextSeg, nextInter);

                for (var _i = 0, _iMax = _newEventsFromSplit.length; _i < _iMax; _i++) {
                  newEvents.push(_newEventsFromSplit[_i]);
                }
              }
            }
          } // split ourselves if need be


          if (mySplitters.length > 0) {
            // Rounding errors can cause changes in ordering,
            // so remove afected segments and right sweep events before splitting
            this.queue.remove(segment.rightSE);
            newEvents.push(segment.rightSE);

            var _newEventsFromSplit2 = segment.split(mySplitters);

            for (var _i2 = 0, _iMax2 = _newEventsFromSplit2.length; _i2 < _iMax2; _i2++) {
              newEvents.push(_newEventsFromSplit2[_i2]);
            }
          }

          if (newEvents.length > 0) {
            // We found some intersections, so re-do the current event to
            // make sure sweep line ordering is totally consistent for later
            // use with the segment 'prev' pointers
            this.tree.remove(segment);
            newEvents.push(event);
          } else {
            // done with left event
            this.segments.push(segment);
            segment.prev = prevSeg;
          }
        } else {
          // event.isRight
          // since we're about to be removed from the sweep line, check for
          // intersections between our previous and next segments
          if (prevSeg && nextSeg) {
            var inter = prevSeg.getIntersection(nextSeg);

            if (inter !== null) {
              if (!prevSeg.isAnEndpoint(inter)) {
                var _newEventsFromSplit3 = this._splitSafely(prevSeg, inter);

                for (var _i3 = 0, _iMax3 = _newEventsFromSplit3.length; _i3 < _iMax3; _i3++) {
                  newEvents.push(_newEventsFromSplit3[_i3]);
                }
              }

              if (!nextSeg.isAnEndpoint(inter)) {
                var _newEventsFromSplit4 = this._splitSafely(nextSeg, inter);

                for (var _i4 = 0, _iMax4 = _newEventsFromSplit4.length; _i4 < _iMax4; _i4++) {
                  newEvents.push(_newEventsFromSplit4[_i4]);
                }
              }
            }
          }

          this.tree.remove(segment);
        }

        return newEvents;
      }
      /* Safely split a segment that is currently in the datastructures
       * IE - a segment other than the one that is currently being processed. */

    }, {
      key: "_splitSafely",
      value: function _splitSafely(seg, pt) {
        // Rounding errors can cause changes in ordering,
        // so remove afected segments and right sweep events before splitting
        // removeNode() doesn't work, so have re-find the seg
        // https://github.com/w8r/splay-tree/pull/5
        this.tree.remove(seg);
        var rightSE = seg.rightSE;
        this.queue.remove(rightSE);
        var newEvents = seg.split([pt]);
        newEvents.push(rightSE); // splitting can trigger consumption

        if (seg.consumedBy === undefined) this.tree.insert(seg);
        return newEvents;
      }
    }]);

    return SweepLine;
  }();

  var Operation =
  /*#__PURE__*/
  function () {
    function Operation() {
      _classCallCheck(this, Operation);
    }

    _createClass(Operation, [{
      key: "run",
      value: function run(type, geom, moreGeoms) {
        operation.type = type;
        /* Make a copy of the input geometry with points as objects, for perf */

        var geoms = [pointsAsObjects(geom)];

        for (var i = 0, iMax = moreGeoms.length; i < iMax; i++) {
          geoms.push(pointsAsObjects(moreGeoms[i]));
        }
        /* Clean inputs */


        for (var _i = 0, _iMax = geoms.length; _i < _iMax; _i++) {
          forceMultiPoly(geoms[_i]);
          cleanMultiPoly(geoms[_i]);
        }
        /* Convert inputs to MultiPoly objects, mark subject */


        var multipolys = [];

        for (var _i2 = 0, _iMax2 = geoms.length; _i2 < _iMax2; _i2++) {
          multipolys.push(new MultiPolyIn(geoms[_i2]));
        }

        multipolys[0].markAsSubject();
        operation.numMultiPolys = multipolys.length;
        /* Put segment endpoints in a priority queue */

        var queue = new Tree(SweepEvent.compare);

        for (var _i3 = 0, _iMax3 = multipolys.length; _i3 < _iMax3; _i3++) {
          var sweepEvents = multipolys[_i3].getSweepEvents();

          for (var j = 0, jMax = sweepEvents.length; j < jMax; j++) {
            queue.insert(sweepEvents[j]);
          }
        }
        /* Pass the sweep line over those endpoints */


        var sweepLine = new SweepLine(queue);
        var prevQueueSize = queue.size;
        var node = queue.pop();

        while (node) {
          var evt = node.key;

          if (queue.size === prevQueueSize) {
            // prevents an infinite loop, an otherwise common manifestation of bugs
            throw new Error("Unable to pop() SweepEvent #".concat(evt.id, " [").concat(evt.point.x, ", ").concat(evt.point.y, "] ") + 'from queue. Please file a bug report.');
          }

          var newEvents = sweepLine.process(evt);

          for (var _i4 = 0, _iMax4 = newEvents.length; _i4 < _iMax4; _i4++) {
            var _evt = newEvents[_i4];
            if (_evt.consumedBy === undefined) queue.insert(_evt);
          }

          prevQueueSize = queue.size;
          node = queue.pop();
        }
        /* Collect and compile segments we're keeping into a multipolygon */


        var ringsOut = RingOut.factory(sweepLine.segments);
        var result = new MultiPolyOut(ringsOut);
        return result.getGeom();
      }
    }]);

    return Operation;
  }(); // singleton available by import

  var operation = new Operation();

  var union = function union(geom) {
    for (var _len = arguments.length, moreGeoms = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      moreGeoms[_key - 1] = arguments[_key];
    }

    return operation.run('union', geom, moreGeoms);
  };

  var intersection$1 = function intersection(geom) {
    for (var _len2 = arguments.length, moreGeoms = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      moreGeoms[_key2 - 1] = arguments[_key2];
    }

    return operation.run('intersection', geom, moreGeoms);
  };

  var xor = function xor(geom) {
    for (var _len3 = arguments.length, moreGeoms = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      moreGeoms[_key3 - 1] = arguments[_key3];
    }

    return operation.run('xor', geom, moreGeoms);
  };

  var difference = function difference(subjectGeom) {
    for (var _len4 = arguments.length, clippingGeoms = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
      clippingGeoms[_key4 - 1] = arguments[_key4];
    }

    return operation.run('difference', subjectGeom, clippingGeoms);
  };

  var index = {
    union: union,
    intersection: intersection$1,
    xor: xor,
    difference: difference
  };

  return index;

}));

},{}],14:[function(require,module,exports){
"use strict"

var twoProduct = require("two-product")
var robustSum = require("robust-sum")
var robustScale = require("robust-scale")
var robustSubtract = require("robust-subtract")

var NUM_EXPAND = 5

var EPSILON     = 1.1102230246251565e-16
var ERRBOUND3   = (3.0 + 16.0 * EPSILON) * EPSILON
var ERRBOUND4   = (7.0 + 56.0 * EPSILON) * EPSILON

function cofactor(m, c) {
  var result = new Array(m.length-1)
  for(var i=1; i<m.length; ++i) {
    var r = result[i-1] = new Array(m.length-1)
    for(var j=0,k=0; j<m.length; ++j) {
      if(j === c) {
        continue
      }
      r[k++] = m[i][j]
    }
  }
  return result
}

function matrix(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = new Array(n)
    for(var j=0; j<n; ++j) {
      result[i][j] = ["m", j, "[", (n-i-1), "]"].join("")
    }
  }
  return result
}

function sign(n) {
  if(n & 1) {
    return "-"
  }
  return ""
}

function generateSum(expr) {
  if(expr.length === 1) {
    return expr[0]
  } else if(expr.length === 2) {
    return ["sum(", expr[0], ",", expr[1], ")"].join("")
  } else {
    var m = expr.length>>1
    return ["sum(", generateSum(expr.slice(0, m)), ",", generateSum(expr.slice(m)), ")"].join("")
  }
}

function determinant(m) {
  if(m.length === 2) {
    return [["sum(prod(", m[0][0], ",", m[1][1], "),prod(-", m[0][1], ",", m[1][0], "))"].join("")]
  } else {
    var expr = []
    for(var i=0; i<m.length; ++i) {
      expr.push(["scale(", generateSum(determinant(cofactor(m, i))), ",", sign(i), m[0][i], ")"].join(""))
    }
    return expr
  }
}

function orientation(n) {
  var pos = []
  var neg = []
  var m = matrix(n)
  var args = []
  for(var i=0; i<n; ++i) {
    if((i&1)===0) {
      pos.push.apply(pos, determinant(cofactor(m, i)))
    } else {
      neg.push.apply(neg, determinant(cofactor(m, i)))
    }
    args.push("m" + i)
  }
  var posExpr = generateSum(pos)
  var negExpr = generateSum(neg)
  var funcName = "orientation" + n + "Exact"
  var code = ["function ", funcName, "(", args.join(), "){var p=", posExpr, ",n=", negExpr, ",d=sub(p,n);\
return d[d.length-1];};return ", funcName].join("")
  var proc = new Function("sum", "prod", "scale", "sub", code)
  return proc(robustSum, twoProduct, robustScale, robustSubtract)
}

var orientation3Exact = orientation(3)
var orientation4Exact = orientation(4)

var CACHED = [
  function orientation0() { return 0 },
  function orientation1() { return 0 },
  function orientation2(a, b) {
    return b[0] - a[0]
  },
  function orientation3(a, b, c) {
    var l = (a[1] - c[1]) * (b[0] - c[0])
    var r = (a[0] - c[0]) * (b[1] - c[1])
    var det = l - r
    var s
    if(l > 0) {
      if(r <= 0) {
        return det
      } else {
        s = l + r
      }
    } else if(l < 0) {
      if(r >= 0) {
        return det
      } else {
        s = -(l + r)
      }
    } else {
      return det
    }
    var tol = ERRBOUND3 * s
    if(det >= tol || det <= -tol) {
      return det
    }
    return orientation3Exact(a, b, c)
  },
  function orientation4(a,b,c,d) {
    var adx = a[0] - d[0]
    var bdx = b[0] - d[0]
    var cdx = c[0] - d[0]
    var ady = a[1] - d[1]
    var bdy = b[1] - d[1]
    var cdy = c[1] - d[1]
    var adz = a[2] - d[2]
    var bdz = b[2] - d[2]
    var cdz = c[2] - d[2]
    var bdxcdy = bdx * cdy
    var cdxbdy = cdx * bdy
    var cdxady = cdx * ady
    var adxcdy = adx * cdy
    var adxbdy = adx * bdy
    var bdxady = bdx * ady
    var det = adz * (bdxcdy - cdxbdy)
            + bdz * (cdxady - adxcdy)
            + cdz * (adxbdy - bdxady)
    var permanent = (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * Math.abs(adz)
                  + (Math.abs(cdxady) + Math.abs(adxcdy)) * Math.abs(bdz)
                  + (Math.abs(adxbdy) + Math.abs(bdxady)) * Math.abs(cdz)
    var tol = ERRBOUND4 * permanent
    if ((det > tol) || (-det > tol)) {
      return det
    }
    return orientation4Exact(a,b,c,d)
  }
]

function slowOrient(args) {
  var proc = CACHED[args.length]
  if(!proc) {
    proc = CACHED[args.length] = orientation(args.length)
  }
  return proc.apply(undefined, args)
}

function generateOrientationProc() {
  while(CACHED.length <= NUM_EXPAND) {
    CACHED.push(orientation(CACHED.length))
  }
  var args = []
  var procArgs = ["slow"]
  for(var i=0; i<=NUM_EXPAND; ++i) {
    args.push("a" + i)
    procArgs.push("o" + i)
  }
  var code = [
    "function getOrientation(", args.join(), "){switch(arguments.length){case 0:case 1:return 0;"
  ]
  for(var i=2; i<=NUM_EXPAND; ++i) {
    code.push("case ", i, ":return o", i, "(", args.slice(0, i).join(), ");")
  }
  code.push("}var s=new Array(arguments.length);for(var i=0;i<arguments.length;++i){s[i]=arguments[i]};return slow(s);}return getOrientation")
  procArgs.push(code.join(""))

  var proc = Function.apply(undefined, procArgs)
  module.exports = proc.apply(undefined, [slowOrient].concat(CACHED))
  for(var i=0; i<=NUM_EXPAND; ++i) {
    module.exports[i] = CACHED[i]
  }
}

generateOrientationProc()
},{"robust-scale":15,"robust-subtract":16,"robust-sum":17,"two-product":19}],15:[function(require,module,exports){
"use strict"

var twoProduct = require("two-product")
var twoSum = require("two-sum")

module.exports = scaleLinearExpansion

function scaleLinearExpansion(e, scale) {
  var n = e.length
  if(n === 1) {
    var ts = twoProduct(e[0], scale)
    if(ts[0]) {
      return ts
    }
    return [ ts[1] ]
  }
  var g = new Array(2 * n)
  var q = [0.1, 0.1]
  var t = [0.1, 0.1]
  var count = 0
  twoProduct(e[0], scale, q)
  if(q[0]) {
    g[count++] = q[0]
  }
  for(var i=1; i<n; ++i) {
    twoProduct(e[i], scale, t)
    var pq = q[1]
    twoSum(pq, t[0], q)
    if(q[0]) {
      g[count++] = q[0]
    }
    var a = t[1]
    var b = q[1]
    var x = a + b
    var bv = x - a
    var y = b - bv
    q[1] = x
    if(y) {
      g[count++] = y
    }
  }
  if(q[1]) {
    g[count++] = q[1]
  }
  if(count === 0) {
    g[count++] = 0.0
  }
  g.length = count
  return g
}
},{"two-product":19,"two-sum":20}],16:[function(require,module,exports){
"use strict"

module.exports = robustSubtract

//Easy case: Add two scalars
function scalarScalar(a, b) {
  var x = a + b
  var bv = x - a
  var av = x - bv
  var br = b - bv
  var ar = a - av
  var y = ar + br
  if(y) {
    return [y, x]
  }
  return [x]
}

function robustSubtract(e, f) {
  var ne = e.length|0
  var nf = f.length|0
  if(ne === 1 && nf === 1) {
    return scalarScalar(e[0], -f[0])
  }
  var n = ne + nf
  var g = new Array(n)
  var count = 0
  var eptr = 0
  var fptr = 0
  var abs = Math.abs
  var ei = e[eptr]
  var ea = abs(ei)
  var fi = -f[fptr]
  var fa = abs(fi)
  var a, b
  if(ea < fa) {
    b = ei
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
      ea = abs(ei)
    }
  } else {
    b = fi
    fptr += 1
    if(fptr < nf) {
      fi = -f[fptr]
      fa = abs(fi)
    }
  }
  if((eptr < ne && ea < fa) || (fptr >= nf)) {
    a = ei
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
      ea = abs(ei)
    }
  } else {
    a = fi
    fptr += 1
    if(fptr < nf) {
      fi = -f[fptr]
      fa = abs(fi)
    }
  }
  var x = a + b
  var bv = x - a
  var y = b - bv
  var q0 = y
  var q1 = x
  var _x, _bv, _av, _br, _ar
  while(eptr < ne && fptr < nf) {
    if(ea < fa) {
      a = ei
      eptr += 1
      if(eptr < ne) {
        ei = e[eptr]
        ea = abs(ei)
      }
    } else {
      a = fi
      fptr += 1
      if(fptr < nf) {
        fi = -f[fptr]
        fa = abs(fi)
      }
    }
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
  }
  while(eptr < ne) {
    a = ei
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
    }
  }
  while(fptr < nf) {
    a = fi
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
    fptr += 1
    if(fptr < nf) {
      fi = -f[fptr]
    }
  }
  if(q0) {
    g[count++] = q0
  }
  if(q1) {
    g[count++] = q1
  }
  if(!count) {
    g[count++] = 0.0
  }
  g.length = count
  return g
}
},{}],17:[function(require,module,exports){
"use strict"

module.exports = linearExpansionSum

//Easy case: Add two scalars
function scalarScalar(a, b) {
  var x = a + b
  var bv = x - a
  var av = x - bv
  var br = b - bv
  var ar = a - av
  var y = ar + br
  if(y) {
    return [y, x]
  }
  return [x]
}

function linearExpansionSum(e, f) {
  var ne = e.length|0
  var nf = f.length|0
  if(ne === 1 && nf === 1) {
    return scalarScalar(e[0], f[0])
  }
  var n = ne + nf
  var g = new Array(n)
  var count = 0
  var eptr = 0
  var fptr = 0
  var abs = Math.abs
  var ei = e[eptr]
  var ea = abs(ei)
  var fi = f[fptr]
  var fa = abs(fi)
  var a, b
  if(ea < fa) {
    b = ei
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
      ea = abs(ei)
    }
  } else {
    b = fi
    fptr += 1
    if(fptr < nf) {
      fi = f[fptr]
      fa = abs(fi)
    }
  }
  if((eptr < ne && ea < fa) || (fptr >= nf)) {
    a = ei
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
      ea = abs(ei)
    }
  } else {
    a = fi
    fptr += 1
    if(fptr < nf) {
      fi = f[fptr]
      fa = abs(fi)
    }
  }
  var x = a + b
  var bv = x - a
  var y = b - bv
  var q0 = y
  var q1 = x
  var _x, _bv, _av, _br, _ar
  while(eptr < ne && fptr < nf) {
    if(ea < fa) {
      a = ei
      eptr += 1
      if(eptr < ne) {
        ei = e[eptr]
        ea = abs(ei)
      }
    } else {
      a = fi
      fptr += 1
      if(fptr < nf) {
        fi = f[fptr]
        fa = abs(fi)
      }
    }
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
  }
  while(eptr < ne) {
    a = ei
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
    }
  }
  while(fptr < nf) {
    a = fi
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
    fptr += 1
    if(fptr < nf) {
      fi = f[fptr]
    }
  }
  if(q0) {
    g[count++] = q0
  }
  if(q1) {
    g[count++] = q1
  }
  if(!count) {
    g[count++] = 0.0
  }
  g.length = count
  return g
}
},{}],18:[function(require,module,exports){
"use strict"; "use restrict";

var bits      = require("bit-twiddle")
  , UnionFind = require("union-find")

//Returns the dimension of a cell complex
function dimension(cells) {
  var d = 0
    , max = Math.max
  for(var i=0, il=cells.length; i<il; ++i) {
    d = max(d, cells[i].length)
  }
  return d-1
}
exports.dimension = dimension

//Counts the number of vertices in faces
function countVertices(cells) {
  var vc = -1
    , max = Math.max
  for(var i=0, il=cells.length; i<il; ++i) {
    var c = cells[i]
    for(var j=0, jl=c.length; j<jl; ++j) {
      vc = max(vc, c[j])
    }
  }
  return vc+1
}
exports.countVertices = countVertices

//Returns a deep copy of cells
function cloneCells(cells) {
  var ncells = new Array(cells.length)
  for(var i=0, il=cells.length; i<il; ++i) {
    ncells[i] = cells[i].slice(0)
  }
  return ncells
}
exports.cloneCells = cloneCells

//Ranks a pair of cells up to permutation
function compareCells(a, b) {
  var n = a.length
    , t = a.length - b.length
    , min = Math.min
  if(t) {
    return t
  }
  switch(n) {
    case 0:
      return 0;
    case 1:
      return a[0] - b[0];
    case 2:
      var d = a[0]+a[1]-b[0]-b[1]
      if(d) {
        return d
      }
      return min(a[0],a[1]) - min(b[0],b[1])
    case 3:
      var l1 = a[0]+a[1]
        , m1 = b[0]+b[1]
      d = l1+a[2] - (m1+b[2])
      if(d) {
        return d
      }
      var l0 = min(a[0], a[1])
        , m0 = min(b[0], b[1])
        , d  = min(l0, a[2]) - min(m0, b[2])
      if(d) {
        return d
      }
      return min(l0+a[2], l1) - min(m0+b[2], m1)

    //TODO: Maybe optimize n=4 as well?

    default:
      var as = a.slice(0)
      as.sort()
      var bs = b.slice(0)
      bs.sort()
      for(var i=0; i<n; ++i) {
        t = as[i] - bs[i]
        if(t) {
          return t
        }
      }
      return 0
  }
}
exports.compareCells = compareCells

function compareZipped(a, b) {
  return compareCells(a[0], b[0])
}

//Puts a cell complex into normal order for the purposes of findCell queries
function normalize(cells, attr) {
  if(attr) {
    var len = cells.length
    var zipped = new Array(len)
    for(var i=0; i<len; ++i) {
      zipped[i] = [cells[i], attr[i]]
    }
    zipped.sort(compareZipped)
    for(var i=0; i<len; ++i) {
      cells[i] = zipped[i][0]
      attr[i] = zipped[i][1]
    }
    return cells
  } else {
    cells.sort(compareCells)
    return cells
  }
}
exports.normalize = normalize

//Removes all duplicate cells in the complex
function unique(cells) {
  if(cells.length === 0) {
    return []
  }
  var ptr = 1
    , len = cells.length
  for(var i=1; i<len; ++i) {
    var a = cells[i]
    if(compareCells(a, cells[i-1])) {
      if(i === ptr) {
        ptr++
        continue
      }
      cells[ptr++] = a
    }
  }
  cells.length = ptr
  return cells
}
exports.unique = unique;

//Finds a cell in a normalized cell complex
function findCell(cells, c) {
  var lo = 0
    , hi = cells.length-1
    , r  = -1
  while (lo <= hi) {
    var mid = (lo + hi) >> 1
      , s   = compareCells(cells[mid], c)
    if(s <= 0) {
      if(s === 0) {
        r = mid
      }
      lo = mid + 1
    } else if(s > 0) {
      hi = mid - 1
    }
  }
  return r
}
exports.findCell = findCell;

//Builds an index for an n-cell.  This is more general than dual, but less efficient
function incidence(from_cells, to_cells) {
  var index = new Array(from_cells.length)
  for(var i=0, il=index.length; i<il; ++i) {
    index[i] = []
  }
  var b = []
  for(var i=0, n=to_cells.length; i<n; ++i) {
    var c = to_cells[i]
    var cl = c.length
    for(var k=1, kn=(1<<cl); k<kn; ++k) {
      b.length = bits.popCount(k)
      var l = 0
      for(var j=0; j<cl; ++j) {
        if(k & (1<<j)) {
          b[l++] = c[j]
        }
      }
      var idx=findCell(from_cells, b)
      if(idx < 0) {
        continue
      }
      while(true) {
        index[idx++].push(i)
        if(idx >= from_cells.length || compareCells(from_cells[idx], b) !== 0) {
          break
        }
      }
    }
  }
  return index
}
exports.incidence = incidence

//Computes the dual of the mesh.  This is basically an optimized version of buildIndex for the situation where from_cells is just the list of vertices
function dual(cells, vertex_count) {
  if(!vertex_count) {
    return incidence(unique(skeleton(cells, 0)), cells, 0)
  }
  var res = new Array(vertex_count)
  for(var i=0; i<vertex_count; ++i) {
    res[i] = []
  }
  for(var i=0, len=cells.length; i<len; ++i) {
    var c = cells[i]
    for(var j=0, cl=c.length; j<cl; ++j) {
      res[c[j]].push(i)
    }
  }
  return res
}
exports.dual = dual

//Enumerates all cells in the complex
function explode(cells) {
  var result = []
  for(var i=0, il=cells.length; i<il; ++i) {
    var c = cells[i]
      , cl = c.length|0
    for(var j=1, jl=(1<<cl); j<jl; ++j) {
      var b = []
      for(var k=0; k<cl; ++k) {
        if((j >>> k) & 1) {
          b.push(c[k])
        }
      }
      result.push(b)
    }
  }
  return normalize(result)
}
exports.explode = explode

//Enumerates all of the n-cells of a cell complex
function skeleton(cells, n) {
  if(n < 0) {
    return []
  }
  var result = []
    , k0     = (1<<(n+1))-1
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i]
    for(var k=k0; k<(1<<c.length); k=bits.nextCombination(k)) {
      var b = new Array(n+1)
        , l = 0
      for(var j=0; j<c.length; ++j) {
        if(k & (1<<j)) {
          b[l++] = c[j]
        }
      }
      result.push(b)
    }
  }
  return normalize(result)
}
exports.skeleton = skeleton;

//Computes the boundary of all cells, does not remove duplicates
function boundary(cells) {
  var res = []
  for(var i=0,il=cells.length; i<il; ++i) {
    var c = cells[i]
    for(var j=0,cl=c.length; j<cl; ++j) {
      var b = new Array(c.length-1)
      for(var k=0, l=0; k<cl; ++k) {
        if(k !== j) {
          b[l++] = c[k]
        }
      }
      res.push(b)
    }
  }
  return normalize(res)
}
exports.boundary = boundary;

//Computes connected components for a dense cell complex
function connectedComponents_dense(cells, vertex_count) {
  var labels = new UnionFind(vertex_count)
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i]
    for(var j=0; j<c.length; ++j) {
      for(var k=j+1; k<c.length; ++k) {
        labels.link(c[j], c[k])
      }
    }
  }
  var components = []
    , component_labels = labels.ranks
  for(var i=0; i<component_labels.length; ++i) {
    component_labels[i] = -1
  }
  for(var i=0; i<cells.length; ++i) {
    var l = labels.find(cells[i][0])
    if(component_labels[l] < 0) {
      component_labels[l] = components.length
      components.push([cells[i].slice(0)])
    } else {
      components[component_labels[l]].push(cells[i].slice(0))
    }
  }
  return components
}

//Computes connected components for a sparse graph
function connectedComponents_sparse(cells) {
  var vertices  = unique(normalize(skeleton(cells, 0)))
    , labels    = new UnionFind(vertices.length)
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i]
    for(var j=0; j<c.length; ++j) {
      var vj = findCell(vertices, [c[j]])
      for(var k=j+1; k<c.length; ++k) {
        labels.link(vj, findCell(vertices, [c[k]]))
      }
    }
  }
  var components        = []
    , component_labels  = labels.ranks
  for(var i=0; i<component_labels.length; ++i) {
    component_labels[i] = -1
  }
  for(var i=0; i<cells.length; ++i) {
    var l = labels.find(findCell(vertices, [cells[i][0]]));
    if(component_labels[l] < 0) {
      component_labels[l] = components.length
      components.push([cells[i].slice(0)])
    } else {
      components[component_labels[l]].push(cells[i].slice(0))
    }
  }
  return components
}

//Computes connected components for a cell complex
function connectedComponents(cells, vertex_count) {
  if(vertex_count) {
    return connectedComponents_dense(cells, vertex_count)
  }
  return connectedComponents_sparse(cells)
}
exports.connectedComponents = connectedComponents

},{"bit-twiddle":6,"union-find":21}],19:[function(require,module,exports){
"use strict"

module.exports = twoProduct

var SPLITTER = +(Math.pow(2, 27) + 1.0)

function twoProduct(a, b, result) {
  var x = a * b

  var c = SPLITTER * a
  var abig = c - a
  var ahi = c - abig
  var alo = a - ahi

  var d = SPLITTER * b
  var bbig = d - b
  var bhi = d - bbig
  var blo = b - bhi

  var err1 = x - (ahi * bhi)
  var err2 = err1 - (alo * bhi)
  var err3 = err2 - (ahi * blo)

  var y = alo * blo - err3

  if(result) {
    result[0] = y
    result[1] = x
    return result
  }

  return [ y, x ]
}
},{}],20:[function(require,module,exports){
"use strict"

module.exports = fastTwoSum

function fastTwoSum(a, b, result) {
	var x = a + b
	var bv = x - a
	var av = x - bv
	var br = b - bv
	var ar = a - av
	if(result) {
		result[0] = ar + br
		result[1] = x
		return result
	}
	return [ar+br, x]
}
},{}],21:[function(require,module,exports){
"use strict"; "use restrict";

module.exports = UnionFind;

function UnionFind(count) {
  this.roots = new Array(count);
  this.ranks = new Array(count);

  for(var i=0; i<count; ++i) {
    this.roots[i] = i;
    this.ranks[i] = 0;
  }
}

var proto = UnionFind.prototype

Object.defineProperty(proto, "length", {
  "get": function() {
    return this.roots.length
  }
})

proto.makeSet = function() {
  var n = this.roots.length;
  this.roots.push(n);
  this.ranks.push(0);
  return n;
}

proto.find = function(x) {
  var x0 = x
  var roots = this.roots;
  while(roots[x] !== x) {
    x = roots[x]
  }
  while(roots[x0] !== x) {
    var y = roots[x0]
    roots[x0] = x
    x0 = y
  }
  return x;
}

proto.link = function(x, y) {
  var xr = this.find(x)
    , yr = this.find(y);
  if(xr === yr) {
    return;
  }
  var ranks = this.ranks
    , roots = this.roots
    , xd    = ranks[xr]
    , yd    = ranks[yr];
  if(xd < yd) {
    roots[xr] = yr;
  } else if(yd < xd) {
    roots[yr] = xr;
  } else {
    roots[yr] = xr;
    ++ranks[xr];
  }
}
},{}],22:[function(require,module,exports){
const goatsheep = require('./lib/');

module.exports = goatsheep;
},{"./lib/":3}]},{},[22]);

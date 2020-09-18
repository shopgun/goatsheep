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
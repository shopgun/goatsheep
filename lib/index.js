const util = require('util');
const { sanitizeContours, generateContours, calculatePointsFromBounds } = require('./math');
const Analysis = require('./analysis');

function validateContour(contour) {
    if (!util.isArray(contour)) throw new Error('contour must be an array');
    for (let { x, y } of contour) {
        if (!util.isNumber(x) || !util.isNumber(y))
            throw new Error('contour must be an array of { x : Number, y : Number }');
    }
}

function validatePayload(payload) {
    if (payload == null) throw new Error('payload not defined');
    if (payload.contour == null && !util.isArray(payload.contours))
        throw new Error('payload must have a valid contour or contours field');
    for (let k of ['width', 'height', 'object_width', 'object_height'])
        if (!util.isNumber(payload[k])) throw new Error(`payload must have a valid numeric field ${k}`);
    if (payload.excluded_areas && !util.isArray(payload.excluded_areas))
        throw new Error('excluded_areas field must be an array');
    for (let area of payload.excluded_areas)
        for (let k of ['width', 'height', 'top', 'left'])
            if (!util.isNumber(area[k])) throw new Error(`excluded areas must have a valid numeric field ${k}`);
    if (payload.contour) {
        validateContour(payload.contour);
    } else {
        payload.contours.map(validateContour);
    }
}

class Goatsheep {
    constructor(payload) {
        this.init(payload);
    }

    init(payload) {
        validatePayload(payload);
        let contours = payload.contour ? [payload.contour] : payload.contours;
        sanitizeContours(contours);
        this.contours = generateContours(contours);
        for (let k of ['width', 'height'])
            this[k] = payload[k];
        if (payload.object_width) {
            this.objects = [{ width: payload.object_width, height: payload.object_height }];
        } else {
            this.objects = payload.objects.map((o) => { return { width: o.object_width, height: o.object_height }; });
        }
        this.exclude = payload.excluded_areas.map((area) => {
            area.points = calculatePointsFromBounds(area);
            return area;
        });
    }

    calculate() {
        this.analysis = new Analysis(this);
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
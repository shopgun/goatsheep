const util = require('util');
const { sanitizeContours, calculateCentroids } = require('./math');

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
        if (!util.isNumber(payload[k])) throw new Error('payload must have a valid numeric field ' + k);
    if (payload.excluded_areas && !util.isArray(payload.excluded_areas))
        throw new Error('excluded_areas field must be an array');
    for (let area of payload.excluded_areas)
        for (let k of ['width', 'height', 'top', 'left'])
            if (!util.isNumber(area[k])) throw new Error('excluded areas must have a valid numeric field ' + k);
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
        this.contours = payload.contour ? [payload.contour] : payload.contours;
        sanitizeContours(this.contours);
        this.centroids = calculateCentroids(this.contours);
        for (let k of ['width', 'height', 'object_width', 'object_height', 'excluded_areas'])
            this[k] = payload[k];
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
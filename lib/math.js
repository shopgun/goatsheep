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

function _getArea(contour) {
    const bs = new Array(contour.length - 1);
    for (let i = 0; i < contour.length - 1; i++)
        bs[i] = contour[i].x * contour[i + 1].y - contour[i + 1].x * contour[i].y;

    const area = 0.5 * bs.reduce((a, b) => a + b, 0);

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
    centroid = { x, y };
    clockwise = area < 0
    area = Math.abs(area);
    bounds = getBounds(contour);

    return { centroid, area, clockwise, bounds };
}

function generateContour(contour) {
    return new Contour(contour);
}

function generateContours(contours) {
    return contours.map(generateContour);
}

function getArea(points) {
    const { area } = _getArea(contour);

    return area;
}

class Contour {
    constructor(contour) {
        const { centroid, area, clockwise, bounds } = getContourProperties(contour);
        this.points = contour;
        this.centroid = centroid;
        this.area = area;
        this.clockwise = clockwise;
        this.bounds = bounds;
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
    // Expose classes
    Contour: Contour
};
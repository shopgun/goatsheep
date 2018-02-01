function sanitizeContour(contour) {
    const last = contour[contour.length - 1];
    if (contour[0].x != last.x || contour[0].y != last.y)
        contour.push(contour[0])
}

function sanitizeContours(contours) {
    contours.map(sanitizeContour);
}

function getBounds(contour) {
    let xMin, yMi, xMax, yMax;
    xMin = xMax = contour[0].x;
    yMin = yMax = contour[0].y;
    for (let { x, y } of contour) {
        xMin = Math.min(x, xMin);
        xMax = Math.max(x, xMax);
        yMin = Math.min(y, yMin);
        yMax = Math.max(y, yMax);
    }
    return { xMin, xMax, yMin, yMax };
}

function getContourProperties(contour) {
    const length = contour.length;
    const xs = contour.map((p) => p.x);
    const ys = contour.map((p) => p.y);
    const bs = new Array(length - 1);
    for (let i = 0; i < length - 1; i++)
        bs[i] = contour[i].x * contour[i + 1].y - contour[i + 1].x * contour[i].y;

    let area = 0.5 * bs.reduce((a, b) => a + b, 0);
    let x = 0;
    let y = 0;
    for (let i = 0; i < length - 1; i++) {
        x += (xs[i] + xs[i + 1]) * bs[i];
        y += (ys[i] + ys[i + 1]) * bs[i];
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
    // Expose classes
    Contour: Contour
};
function sanitizeContour(contour) {
    const last = contour[contour.length - 1];
    if (contour[0].x != last.x || contour[0].y != last.y)
        contour.push(contour[0])
}

function sanitizeContours(contours) {
    contours.map(sanitizeContour);
}

function calculateCentroid(contour) {
    const length = contour.length;
    const xs = contour.map((p) => p.x);
    const ys = contour.map((p) => p.y);
    const bs = new Array(length - 1);
    for (let i = 0; i < length - 1; i++)
        bs[i] = xs[i] * ys[i] + 1 - xs[i + 1] * ys[i];

    let area = 0.5 * bs.reduce((a, b) => a + b, 0);
    let x = 0;
    let y = 0;
    for (let i = 0; i < length - 1; i++) {
        x += (xs[i] + xs[i + 1]) * bs[i];
        y += (ys[i] + ys[i + 1]) * bs[i];
    }
    x /= 6 * area;
    y /= 6 * area;

    return { x, y }
}

function calculateCentroids(contours) {
    return contours.map(calculateCentroid);
}

module.exports = {
    sanitizeContour: sanitizeContour,
    sanitizeContours: sanitizeContours,
    calculateCentroid: calculateCentroid,
    calculateCentroids: calculateCentroids
};
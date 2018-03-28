const convexHull = require('convex-hull')
const intersect = require('@turf/intersect');
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
    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [polygon.points.map(({ x, y }) => [x, y])]
        }
    };
}

function rectRectOverlap(rectA, rectB) {
    return (rectA.left < rectB.left + rectB.width && rectA.left + rectA.width > rectB.left &&
        rectA.top < rectB.top + rectB.height && rectA.top + rectA.height > rectB.top);
}

// Return % of coverage over polygonA from polygonB
function intersectionPercentage(polygonA, polygonB) {
    let totalArea = polygonA.area ? polygonA.area : getArea(polygonA.points);
    let polyA = translatePolygon(polygonA);
    let polyB = translatePolygon(polygonB);
    let intersection;
    let intersectionArea = 0;

    try {
        intersection = intersect(polyA, polyB);
    } catch (e) {
        console.error('@turf/intersection threw an Error:');
        console.error(e);
        // TODO: Check exception, handle return value accordingly
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
                    intersectionArea += getPolygonArea(intersection.geometry)
                }
            }
        } else {
            console.error('Intersection geometry not supported: ' + type);
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
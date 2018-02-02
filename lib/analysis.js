const { calculatePointsFromBounds, getContourPoints } = require('./math');
const Critic = require('./critic');

class Analysis {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
        this.critic = new Critic(goatsheep);
        if (!this.calculateCells()) {
            // TODO: We reached the end of the tree, return
        }
        // Calculate metrics for each cell
        this.analyze();
    }

    analyze() {
        let cells = this.calculateCells();
        console.info('cells', cells);
        let solutions = cells.map((cell) => this.critic.critique(cell));
        console.info('cells', cells)
        console.info('solutions', solutions);
        solutions = this.critic.rank(solutions);
        console.info('nice solutions', solutions);
    }

    generateCellsForPoint(point) {
        let object = this.goatsheep.objects[0];
        let halfWidth = object.width / 2;
        let halfHeight = object.height / 2;
        let cells = [{
            top: point.y - halfHeight,
            left: point.x - halfWidth
        }, {
            top: point.y + halfHeight,
            left: point.x - halfWidth
        }, {
            top: point.y + halfHeight,
            left: point.x + halfWidth
        }, {
            top: point.y - halfHeight,
            left: point.x + halfWidth
        }];
        cells.forEach((c) => {
            c.centroid = point; 
            c.width = object.width;
            c.height = object.height;
            c.points = calculatePointsFromBounds(c);
        });
        // TODO: Move cells when they touch boundaries (or maybe do it after some filtering?)
        return cells;
    }

    calculateCells() {
        let points = getContourPoints(this.goatsheep.contours[0]);
        let cells = points.map(this.generateCellsForPoint.bind(this));
        cells = [].concat.apply([], cells);

        return cells;
    }
}

class Cell {
    constructor(point, goatsheep, object) {
        this.point = point;
        this.goatsheep = goatsheep;
        this.object = object;

        //this.points = calculatePointsFromBounds({ left, top, width, height });
        // TODO: Calculate intersections
        // TODO: Calculate (remaining) area
        // TODO: Calculate centroid of remaining area

    }
}

module.exports = Analysis;
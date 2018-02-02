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
        let solutions = cells.map((cell) => this.critic.critique(cell));
        console.info('cells', cells)
        console.info('solutions', solutions);
        solutions = this.critic.rank(solutions);
        console.info('nice solutions', solutions);
    }

    calculateCells() {
        let points = getContourPoints(this.goatsheep.contours[0]);
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
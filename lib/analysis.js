const { calculatePointsFromBounds, getContourPoints } = require('./math');
const Critic = require('./critic');

class Analysis {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
        this.critic = new Critic(goatsheep);
        this.solutions = goatsheep.objects.map(this.analyze.bind(this));
    }

    analyze(object) {
        let cells = this.calculateCells(object);
        let solution;
        let solutions = [];
        let bestSolution =  { score: 0, isFeasible: false };
        for (let i = 0; i < cells.length; i++) {
            solution = this.critic.critique(cells[i]);
            solutions.push(solution);
            bestSolution = solution.score > bestSolution.score ? solution : bestSolution;
            if (bestSolution.score > .6 + .3 * (1 - i  / cells.length)) break;
        }
        solutions = this.critic.rank(solutions);
        if (bestSolution.isFeasible)
            this.goatsheep.exclude.push(solutions[0].cell);

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

    fixCells(cells) {
        let offset = { x: 0, y: 0 };
        const { width, height } = this.goatsheep;
        const area = width * height;
        const object = this.goatsheep.objects[0];
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
        this.fixCells(cells);

        return cells;
    }
}

class Cell {
    constructor(point, goatsheep, object) {
        this.point = point;
        this.goatsheep = goatsheep;
        this.object = object;
    }
}

module.exports = Analysis;
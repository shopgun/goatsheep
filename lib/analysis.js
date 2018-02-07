const { calculatePointsFromBounds, getContourPoints } = require('./math');
const Critic = require('./critic');

class Analysis {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
        this.critic = new Critic(goatsheep);
        this.analyze();
    }

    analyze() {
        let cells = this.calculateCells();
        let solution;
        let solutions = [];
        let bestSolution =  { score: 0 };
        for (let i = 0; i < cells.length; i++) {
            solution = this.critic.critique(cells[i]);
            solutions.push(solution);
            bestSolution = solution.score > bestSolution.score ? solution : bestSolution;
            console.info(.7 + .3 * (1 - i  / cells.length));
            if (bestSolution.score > .7 + .2 * (1 - i  / cells.length)) {
                break;
            }
        }
        this.solution = bestSolution;
        //this.solutions = cells.map((cell) => this.critic.critique(cell));
        this.solutions = solutions;
        this.solutions = this.critic.rank(this.solutions);

        return this.solutions;
    }

    generateCellsForPoint(point) {
        let object = this.goatsheep.objects[0];
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

    calculateCells() {
        let points = getContourPoints(this.goatsheep.contours[0]);
        let cells = points.map(this.generateCellsForPoint.bind(this));
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
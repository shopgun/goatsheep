const { calculatePointsFromBounds } = require('./math');
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
        if (!cells) throw new Error('Not enough space for objects');    // Could not even fit the objects
        let solutions = cells.map((cell) => this.critic.critique(cell));
        console.info('cells', cells)
        console.info('solutions', solutions);
        solutions = this.critic.rank(solutions);
        console.info('nice solutions', solutions);
    }

    _analyze() {
        // TODO: Score cells        
    }

    calculateCells(parent) {
        // Container we are spliting
        const bounds = parent ? parent.bounds : { top: 0, left: 0, width: this.goatsheep.width, height: this.goatsheep.height };
        // Calculate cell size
        let sizeX = Math.max(...this.goatsheep.objects.map(o => o.width));
        let sizeY = Math.max(...this.goatsheep.objects.map(o => o.height));
        if (bounds.width <= sizeX || bounds.height <= sizeY) return false;              // No reason to split further
        let cellWidth = Math.max(sizeX, bounds.width / 2);                              // Cell width is half the cell size, or the size of the biggest object
        let cellHeight = sizeY * (cellWidth / sizeX);                                   // Cell height is calculated using the ratio of cell width to the biggest objects width
        cellHeight = Math.min(cellHeight, bounds.height);
        cellHeight = Math.max(cellHeight, bounds.height / 2);
        // Create cells
        const xPositions = [bounds.left, bounds.left + bounds.width - cellWidth];       // Might need 0 index here, not starting from left
        let yPositionCount = Math.ceil(bounds.height / cellHeight);
        let yPositions = (new Array(yPositionCount).fill(undefined)).map((_, i) => bounds.top + i * cellHeight);
        if (yPositions[yPositionCount - 1] + cellHeight > bounds.height) {
            yPositions[yPositionCount - 1] = bounds.height - cellHeight;
        }
        let cells = []
        for (let posX of xPositions) {
            for (let posY of yPositions) {
                cells.push(new Cell(posX, posY, cellWidth, cellHeight, this.goatsheep, this.parent));
            }
        }

        return cells;
    }
}

class Cell {
    constructor(left, top, width, height, goatsheep, parentCell = null) {
        this.top = top;
        this.left = left;
        this.width = width;
        this.height = height;
        this.goatsheep = goatsheep;
        this.points = calculatePointsFromBounds({ left, top, width, height });
        // TODO: Calculate intersections
        // TODO: Calculate (remaining) area
        if (parentCell) {
            // Intersect with parent cell area
        } else { }
        // TODO: Calculate centroid of remaining area

    }
}

module.exports = Analysis;
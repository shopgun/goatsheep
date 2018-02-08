const Solution = require('./solution');
const { intersectionPercentage, rectRectOverlap } = require('./math');

class Critic {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
    }

    critique(cell) {
        // TODO: Score cell given the goatsheep parameters
        let solution = new Solution(this.goatsheep, cell);
        // Factors:
        this.calculateMetrics(solution);

        return solution;
    }

    calculateMetrics(solution) {
        // Overlap with excluded areas
        const collisions = this.goatsheep.exclude.map((excludedArea) => rectRectOverlap(excludedArea, solution.cell));
        solution.excluded = this.goatsheep.exclude.length ? collisions.includes(true) : false;
        if (solution.excluded) return;
        // Cell free area vs cell area
        solution.freeArea = 1 - intersectionPercentage(solution.cell, this.goatsheep.contours[0]);
        // Distance to centroid
        solution.score = solution.freeArea;
    }

    rank(solutions) {
        // Rank given critiques
        return solutions.sort((a, b) => b.score - a.score);
    }
}

module.exports = Critic;
const Solution = require('./solution');
const { intersectionPercentage } = require('./math');

class Critic {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
    }

    critique(cell) {
        // TODO: Score cell given the goatsheep parameters
        let solution = new Solution(this.goatsheep, cell, Math.random());
        // Factors:
        this.calculateMetrics(solution);

        return solution;
    }

    calculateMetrics(solution) {
        // Cell free area vs cell area
        solution.freeArea = 1 - intersectionPercentage(solution.cell, this.goatsheep.contours[0]);
        // Distance to centroid
        // Overlap with restricted areas
        solution.score = solution.freeArea;
    }

    rank(solutions) {
        // Rank given critiques
        return solutions.sort((a, b) => b.score - a.score);
    }
}

module.exports = Critic;
Solution = require('./solution');

class Critic {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
    }

    critique(cell) {
        // TODO: Score cell given the goatsheep parameters
        return new Solution(this.goatsheep, cell, Math.random());
        // Factors:
        // Cell free area vs cell area
        // Cell area vs cell area (max 1)
        // Distance to centroid
        // Distance to restricted areas
    }

    rank(solutions) {
        // Rank given critiques
        solutions.sort((a, b) => a.score > b.score);
        // Pick _best_ ones
        const average = solutions.reduce((tot, s, i) => { return tot + s.score; }, 0) / solutions.length;
        console.info('average', average);
        return solutions.filter((s) => s.score >= average);
    }
}

module.exports = Critic;
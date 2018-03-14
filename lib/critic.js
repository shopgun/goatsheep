const { intersectionPercentage, rectRectOverlap, getRectCentroid } = require('./math');

class Critic {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
    }

    critiquePosition(cell) {
        let solution = new Solution(this.goatsheep, cell);
        this.calculatePositionScore(solution);

        return solution;
    }

    critique(solution) {
        return this.calculateTotalScore(solution);
    }

    getSolutionDistance(solutionA, solutionB) {
        // TODO: Rect/Rect distance
        const centroidA = getRectCentroid(solutionA.cell);
        const centroidB = getRectCentroid(solutionB.cell);
        const dist = Math.sqrt(Math.pow(centroidA.x - centroidB.x, 2) + Math.pow(centroidA.y - centroidB.y, 2));
        const maxDist = Math.sqrt(Math.pow(this.goatsheep.width, 2) + Math.pow(this.goatsheep.height, 2));
        return dist / maxDist;
    }

    calculatePositionScore(solution) {
        // Overlap with excluded areas
        const collisions = this.goatsheep.exclude.map((excludedArea) => rectRectOverlap(excludedArea, solution.cell));
        solution.excluded = this.goatsheep.exclude.length ? collisions.includes(true) : false;
        if (solution.excluded) return solution.positionScore = 0;
        // Distance to other objects
        let score = 1;
        if (this.goatsheep.solutions.length) {
            const distancesToOtherObjects = this.goatsheep.solutions.map(([solutionB]) => {
                return this.getSolutionDistance.bind(this)(solution, solutionB);
            });
            const distanceToObjects = Math.min.apply(null, distancesToOtherObjects);
            score = distanceToObjects;
        }
        const distanceFromBottom = (this.goatsheep.height - solution.cell.top - solution.cell.height) / this.goatsheep.height;
        score *= distanceFromBottom;

        return solution.positionScore = score;  // Apply to solution
    }

    calculateTotalScore(solution) {
        solution.freeArea = 1 - intersectionPercentage(solution.cell, this.goatsheep.contours[0]);
        return solution.score = 0.5 * (solution.positionScore + solution.freeArea);  // Apply to solution
    }

    rank(solutions) {
        // Rank given critiques
        return solutions.sort((a, b) => b.score - a.score);
    }

    rankPosition(solutions) {
        // Rank given position critiques
        return solutions.sort((a, b) => b.positionScore - a.positionScore);
    }
}

class Solution {
    constructor(goatship, cell) {
        this.goatship = goatship;
        this.cell = cell;
        this.excluded = true;
        this.freeArea = -1;
        this.score = 0;
    }
}

module.exports = Critic;
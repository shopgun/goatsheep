class Solution {
    constructor(goatship, cell, score) {
        this.goatship = goatship;
        this.cell = cell;
        this.score = score;
        this.exculded = true;
        this.freeArea = -1;
        this.score = 0;
    }
}

module.exports = Solution;
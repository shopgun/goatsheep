class Solution {
    constructor(goatship, cell) {
        this.goatship = goatship;
        this.cell = cell;
        this.exculded = true;
        this.freeArea = -1;
        this.score = 0;
    }
}

module.exports = Solution;
class Solution {
    constructor(goatship, cell) {
        this.goatship = goatship;
        this.cell = cell;
        this.excluded = true;
        this.freeArea = -1;
        this.score = 0;
    }
}

module.exports = Solution;
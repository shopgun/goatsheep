class Critic {
    constructor(goatsheep) {
        this.goatsheep = goatsheep;
    }

    critique(cell) {
        // TODO: Score cell given the goatsheep parameters
        return 0.4;
        // Factors:
        // Cell free area vs cell area
        // Cell area vs cell area (max 1)
        // Distance to centroid
        // Distance to restricted areas
    }

    rank(critiques) {
        // Rank given critiques
        // Should use this if we cannot give a definitive score, but only a relative score
    }
}

module.exports = Critic;
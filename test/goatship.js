/**
 * Goatsheep: Basic functionality
 * - Make sure all functions are exposed in module.exports
 * - Input validation
 */
const assert = require('assert');
const util = require('util');
const Goatsheep = require('../.');
const input = require('./data/input_a');
const inputB = require('./data/input_b');
const inputC = require('./data/input_c');

describe('Goatsheep', () => {
    describe('Exports', () => {
        it('should have all exports');
    });

    describe('Payload', () => {
        let goatsheep;
        it('should not throw for valid input', () => {
            goatsheep = new Goatsheep(input);
        });
        it('should give ok solutions', () => {
            const goatsheepB = new Goatsheep(inputB);
            assert(goatsheepB.solutions[0][0].score > 0.65, true);
            const goatsheepC = new Goatsheep(inputC);
            assert(goatsheepC.solutions[0][0].score > 0.65, true);
        });
    });
});
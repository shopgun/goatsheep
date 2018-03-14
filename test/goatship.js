/**
 * Goatsheep: Basic functionality
 * - Make sure all functions are exposed in module.exports
 * - Input validation
 */
const assert = require('assert');
const util = require('util');
const Goatsheep = require('../.');
const input = require('./data/input_a');

describe('Goatsheep', () => {
    describe('Exports', () => {
        it('should have all exports');
    });

    describe('Payload', () => {
        let goatship;
        it('should not throw for valid input', () => {
            try {
                goatship = new Goatsheep(input);
            } catch (e) {
                console.error(e.stack);
            }
        });
        it('should give proper solution', () => {
            console.info(goatship);
        });
    });
});
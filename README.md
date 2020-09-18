# Goatsheep

[![NPM version](https://img.shields.io/npm/v/goatsheep.svg?style=flat)](https://npmjs.org/package/goatsheep)
[![Build Status](https://travis-ci.org/shopgun/goatsheep.svg?branch=master)](https://travis-ci.org/shopgun/goatsheep?branch=master)

**Goatsheep** provides placement _Solutions_ of rectangles in a specified container with a foreground object such that they are visually pleasing.

_Please see the [example](#example) below and read [solution calculation](#calculation) to get a better understanding of the expected solutions._

## Install

```bash
npm install goatsheep --save
```

## Example

Given some canvas rectangle, the _contour/polygon_ of the _foreground/important_ object and some rectangle object that needs to be placed on the canvas, **Goatsheep** will provide a solution for placing the latter such that it overlaps the foreground object as little as possible.

Below, the _foreground_ object contour is green, the solutions for multiple objects in red:

![example](http://i.imgur.com/Exw63Be.gif)

## Execute

```js
const Goatsheep = require('goatsheep');

let goatsheep = new Goatsheep(payload);
```

## Input

**Goatsheep** accepts a single payload object:

```js
// Payload
{
    "debug": "boolean",     // Enable error logging
    "width": "number",      // Container width
    "height": "number",     // Container height
    "contours": "array",    // Contour(s) of foreground object(s)
    "objects": "array",     // Rect of objects to be placed
    "exclude": "array"      // Rect of areas where placing is prohibited
}

// Contours are arrays of coordinates
{
    "x": "number",
    "y": "number"
}

// Objects are arrays of rectangles
{
    "width": "number",
    "height": "number"
}

// Excluded areas are arrays of rectangles in space
{
    "top": "number",
    "left": "number",
    "width": "number",
    "height": "number"
}
```

_For an example payload see [here](test/data/input_a.json)_

## Validation

You may want to pre-validate input before feeding it to **Goatsheep** as invalid input **will throw** when fed into **Goatsheep**.

```js
const { validate } = require('goatsheep');

let validation = validate(payload);

if (validation !== true) {
    // validation is an Error
    console.error(validation);
}
```

## Output

The **Goatsheep** object contains a lot of information, but most importantly an array with the solutions for each object.

Get the solution for the _first_ object

```js
// Best solution for i-th object (payload.objects[i])
let solution = goatsheep.solutions[i][0];

// _Important_ fields of solution:
{
    cell: {
        left: "number",
        top: "number"
    },
    score: "number"         // [0-1] 1 being best case
    excluded: "boolean"     // true if solution overlaps excluded areas, handle accordingly
}
```

## Solutions

**Solutions** are basically 2D vectors, noting the coordinates where the objects could be placed. Goatsheep may calculate _many_ solutions (see below), which are ranked by score, the first one being the best scoring.

_Note that given restrictions, Goatsheep may fail to produce any solutions, a case for which the consumer should account for._

## Calculation

**Goatsheep** serves a very specific design problem, where we have a container, some foreground objects and some other objects we want to place on the container with the following rules in mind:

1. Overlap the foreground object as little as possible
2. Be close to the contour of the foreground object
3. Do **not** overlap with the excluded areas
4. Objects placed should overlap with each other as little as possible

## Quality vs Speed

To follow the rules above, calculating intersections of polygon/rectangle have to be done, which can be heavy operations, especially in NodeJS. Thus, to provide some speed while maintaining quality, *Goatsheep* takes a few steps:

1. Create a pool of possible solutions
2. Rank solutions using low cost heuristics
3. Starting from the high-ranking possible solutions do heavy calculations
4. Stop when the _score_ of a solution passes a certain, acceptable, threshold
5. Gradually lower the threshold, basically lowering the standards when taking too long to calculate.

**Goatsheep** will not always yield the best solutions, but is guaranteed to give a good enough solution, if possible.

## License

MIT

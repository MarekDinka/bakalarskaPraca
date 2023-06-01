const {processText, getRandomInt, Queue} = require("./crosswordBase");

class WordSpace {
    constructor(X, Y, word, hor, positionMap, secretWord = false) {
        this.positionMap = positionMap;
        this.horizontal = hor;
        this.cells = [];
        this.word = word;
        let cellX, cellY;
        for (let i = 0; i < word.length; i++) {
            cellX = (this.horizontal) ? X+i : X;
            cellY = (this.horizontal) ? Y : Y+i;
            if (this.positionMap.has(cellX) && this.positionMap.get(cellX).has(cellY)) {
                this.cells.push(this.positionMap.get(cellX).get(cellY));
            } else {
                this.cells.push(new Cell(cellX, cellY, this.word[i], positionMap, secretWord));
            }
        }
    }

    //detect:
    // hallo
    //  b

    //  b
    // hallo

    // h
    // a
    // lb
    // l
    // o

    // h
    // a
    //bl
    // l
    // o
    isInsertable() {
        for (let cell of this.cells) {
            for (let p of cell.neighbors.get((this.horizontal) ? 'Y' : 'X')) {
                let [dist, neighbor] = p;
                if (dist === -1 || dist === 1) {
                    let foundCommonWordspace = false;
                    for (let ws of neighbor.wordspaces) {
                        if (cell.wordspaces.has(ws)) {
                            foundCommonWordspace = true;
                            break;
                        }
                    }
                    if (!foundCommonWordspace) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    insertWord() {
        this.cells.forEach((cell, i) => {
            if (!(this.positionMap.has(cell.X) && this.positionMap.get(cell.X).has(cell.Y))) {
                if (!this.positionMap.has(cell.X)) {
                    this.positionMap.set(cell.X, new Map());
                }
                this.positionMap.get(cell.X).set(cell.Y, cell);
                cell.char = this.word[i];
            }
            cell.wordspaces.add(this);
            cell.construct(this.positionMap);
        });
    }

    removeWord() {
        this.cells.forEach((cell) => {
            cell.wordspaces.delete(this);
            if (cell.wordspaces.size == 0) {
                this.positionMap.get(cell.X).delete(cell.Y);
                if (this.positionMap.get(cell.X).size == 0) {
                    this.positionMap.delete(cell.X);
                }
                cell.destruct();
            }
        });
    }

    evaluate() { //Value is based on wordspaces proximity to point 0 0 -> the bigger the worse
        const middleCell = this.cells[Math.floor(this.cells.length/2)];
        return middleCell.X*middleCell.X + middleCell.Y*middleCell.Y;
    }
}

class Cell {
    constructor(x, y, c, positionMap) {
        this.X = x;
        this.Y = y;
        this.char = c;
        this.wordspaces = new Set();
        this.neighbors = new Map([['X', new Map()], ['Y', new Map()]]); //neighbors will be represented as distance on the Y or X axis from this cell
        if (positionMap.has(this.X)) {
            positionMap.get(this.X).forEach((cell) => {
                if (cell.Y-this.Y !== 0) {
                    this.neighbors.get('Y').set(cell.Y-this.Y, cell);
                }
            });
        }
        positionMap.forEach((YMap) => {
            let cell = YMap.get(this.Y);
            if (typeof cell !== 'undefined') {
                if (cell.X-this.X !== 0) {
                    this.neighbors.get('X').set(cell.X-this.X, cell);
                }
            }
        });
    }

    destruct() {
        this.neighbors.forEach((coordMap, coord) => {
            coordMap.forEach((cell, position) => {
                cell.removeNeighbor(coord, (coord === 'X' ? this.X-cell.X : this.Y-cell.Y)); //this is my position not his
            });
        });
    }

    construct(positionMap) {
        this.neighbors = new Map([['X', new Map()], ['Y', new Map()]]);
        positionMap.get(this.X).forEach((cell) => {
            if (cell.Y-this.Y !== 0) {
                this.neighbors.get('Y').set(cell.Y-this.Y, cell);
                cell.addNeighbor('Y', this.Y-cell.Y, this);
            }
        });
        positionMap.forEach((YMap) => {
            let cell = YMap.get(this.Y);
            if (typeof cell !== 'undefined') {
                if (cell.X-this.X !== 0) {
                    this.neighbors.get('X').set(cell.X-this.X, cell);
                    cell.addNeighbor('X', this.X-cell.X, this);
                }
            }
        });
    }

    addNeighbor(coord, position, cell) {
        this.neighbors.get(coord).set(position, cell);
    }

    removeNeighbor(coord, position) {
        this.neighbors.get(coord).delete(position);
    }
}

class unfullCrosswordGenerator {
    constructor(words, maxWordCount, callback, err) {
        this.words = words;
        this.firstWordCandidates = words.slice();
        this.firstWordCandidates.sort((a, b) => {return b.length - a.length;});
        this.maxWordCount = maxWordCount;
        this.callback = callback;
        this.err = err;

        this.generateSearchStructure(words); //Map[word char][word char index]
    }

    generateNext() {
        if (this.firstWordCandidates.length === 0) {return false;}
        let max = (this.firstWordCandidates.length < 15) ? this.firstWordCandidates.length : 15;
        let firstWord = this.firstWordCandidates.splice(getRandomInt(0, max), 1)[0];

        let res = this.generateCrossword(this.words, this.maxWordCount, firstWord);
        if (res === false) {
            if (!this.generateNext()) {
                this.err("Nastala neznáma chyba a takáto krížovka sa nedá vygenerovať");
                return false;
            }
            return true
        }
        let crosswordSolution = res.map;
        let wordsAndPositions = res.words;

        let maxX = Number.NEGATIVE_INFINITY, minX = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY, minY = Number.POSITIVE_INFINITY;

        crosswordSolution.forEach((YMap, X) => {
            if (X > maxX) {
                maxX = X;
            }
            if (X < minX) {
                minX = X;
            }
            YMap.forEach((_, Y) => {
                if (Y > maxY) {
                    maxY = Y;
                }
                if (Y < minY) {
                    minY = Y;
                }
            });
        });

        let crossword = Array.apply(null, Array(maxY-minY+1)).map(() => {return Array.apply(null, Array(maxX-minX+1)).map(() => {return '_';});});
        crosswordSolution.forEach((YMap, X) => {
            YMap.forEach((cell, Y) => {
                crossword[Y-minY][X-minX] = cell.char;
            });
        });
        wordsAndPositions.forEach((w) => {w.X -= minX; w.Y -= minY;});
        this.callback({crossword: crossword, secret: [], words: wordsAndPositions});
        return true;
    }

    generateCandidates(ws, positionMap, usedWords) {
        let candidates = [];
        for (let i = 0; i < ws.cells.length; i++) {
            if (ws.cells[i].wordspaces.size > 1 || //if this cell has 2 crossing words already
                (i > 0 && ws.cells[i-1].wordspaces.size > 1) || //or the next one
                (i < ws.cells.length-1 && ws.cells[i+1].wordspaces.size > 1)) { //or previous one
                    continue;
            }
            let cell = ws.cells[i];
            if (this.searchStructure.has(cell.char)) {
                this.searchStructure.get(cell.char).forEach((wordSet, charIndex) => {
                    wordSet.forEach((word) => {
                        if (usedWords.has(word)) {return;}
                        let newWsX = (ws.horizontal) ? cell.X : cell.X - charIndex;
                        let newWsY = (ws.horizontal) ? cell.Y - charIndex : cell.Y;
                        let isTheWordGood = true;

                        cell.neighbors.get((ws.horizontal) ? 'Y' : 'X').forEach((neighbor, dist) => {
                            if (!isTheWordGood ||
                                 charIndex+dist < -1 || charIndex+dist > word.length) { //ignore neighbors that are too far away
                                return;
                            }
                            if (neighbor.wordspaces.size > 1 || 
                                 (neighbor.wordspaces.size === 1 && Array.from(neighbor.wordspaces)[0].horizontal === !ws.horizontal) ||
                                 charIndex+dist == -1 || charIndex+dist == word.length || //we want to also prevent 2 bordering words
                                 neighbor.char != word[charIndex+dist]) {
                                isTheWordGood = false;
                            }
                        });

                        if (!isTheWordGood) {
                            return;
                        }
                        let newWs = new WordSpace(newWsX, newWsY, word, !ws.horizontal, positionMap);
                        if (newWs.isInsertable()) {
                            candidates.push(newWs);
                        }
                    });
                });
            }
        }
        return candidates;
    }

    generateCrossword(words, maxWordCount, firstWord) {
        if (maxWordCount === '') {maxWordCount = 10;}

        let usedWords = new Set();
        let positionMap = new Map(); //Map[X][Y] = cell -> X and Y can be negative -> position is in relation to point 0 0

        let rek = (wordspaces) => {
            let candidates = [];
            for (const ws of wordspaces) {
                if (candidates.length >= 50) {break;}
                for (const cand of this.generateCandidates(ws, positionMap, usedWords)) {
                    candidates.push(cand);
                }
            }

            candidates.sort((a, b) => {return a.evaluate() - b.evaluate();});
            if (candidates.length == 0) {
                return false;
            }
            for (let newWs of candidates) {
                newWs.insertWord();
                usedWords.add(newWs.word);
                let indexOfNewWs = wordspaces.length;
                for (let i = 0; i < wordspaces.length; i++) {
                    if (wordspaces[i].evaluate() > newWs.evaluate()) {
                        indexOfNewWs = i;
                        break;
                    }
                }
                wordspaces.splice(indexOfNewWs, 0, newWs);
                if (wordspaces.length >= maxWordCount || usedWords.size >= words.length || rek(wordspaces)) {
                    return true;
                }
                usedWords.delete(newWs.word);
                wordspaces.splice(wordspaces.indexOf(newWs), 1);
                newWs.removeWord();
            }
            return false;
        };

        const wordsets = [];

        if (firstWord === "") {
            for (let w of words) {
                let ws = new WordSpace(-Math.floor(w.length/2), 0, w, true, positionMap, true);
                ws.insertWord();
                usedWords.add(w);
                wordsets.push(ws);
                if (rek(wordsets)) {
                    return {map: positionMap, words: wordsets.map((ws) => {return {word: ws.word, X: ws.cells[0].X, Y: ws.cells[0].Y, size: ws.cells.length, horizontal: ws.horizontal};})};
                }
                wordsets.splice(wordsets.indexOf(ws), 1);
                usedWords.delete(w);
                ws.removeWord();
            }
        } else {
            let ws = new WordSpace(-Math.floor(firstWord.length/2), 0, firstWord, true, positionMap, true);
                ws.insertWord();
                usedWords.add(firstWord);
                wordsets.push(ws);
                if (rek(wordsets)) {
                    return {map: positionMap, words: wordsets.map((ws) => {return {word: ws.word, X: ws.cells[0].X, Y: ws.cells[0].Y, size: ws.cells.length, horizontal: ws.horizontal};})};
                }
                wordsets.splice(wordsets.indexOf(ws), 1);
                usedWords.delete(firstWord);
                ws.removeWord();
        }
        return false;
    }

    generateSearchStructure(words) {
        this.searchStructure = new Map();
        words.forEach((word) => {
            for (let i = 0; i < word.length; i++) {
                if (!this.searchStructure.has(word[i])) {
                    this.searchStructure.set(word[i], new Map());
                }
                let charMap = this.searchStructure.get(word[i]);
                if (!charMap.has(i)) {
                    charMap.set(i, new Set());
                }
                charMap.get(i).add(word);
            }
        });
    }
}

module.exports = {generate: (words, numberOfWords, callback, err) => {
    return new unfullCrosswordGenerator(words, numberOfWords, callback, err);
}};
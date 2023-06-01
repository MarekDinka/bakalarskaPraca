class Cell {
    constructor(x, y, c, positionMap, secret = false) {
        this.X = x;
        this.Y = y;
        this.char = c;
        this.secret = secret;
        this.pm = positionMap;
        if (!this.pm.has(this.X)) {
            this.pm.set(this.X, new Map());
        }
        this.pm.get(this.X).set(this.Y, this);
    }

    addCrossingWord(word) {
        let X;
        for (let i = 0; i < word.length; i++) {
            if (word[i] === this.char) {
                for (let x = 0; x < word.length; x++) {
                    X = x-i;
                    if (X !== 0) {
                        new Cell(X, this.Y, word[x], this.pm);
                    }
                }
                return;
            }
        }
    }

    removeCrossingWord() {
        this.pm.forEach((_, X) => {
            if (X !== this.X) {
                this.pm.get(X).delete(this.Y);
                if (this.pm.get(X).size === 0) {
                    this.pm.delete(X);
                }
            }
        });
    }
}

class HrebenovkaGenerator {

    constructor(words, secrets, callback, err) {
        this.secrets = secrets;
        this.callback = callback;
        this.err = err;

        this.generateSearchStructure(words); //Map[word char]
    } // {word: string, X: int, Y: int, size: int, horizontal: bool}

    generateNext() {
        if (this.secrets.length == 0) {return false;} 
        let secret = this.secrets.pop()

        let crosswordSolution = this.generateCrossword(secret);
        if (crosswordSolution === false) {
            if (!this.generateNext()) {
                this.err("Krížovka sa s takouto tajničkou nedá vygenerovať.");
                return false;
            }
            return true;
        }

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

        let secretCells = [];
        let crossword = Array.apply(null, Array(maxY-minY+1)).map(() => {return Array.apply(null, Array(maxX-minX+1)).map(() => {return '_';});});
        crosswordSolution.forEach((YMap, X) => {
            YMap.forEach((cell, Y) => {
                crossword[Y-minY][X-minX] = cell.char;
                if (cell.secret) {
                    secretCells.push({x: X-minX, y: Y-minY})
                }
            });
        });

        let wordsAndPositions = [];
        crossword.forEach((Xs, Y) => {
            let word = {word: "", X: null, Y: Y, size: 0, horizontal: true};
            Xs.forEach((char, X) => {
                if (char !== '_') {
                    if (word.X === null) {word.X = X;}
                    word.word += char;
                    word.size++;
                }
            });
            wordsAndPositions.push(word);
        });

        this.callback({crossword: crossword, secret: secretCells, words: wordsAndPositions});
        return true;
    }

    generateCrossword(secret) {
        const TRUE = 0, CANNOT_FIND_GOOD_WORD = -1, NO_WORDS_WITH_SUCH_CHAR_AVAILABLE = -2;
        let usedWords = new Set();
        usedWords.add(secret);
        let positionMap = new Map(); //Map[X][Y] = cell -> X and Y can be negative -> position is in relation to point 0 0
        let cells = null;
        let c;
        for (let i = 0; i < secret.length; i++) {
            if (cells === null) {
                cells = new Cell(0, i, secret[i], positionMap, true);
                c = cells;
            } else {
                c.next = new Cell(0, i, secret[i], positionMap, true);
                c = c.next;
            }
        }

        const rek = (cell) => {
            if (typeof cell === 'undefined' || cell === null) {return TRUE;}
            if (!this.searchStructure.has(cell.char)) {return NO_WORDS_WITH_SUCH_CHAR_AVAILABLE;}
            let candidates = [];
            for (const word of this.searchStructure.get(cell.char)) {
                if (!usedWords.has(word)) {
                    candidates.push(word);
                }
            }
            if (typeof candidates === 'undefined' || candidates.length == 0) {
                return NO_WORDS_WITH_SUCH_CHAR_AVAILABLE;
            }

            for (const word of candidates) {
                cell.addCrossingWord(word);
                usedWords.add(word);
                const res = rek(cell.next);
                if (res === TRUE) {
                    return TRUE;
                } else if (res === NO_WORDS_WITH_SUCH_CHAR_AVAILABLE) {
                    return NO_WORDS_WITH_SUCH_CHAR_AVAILABLE;
                }
                cell.removeCrossingWord();
                usedWords.delete(word);
            }
            return CANNOT_FIND_GOOD_WORD;
        };

        if (rek(cells) === TRUE) {
            return positionMap;
        }
        return false;
    }

    generateSearchStructure(words) {
        this.searchStructure = new Map();
        words.forEach((word) => {
            for (let i = 0; i < word.length; i++) {
                if (!this.searchStructure.has(word[i])) {
                    this.searchStructure.set(word[i], new Set());
                }
                this.searchStructure.get(word[i]).add(word);
            }
        });
    }
}

module.exports = {generate: (words, secrets, callback, err) => {
    return new HrebenovkaGenerator(words, secrets, callback, err);
}};
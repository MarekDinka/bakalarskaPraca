const {processText, getRandomInt, Queue} = require("./crosswordBase");

class WordSpace {
    constructor(cells, horizontal, searchStructure) {
        this.cells = cells;
        this.cellsInserted = [];
        this.word = null;
        this.horizontal = horizontal;

        this.cells.forEach((cell) => {
            cell.wordspaces.push(this);
        });

        searchStructure.get(this.cells.length).forEach((charMap, index) => {
            charMap.forEach((words, char) => {
                words.forEach((word) => {
                    this.cells[index].addWord(this.horizontal, word, char);
                });
            });
        });
    }

    populate(crossword) {
        for (const cell of this.cells) {
            crossword[cell.Y][cell.X] = cell.char;
        }
    }

    getWords() {
        if (this.word !== null) {
            return new Set([this.word]);
        }
        let res = null;
        for (const cell of this.cells) {
            if (res === null) {
                res = cell.getWords(this.horizontal);
            } else {
                res = new Set([...cell.getWords(this.horizontal)].filter(w => res.has(w)));
            }
        }
        return res;
    }

    evaluate() {
        if (!this.isEmpty()) {
            return Number.POSITIVE_INFINITY;
        }
        return this.getWords().size;
    }

    /**
     * @param {string} word 
     * @returns false if word could not be inserted or queue of new empty wordspaces
     */
    insertWord(word) {
        this.cellsInserted = [];
        let emptyWordspaces = null
        for (let i = 0; i < word.length; i++) {
            if (this.cells[i].char === null) {
                this.cellsInserted.push(this.cells[i]);
            }
            let res = this.cells[i].insertChar(word[i], this.horizontal);
            if (res === false) {
                for (const cell of this.cellsInserted) {
                    cell.removeChar();
                }
                return false;
            }
            if (res !== null) {
                if (emptyWordspaces === null) {
                    emptyWordspaces = new Queue(res);
                } else {
                    emptyWordspaces.add(res);
                }
            }
        }
        this.word = word;
        return emptyWordspaces;
    }

    removeWord() {
        for (const cell of this.cellsInserted) {
            cell.removeChar();
        }
        let w = this.word;
        this.word = null;
        this.cellsInserted = [];
        return w;
    }

    isEmpty() {
        return this.word === null;
    }
}

class Cell {
    constructor(y, x) {
        this.Y = y;
        this.X = x;
        this.wordspaces = [];
        this.char = null;
        this.possibleWords = new Map([['H', new Map()], ['V', new Map()]]);
        this.allWords = new Map([['H', new Set()], ['V', new Set()]]);
    }

    addWord(horizontal, word, char) {
        let alignment = (horizontal) ? 'H' : 'V';
        if (!this.possibleWords.get(alignment).has(char)) {
            this.possibleWords.get(alignment).set(char, new Set());
        }
        this.possibleWords.get(alignment).get(char).add(word);
        this.allWords.get(alignment).add(word);
    }

    getWords(horizontal) {
        let alignment = (horizontal) ? 'H' : 'V';
        if (this.char === null) {
            return this.allWords.get(alignment);
        }
        return this.possibleWords.get(alignment).get(this.char);
    }

    /**
     * @param {string} char 
     * @param {boolean} horizontal 
     * @returns false if inserting this char would mean that no words could be inserted into wordspace at right angle, else returns unfilled wordspace or null
     */
    insertChar(char, horizontal) {
        if (this.wordspaces.length == 2 && !this.possibleWords.get((horizontal) ? 'V' : 'H').has(char)) {return false;} //if wordspace at the right angle to this one cannot have this char
        this.char = char;
        if (this.wordspaces.length < 2) {
            return null;
        }
        for (const ws of this.wordspaces) {
            if (ws.horizontal == !horizontal) {
                if (ws.getWords().size > 0) {
                    return (ws.isEmpty()) ? ws : null;
                }
                this.char = null;
                return false;
            }
        }
        return false;
    }

    removeChar() {
        this.char = null;
    }
}

class FullCrosswordGenerator {
    searchStructure;

    constructor(words, template, callback, err, maxNumberOfCrosswordsToGenerate) {
        this.words = words
        this.template = template;
        this.callback = callback;
        this.err = err;
        this.generatedCrosswords = [];
        this.maxGeneratedCrosswords = maxNumberOfCrosswordsToGenerate;
        this.generate();
    }

    generateNext() {
        if (this.generatedCrosswords.length > 0) {
            this.callback(this.generatedCrosswords.pop());
            return true;
        }
        return false;
    }

    generate() {
        this.generateSearchStructureAndEvaluateWords(this.words);

        let crossword = [];

        this.template.forEach((arr, y) => {
            crossword.push([]);
            arr.forEach((val, x) => {
                crossword[y].push((val === '_') ? null : new Cell(y, x));
            });
        });
        let wordspaces = [];
        let newCells = null;
        let firstWordSpace = null;
        for (let i = 0; i < crossword.length; i++) {
            for (let j = 0; j < crossword[i].length; j++) {
                if (crossword[i][j] === null || j === crossword[i].length-1) {
                    if (newCells != null) {
                        if (j === crossword[i].length-1 && crossword[i][j] !== null) {
                            newCells.push(crossword[i][j]); 
                        }
                        if (newCells.length > 1) {
                            let newWs = new WordSpace(newCells, true, this.searchStructure);
                            wordspaces.push(newWs);
                            if (firstWordSpace === null || newWs.cells.length > firstWordSpace.cells.length) {
                                firstWordSpace = newWs;
                            }
                        }
                        newCells = null;
                    }
                } else {
                    if (newCells === null) {
                        newCells = [];
                    }
                    newCells.push(crossword[i][j]);
                }
            }
        }

        for (let j = 0; j < crossword[0].length; j++) {
            for (let i = 0; i < crossword.length; i++) {
                if (crossword[i][j] === null || i === crossword.length-1) {
                    if (newCells !== null) {
                        if (i === crossword.length-1 && crossword[i][j] !== null) {
                            newCells.push(crossword[i][j]);
                        }
                        if (newCells.length > 1) {
                            let newWs = new WordSpace(newCells, false, this.searchStructure);
                            wordspaces.push(newWs);
                            if (firstWordSpace === null || newWs.cells.length > firstWordSpace.cells.length) {
                                firstWordSpace = newWs;
                            }
                        }
                        newCells = null;
                    }
                } else {
                    if (newCells === null) {
                        newCells = [];
                    }
                    newCells.push(crossword[i][j]);
                }
            }
        }

        if (!this.generateCrossword(firstWordSpace, wordspaces)) {
            this.err("Krížovka s takýmto dizajnom sa z vybraných slov nedá vygenerovať!");
            return;
        }
    }

    /**
     * @param {WordSpace} firstWordSpace 
     * @param {[WordSpace]} wordspaces 
     * @returns 
     */
    generateCrossword(firstWordSpace, wordspaces) {
        let usedWords = new Set();

        /**
         * @param {WordSpace} ws
         * @param {string} word
         */
        let rek = (ws, word) => {
            if (this.generatedCrosswords.length >= this.maxGeneratedCrosswords) {return false;}
            if (!ws.isEmpty()) {return true;}
            if (usedWords.has(word)) {return false;}
            if (ws.insertWord(word) === false) {
                return false;
            }
            usedWords.add(word);
            wordspaces.sort((a, b) => {return a.evaluate()-b.evaluate();});
            if (wordspaces.length > 0) {
                let w = wordspaces[0];
                if (w.evaluate() == Number.POSITIVE_INFINITY) { // A crossword has been generated
                    let template = [];
                    for (let row of this.template) {
                        let rowCopy = [];
                        for (let char of row) {
                            rowCopy.push(char);
                        }
                        template.push(rowCopy);
                    }
                    for (let ws of wordspaces) {
                        ws.populate(template);
                    }
                    let wordsAndPositions = wordspaces.map((ws) => {return {word: ws.word, X: ws.cells[0].X, Y: ws.cells[0].Y, size: ws.cells.length, horizontal: ws.horizontal};});
                    this.generatedCrosswords.push({crossword: template, secret: [], words: wordsAndPositions});
                    usedWords.delete(ws.removeWord());
                    return false;
                }
                if (!w.isEmpty()) {
                    return true;
                }
                let words = Array.from(w.getWords());
                if (words.length === 0) {
                    usedWords.delete(ws.removeWord());
                    return false;
                }
                words.sort((a, b) => {return this.wordValueStructure.get(a)-this.wordValueStructure.get(b);})
                for (const word of words) {
                    if (this.generatedCrosswords.length >= this.maxGeneratedCrosswords) {return false;}
                    if (rek(w, word)) {
                        return true;
                    }
                }
                usedWords.delete(ws.removeWord());
                return false;
            }
            return true;
        };

        for (let w of firstWordSpace.getWords()) {
            rek(firstWordSpace, w)
        }
        if (this.generatedCrosswords.length > 0) {return true;}
        return false
    }

    generateSearchStructureAndEvaluateWords(words) {
        this.wordValueStructure = new Map();
        this.searchStructure = new Map();
        const letterFrequencyMap = new Map();
        words.forEach((word) => {
            for (const letter of word) {
                if (!letterFrequencyMap.has(letter)) {
                    letterFrequencyMap.set(letter, {count: 0});
                }
                letterFrequencyMap.get(letter).count++;
            }
            if (!this.searchStructure.has(word.length)) {
                this.searchStructure.set(word.length, new Map());
            }
            let lenMap = this.searchStructure.get(word.length);
            for (let i = 0; i < word.length; i++) {
                if (!lenMap.has(i)) {
                    lenMap.set(i, new Map());
                }
                let letterIndexMap = lenMap.get(i);
                if (!letterIndexMap.has(word[i])) {
                    letterIndexMap.set(word[i], new Set());
                }
                letterIndexMap.get(word[i]).add(word);
            }
        });
        words.forEach((word) => {
            let value = 0;
            for (const letter of word) {
                value += letterFrequencyMap.get(letter).count;
            };
            this.wordValueStructure.set(word, value);
        });
    }
}

module.exports = {generate: (words, template, callback, err, maxNumberOfCrosswordsToGenerate) => {
    return new FullCrosswordGenerator(words, template, callback, err, maxNumberOfCrosswordsToGenerate);
}};
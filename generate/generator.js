const F = require('./fullCrosswordGenerator');
const U = require('./unfullCrosswordGenerator');
const H = require('./hrebenovkaGenerator');

function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }  
    return array;
}

module.exports = {generate:
    // config = {
    //     id: int, -> 0 if it is a new config or config id from database
    //     words: [json], -> all words in form of {word: string, selected: bool, secret: bool}
    //     definitions: Map<"word", [{definition: string, selected: bool}]>,
    //     type: 'U', 'F', 'H'
    //     ...additional small settings -> see www/config/config.js
    // }
    function generate(config, callback, err, template = null) {
        let secrets = config.newSecrets.slice();
        let words = config.words.filter((w) => {
            if (w.secret) {secrets.push(w.word);}
            return w.selected && (!w.secret || config.type != 'H');
        }).map((w) => w.word);
        shuffle(secrets);
        switch(config.type) {
            case 'F':
                let crosswordTemplate = [];
                template.forEach((row) => {
                    crosswordTemplate.push([]);
                    row.forEach((cell) => {
                        crosswordTemplate[crosswordTemplate.length-1].push((cell.letterCell) ? '' : '_');
                    });
                });
                return F.generate(words, crosswordTemplate, callback, err, 5);
            case 'U':
                return U.generate(words, config.numberOfWordsToUse, callback, err);
            case 'H':
                return H.generate(words, secrets, callback, err);
        }
        return null;
    }
}
const express = require('express');
const fs = require('fs');
const app = express ();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
    maxHttpBufferSize: 1e8, pingTimeout: 60000
});
const database = require('./dbCommunicator');
const db = new database.db();
const processText = require('./generate/crosswordBase').processText;
const generator = require('./generate/generator');

process.once('SIGUSR2', function () {process.kill(process.pid, 'SIGUSR2');});
process.on('SIGINT', function () {process.kill(process.pid, 'SIGINT');});

app.use('/', express.static('www'));

const PORT = 9000;

server.listen (PORT, () => {
  console.log (`Listen on port ${PORT}`);
});

function generate(config, socket) {
    const cannotGenerate = (msg) => {
        socket.emit("crossword::cannotBeGenerated", msg);
    }
    if (config.words.length === 0 || config.definitions.length === 0) {cannotGenerate("Krížovka sa z vybraných slov nedá vygenerovať!")}

    let generatorInstance = null;

    if (config.type === 'F') {
        db.getTemplateById(config.templateId, (template) => {
            generatorInstance = generator.generate(config, (crossword) => {
                crossword.crossword.forEach((row, y) => {
                    row.forEach((char, x) => {
                        let cell = template.template[y][x];
                        crossword.crossword[y][x] = {hidden: cell.hidden, color: cell.color, letterCell: cell.letterCell, char: char};
                    });
                });
                crossword.backgroundImage = template.backgroundImage;
                crossword.backgroundColor = template.backgroundColor;
                crossword.horBubbleColor = config.horBubbleColor;
                crossword.verBubbleColor = config.verBubbleColor;
                crossword.diacriticAutofill = config.diacriticAutofill;
                db.insertCrossword(config, crossword, (crosswordId) => {
                    if (socket.connected) {
                        socket.emit("crossword::redirect", `/display/display.html?id=${crosswordId}`);
                    }
                });
            }, cannotGenerate, template.template);

            generatorInstance.generateNext();
        });
    } else {
        generatorInstance = generator.generate(config, (crossword) => {
            crossword.crossword.forEach((row, y) => {
                row.forEach((char, x) => {
                    crossword.crossword[y][x] = {hidden: char === '_', color: "#FFFFFF", letterCell: char !== '_', char: char};
                });
            });
            crossword.backgroundImage = null;
            crossword.backgroundColor = null;
            crossword.horBubbleColor = config.horBubbleColor;
            crossword.verBubbleColor = config.verBubbleColor;
            crossword.diacriticAutofill = config.diacriticAutofill;
            db.insertCrossword(config, crossword, (crosswordId) => {
                if (socket.connected) {
                    socket.emit("crossword::redirect", `/display/display.html?id=${crosswordId}`);
                }
            });
        }, cannotGenerate);

        generatorInstance.generateNext();
    }
}

io.on('connect', (socket) => {

    socket.on('crossword::textHasArrived', (text, callback) => {
        processText(text, (words) => {
            db.getDefinitions(words).then((definitions) => {
                let definitionsArrayBecauseSocketIOCannotTransmitMapForSomeWildReason = Array.from(definitions);
                let wordsArray = words.map((word) => {return word.word;});
                callback(wordsArray, definitionsArrayBecauseSocketIOCannotTransmitMapForSomeWildReason);
            });
        });
    });

    socket.on("crossword::getConfigs", (callback) => {
        db.getAllConfigIds(callback);
    });

    socket.on("crossword::chooseStartingConfigId", (configId) => {
        socket.emit("crossword::redirect", `/config/config.html?id=${configId}`);
    });

    socket.on("crossword::getConfigById", (id, callback) => {
        db.getConfigById(id, callback);
    });

    socket.on("crossword::saveConfig", (config, callback) => {
        db.insertOrUpdateConfig(config, callback);
    });

    socket.on("crossword::saveTemplate", (template, callback) => {
        fs.readFile('./www/images/index', 'utf8', (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            let index = parseInt(data);
            fs.writeFile('./www/images/index', `${index+1}`, err => {(err) ? console.log(err) : null;})
            let img = template.backgroundImage;
            if (img !== null) {``
                const splitted = img.split(';base64,');
                const format = splitted[0].split('/')[1];
                fs.writeFileSync(`./www/images/${index}.` + format, splitted[1], { encoding: 'base64' });
                template.backgroundImage = `/images/${index}.` + format;
            }
            db.saveTemplate(template, callback);
        });
    });

    socket.on("crossword::getAllCrosswordTemplates", (callback) => {
        db.getAllCrosswordTemplates(callback);
    });

    socket.on("crossword::getTemplate", (id, callback) => {
        db.getTemplateById(id, callback);
    });

    socket.on("crossword::reportDefinition", (id) => {
        db.reportDefinition(id);
    });
    
    socket.on("crossword::generate", (config) => {
        db.insertOrUpdateConfig(config, () => {
            db.updatePrettinessOfSelectedDefinitions(config.definitions, () => {
                generate(config, socket);
            });
        });
    });

    socket.on("crossword::generateWithApprovedWords", (config) => {
        db.insertOrUpdateConfig(config, () => {
            db.getApprovedWords((ws) => {
                processText(ws.join(' '), (words) => {
                    db.getDefinitions(words).then((definitions) => {
                        config.definitions = new Map(config.definitions);
                        definitions = new Map(definitions);
                        let usedWords = new Set();
                        config.words.forEach((w) => {usedWords.add(w.word);})
                        words.forEach((w) => {
                            if (!usedWords.has(w.word)) {
                                usedWords.add(w.word);
                                config.words.push({word: w.word, selected: definitions.has(w.word) && definitions.get(w.word).length > 0, secret: false});
                            }
                        });
                        definitions.forEach((defArray, word) => {
                            defArray.sort((a, b) => b.pretty-a.pretty)
                            config.definitions.set(word, defArray.map((def, i) => {return {id: def.id, selected: i === 0}}))
                        });
                        config.definitions = Array.from(config.definitions)
                        generate(config, socket);
                    });
                });
            });
        });
    });

    socket.on("crossword::getCrossword", (id, callback) => {
        db.getCrossword(id, callback);
    });
});
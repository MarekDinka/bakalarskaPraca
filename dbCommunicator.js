const { Client } = require('pg');
const { getRandomInt } = require('./generate/crosswordBase');
const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'admin'
  });

module.exports = { 
    db: class Database {
        APPROVED_WORDS_LIMIT = 500;

        constructor() {
            client.connect();
        }

        async getApprovedWords(callback) {
            client.query(`SELECT w.word FROM approvedwords aw LEFT JOIN words w ON w.id = aw.wordId ORDER BY random() LIMIT ${this.APPROVED_WORDS_LIMIT}`,
            (err, res) => {
                if (err) {
                    console.log("[Get approved words connection error] ", err.stack);
                    return;
                }
                let words = [];
                for (const row of res.rows) {
                    words.push(row.word.toLowerCase());
                }
                callback(words);
            });
        }

        saveTemplate(template, callback) {
            client.query(`INSERT INTO crosswordTemplates(template) VALUES ('${JSON.stringify(template)}')`, 
            (err, res) => {
                if (err) {
                    console.log("template insert failed!");
                    console.log("[Connection error] ", err.stack);
                    return;
                }
                callback();
            });
        }

        getAllCrosswordTemplates(callback) {
            client.query(`SELECT ct.id AS id, ct.template AS template FROM crosswordTemplates ct ORDER BY id DESC`, 
            (err, res) => {
                if (err) {
                    console.log("[Connection error] ", err.stack);
                    return;
                }
                let result = [];
                res.rows.forEach((r) => {
                    result.push({id: r.id, template: r.template});
                });
                callback(result);
            });
        }

        getTemplateById(id, callback) {
            client.query(`SELECT ct.template AS template FROM crosswordTemplates ct WHERE ct.id = ${id}`, 
            (err, res) => {
                if (err) {
                    console.log("[Connection error] ", err.stack);
                    return;
                }
                if (res.rows.length > 0) {
                    callback(res.rows[0].template);
                } else {
                    console.log(`no templates with id = ${id}`);
                }
            });
        }

        addNewDefinitions(definitions, callback) {
            const DEFINITION_WORD = 0, DEFINITION_DEF = 1, NEW_DEFINITION_STARTING_PRETTINESS = 10;
            let wait = definitions.length;
            definitions.forEach((definition) => {
                client.query(`
                INSERT INTO definitions(definition, prettiness, lemmaId) SELECT defs.d, ${NEW_DEFINITION_STARTING_PRETTINESS}, getWordId('${definition[DEFINITION_WORD].toLowerCase()}') FROM (VALUES ('${definition[DEFINITION_DEF].definition}')) AS defs(d) RETURNING ID`, (err, res) => {
                    wait--;
                    if (err) {
                        console.log("[Connection error] ", err.stack);
                        return;
                    }
                    if (res.rowCount > 0) {
                        definition[DEFINITION_DEF].id = res.rows[0].id;
                    } else {
                        console.log("NEW DEFINITION -> no ID returned");
                    }
                });
            });
            let awaitResult = () => {
                if (wait > 0) {
                    setTimeout(awaitResult, 100);
                } else {
                    callback();
                }
            };
            awaitResult();
        }

        getDefinitions(words) {
            let lemmas = words.filter((w) => w.lemma != "");
            let definitions = new Map();
            let wait = words.length + lemmas.length;
            console.log("found " + words.length + " words");
            words.forEach((w) => {
                client.query(`SELECT DISTINCT ON (def) d.id AS id, d.definition AS def, d.prettiness AS pretty FROM words w RIGHT JOIN lemmas lm ON lm.id = w.lemmaid RIGHT JOIN definitions d ON d.lemmaid = lm.id 
                WHERE w.word = '${w.word.toLowerCase()}' ${w.lemma.length > 0 ? `OR w.word = '${w.lemma.toLowerCase()}'` : ""};`,
                (err, res) => {
                    wait--;
                    if (err) {
                        console.log("[Connection error] select definitions ", err.stack);
                        return;
                    }
                    if (res.rowCount > 0) {
                        res.rows.forEach((r) => {
                            if (!definitions.has(w.word)) {
                                definitions.set(w.word, []);
                            }
                            definitions.get(w.word).push({id: r.id, definition: r.def, pretty: r.pretty});
                        });
                    }
                });
            });

            lemmas.forEach((w) => {
                client.query(`WITH lemma AS (SELECT insertLemma('${w.lemma.toLowerCase()}') AS id) SELECT updateWordShape('${w.word.toLowerCase()}', id) FROM lemma;`, (err, _) => {if (err) {console.log("Update lemma error ", err.stack);}})
                client.query(`SELECT DISTINCT ON (def) d.id AS id, d.definition AS def, d.prettiness AS pretty FROM lemmas lm RIGHT JOIN definitions d ON d.lemmaid = lm.id 
                WHERE lm.word = '${w.lemma.toLowerCase()}';`,
                (err, res) => {
                    wait--;
                    if (err) {
                        console.log("[Connection error] select lemma definitions", err.stack);
                        return;
                    }
                    if (res.rowCount > 0) {
                        res.rows.forEach((r) => {
                            if (!definitions.has(w.word)) {
                                definitions.set(w.word, []);
                            }
                            definitions.get(w.word).push({id: r.id, definition: r.def, pretty: r.pretty});
                        });
                    }
                });
            });

            return new Promise((resolve, reject) => {
                let getResult = () => {
                    if (wait > 0) {
                        setTimeout(getResult, 100);
                    } else {
                        let miss = words.filter((w) => !definitions.has(w.word)).length
                        console.log("missed definitions for " + miss + " words!");
                        definitions.forEach((arr, key) => {
                            let uniqueArr = arr.filter((val, i, array) => {
                                for (let j = 0; j < array.length; j++) {
                                    if (array[j].definition === val.definition) {
                                        return j === i;
                                    }
                                }
                            });
                            uniqueArr.sort((a, b) => b.pretty - a.pretty);
                            definitions.set(key, uniqueArr);
                        });
                        resolve(definitions);
                    }
                };
                getResult();
            });
        }

        getDefinitionsForIds(ids, callback) {
            let definitions = new Map();
            if (ids.length === 0) {callback(definitions); return;}
            client.query(`SELECT df.id AS id, df.definition AS definition, df.prettiness AS pretty FROM definitions df WHERE df.id IN (${ids.join(",")})`, 
            (err, res) => {
                if (err) {
                    console.log("[Connection error] select definitions for ids", err.stack);
                    return;
                }
                res.rows.forEach((r) => {
                    definitions.set(r.id, {definition: r.definition, pretty: r.pretty});
                });
                callback(definitions);
            });
        }

        updateDefinitionPrettiness(id, add) {
            client.query(`UPDATE definitions df SET prettiness = (SELECT dff.prettiness FROM definitions dff WHERE dff.id = ${id})${(add) ? "+" : "-"}1 WHERE df.id = ${id}`, 
            (err, _) => {
                if (err) {
                    console.log("[Connection error] ", err.stack);
                    return;
                }
            });
        }

        reportDefinition(id) {
            this.updateDefinitionPrettiness(id, false);
        }

        updatePrettinessOfSelectedDefinitions(definitions, callback) {
            const DEFINITION_ARRAY = 1;
            definitions.forEach((def) => {
                def[DEFINITION_ARRAY].forEach((definition) => {
                    if (definition.selected) {
                        this.updateDefinitionPrettiness(definition.id, true);
                    }
                });
            });
            callback();
        }

        insertNewConfig(config, callback) {
            const DEFINITION_WORD = 0, DEFINITION_ARRAY = 1, INVALID_DEFINITION = -1;
            let newDefinitions = [];
            config.definitions.forEach((def) => { //collect and insert all new Definitions
                def[DEFINITION_ARRAY].forEach((definition) => {
                    if (definition.id === INVALID_DEFINITION) {
                        newDefinitions.push([def[DEFINITION_WORD], definition]);
                    }
                });
            });
            this.addNewDefinitions(newDefinitions, () => {
                config.definitions = config.definitions.map((def) => [def[DEFINITION_WORD], def[DEFINITION_ARRAY].map((definition) => {return {id: definition.id, selected: definition.selected};})]);
                client.query(`INSERT INTO configs(config) VALUES ('${JSON.stringify(config)}') RETURNING ID`, 
                (err, res) => {
                    if (err) {
                        console.log("config insert failed!");
                        console.log("[Connection error] ", err.stack);
                        return;
                    }
                    if (res.rowCount > 0) {
                        let id = res.rows[0].id;
                        config.id = id;
                        client.query(`UPDATE configs SET config='${JSON.stringify(config)}'::json WHERE id=${id}`,
                        (err, res) => {
                            if (err) {
                                console.log("config update failed!");
                                console.log("[Connection error] ", err.stack);
                                return;
                            }
                            callback(config.id);
                        });
                    } else {
                        console.log("NO ID RETURNED WHEN INSERTING CONFIG!!!!!");
                    }
                });
            });
        }

        insertOrUpdateConfig(config, callback) {
            if (config.id === 0) {this.insertNewConfig(config, callback); return;}
            const DEFINITION_WORD = 0, DEFINITION_ARRAY = 1, INVALID_DEFINITION = -1;
            let newDefinitions = [];
            config.definitions.forEach((def) => { //collect and insert all new Definitions
                def[DEFINITION_ARRAY].forEach((definition) => {
                    if (definition.id === INVALID_DEFINITION) {
                        newDefinitions.push([def[DEFINITION_WORD], definition]);
                    }
                });
            });
            this.addNewDefinitions(newDefinitions, () => {
                config.definitions = config.definitions.map((def) => [def[DEFINITION_WORD], def[DEFINITION_ARRAY].map((definition) => {return {id: definition.id, selected: definition.selected};})]);
                client.query(`UPDATE configs SET config='${JSON.stringify(config)}'::json WHERE id=${config.id}`,
                (err, res) => {
                    if (err) {
                        console.log("config update failed!");
                        console.log("[Connection error] ", err.stack);
                        return;
                    }
                    callback(config.id);
                });
            });
        }

        insertCrossword(config, crossword, callback) {
            let pickRandom = (arr) => {return arr[getRandomInt(0, arr.length)];};
            let definitions = new Map(config.definitions);
            crossword.words.forEach((word) => {
                if (definitions.has(word.word)) {
                    word.definitionId = pickRandom(definitions.get(word.word).filter((def) => def.selected)).id;
                }
            });
            client.query(`INSERT INTO crosswords(crossword) VALUES ('${JSON.stringify(crossword)}') RETURNING ID`, 
            (err, res) => {
                if (err) {
                    console.log("crossword failed!");
                    console.log("[Connection error] ", err.stack);
                    return;
                }
                if (res.rowCount > 0) {
                    callback(res.rows[0].id);
                } else {
                    console.log("NO ID RETURNED WHEN INSERTING CROSSWORD!!!!!");
                }
            });
        }

        getCrossword(crosswordId, callback) {
            client.query("SELECT cw.crossword AS crossword FROM crosswords cw WHERE cw.id = $1::integer", [crosswordId], 
            (err, res) => {
                if (err) {
                    console.log("[Connection error] ", err.stack);
                    return;
                }
                if (res.rowCount > 0) {
                    let crossword = res.rows[0].crossword;
                    this.getDefinitionsForIds(crossword.words.map((w) => w.definitionId), (definitionIdMap) => {
                        crossword.words.forEach((w) => {
                            w.definition = definitionIdMap.get(w.definitionId).definition;
                        });
                        callback(crossword);
                    });
                } else {
                    console.log(`NO ROWS FOR CROSSWORD WITH id = ${crosswordId}!!!!!`);
                }
            });
        }

        getAllConfigIds(callback) {
            client.query("SELECT cf.id AS id FROM configs cf ORDER BY cf.id", 
            (err, res) => {
                if (err) {
                    console.log("[Connection error] ", err.stack);
                    return;
                }
                let result = [];
                for (let row of res.rows) {
                    result.push(row.id);
                }
                callback(result);
            });
        }

        getConfigById(id, callback) {
            const DEFINITION_ARRAY = 1;
            client.query(`SELECT cf.config AS config FROM configs cf WHERE cf.id=${id}`, 
            (err, res) => {
                if (err) {
                    console.log("[Connection error] ", err.stack);
                    return;
                }
                if (res.rowCount > 0) {
                    let config = res.rows[0].config;
                    let definitionIds = [];
                    config.definitions.forEach((def) => {
                        def[DEFINITION_ARRAY].forEach((definition) => {
                            definitionIds.push(definition.id);
                        });
                    });
                    this.getDefinitionsForIds(definitionIds, (definitionIdMap) => {
                        config.definitions.forEach((def) => {
                            def[DEFINITION_ARRAY].forEach((definition) => {
                                definition.definition = definitionIdMap.get(definition.id).definition;
                                definition.pretty = definitionIdMap.get(definition.id).pretty;
                            });
                        });
                        callback(config);
                    });
                } else {
                    console.log(`NO ROWS FOR CONFIG WITH id = ${id}!!!!!`);
                }
            });
        }
    }
}
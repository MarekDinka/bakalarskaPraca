class Config {
    HTMLinit() {
        let self = this;
        self.body.querySelector("a#save_config").addEventListener('click', function() {
            if(!this.classList.contains('disabled')){self.Configuration.save();}
        });
        self.body.querySelector("a#undo_config").addEventListener('click', function() {
            if(!this.classList.contains('disabled')){self.Configuration.undo();}
        });
        self.body.querySelector("a#nav_TC").addEventListener('click', function() {
            if(!this.classList.contains('disabled')) {
                for (let elem of self.body.querySelectorAll('nav>a')) {
                    elem.classList.remove('active');
                }
                this.classList.add('active');
                self.switchHTML('TC')
            }
        });
        self.body.querySelector("a#nav_CC").addEventListener('click', function() {
            if(!this.classList.contains('disabled')) {
                for (let elem of self.body.querySelectorAll('nav>a')) {
                    elem.classList.remove('active');
                }
                this.classList.add('active');
                self.switchHTML('CC')
            }
        });
        self.body.querySelector("a#nav_WC").addEventListener('click', function() {
            if(!this.classList.contains('disabled')) {
                for (let elem of self.body.querySelectorAll('nav>a')) {
                    elem.classList.remove('active');
                }
                this.classList.add('active');
                self.switchHTML('WC')
            }
        });
    }

    constructor(config, body) {
        this.body = body;
        this.body.innerHTML = this.BODY;
        this.HTMLinit();
        this.Configuration.init(config);
        this.choosenWord = null;
        this.wordSearchMap = new Map();
        this.state = null;

        if (config.id === 0) {
            this.switchHTML("TC");
        } else {
            this.Configuration.canUndo = true;
            this.body.querySelector("#nav_TC").classList.add("disabled");
            this.body.querySelector("#nav_CC").classList.remove("disabled");
            this.body.querySelector("#nav_WC").classList.remove("disabled");
            for (let word of config.words) {
                this.wordSearchMap.set(word.word, word);
            }
            this.switchHTML("CC");
            this.Configuration.lock();
        }
    }

    switchHTML(type) {
        this.state = type;
        switch(type) {
            case "TC": //text config
                this.TextConfig.init();
                break;
            case "CC": //crossword config
                this.CrosswordConfig.init();
                break;
            case "WC": // word config
                this.WordConfig.init();
                break;
        }
    }

    redraw() {
        switch(this.state) {
            case "TC":
                this.TextConfig.redraw();
                break;
            case "CC":
                this.CrosswordConfig.redraw();
                break;
            case "WC":
                this.WordConfig.redraw();
                break;
        }
    }

    showError(message, callback) {
        let badSmiley = this.body.querySelector("div#badSmiley");
        let p = badSmiley.querySelector("p#badSmileyMessage");
        let button = badSmiley.querySelector("button#badSmileyButton");

        p.innerHTML = message;
        button.onclick = function() {
            badSmiley.style.visibility = 'hidden';
            callback();
        }
        badSmiley.style.visibility = 'visible';
    }

    crosswordCannotBeGenerated(msg, callback) {
        let badSmiley = this.body.querySelector("div#wideBadSmiley");
        badSmiley.style.visibility = 'visible';
        badSmiley.querySelector("p#badSmileyMessage").innerHTML = msg;
        let button1 = badSmiley.querySelector("button#wideBadSmileyButton1");
        let button2 = badSmiley.querySelector("button#wideBadSmileyButton2");

        let self = this;

        button1.onclick = function() {
            badSmiley.style.visibility = 'hidden';
            socket.emit("crossword::generateWithApprovedWords", self.Configuration.config);
        }

        button2.onclick = function() {
            badSmiley.style.visibility = 'hidden';
            callback();
        }
    }

    removeActiveFromNav() {
        for (let elem of this.body.querySelectorAll("nav>a")) {
            elem.classList.remove('active');
        }
    }

    SPINNER = `
        <div id="spinner" class="spinner-border" role="status">
            <span class="sr-only"></span>
        </div>`;

    makeALoaderOutOfMe(elem) {
        elem.classList.add("remove");
        const spinner = new DOMParser().parseFromString(this.SPINNER, "text/html").querySelector("#spinner");
        elem.parentNode.appendChild(spinner);
        return spinner
    }

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~CONFIG~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    Configuration = new class {
        constructor(self) {
            this.self = self;
            this.undoingConfig = false;
            this.canUndo = false;
        }

        init(config) {
            this.config = config;
            if (this.config.newSecrets === undefined) {
                this.config.newSecrets = [];
            }
            if (this.config.templateId === undefined) {
                this.config.templateId = -1;
            }
            if (this.config.horBubbleColor === undefined) {
                this.config.horBubbleColor = "#4f7eff";
            }
            if (this.config.verBubbleColor === undefined) {
                this.config.verBubbleColor = "#ff4747";
            }
            if (this.config.diacriticAutofill === undefined) {
                this.config.diacriticAutofill = true;
            }
        }

        save(callback = null) {
            const saveButton = this.self.body.querySelector("a#save_config");
            let spinner = null;
            try {
                spinner = this.self.makeALoaderOutOfMe(saveButton);
            } catch (err) {} 
            this.definitions = Array.from(this.definitions);
            socket.emit("crossword::saveConfig", this.config, (id) => {
                if (this.config.id === 0) {this.config.id = id;}
                if (spinner !== null) {
                    spinner.remove();
                }
                saveButton.classList.remove("remove");
                this.canUndo = true;
                this.lock();
                if (callback != null) {
                    callback();
                }
            });
            this.lock();
            this.definitions = new Map(this.definitions);
        }

        undo() {
            this.undoingConfig = true;
            let choosenWord = this.self.choosenWord;
            const undoButton = this.self.body.querySelector("a#undo_config");
            const spinner = this.self.makeALoaderOutOfMe(undoButton);
            socket.emit("crossword::getConfigById", this.id, (config) => {
                this.config = config;
                this.definitions = new Map(this.definitions);
                if (spinner !== null) {
                    spinner.remove();
                }
                undoButton.classList.remove("remove");
                this.self.choosenWord = null;
                this.self.wordSearchMap = new Map();
                for (let word of this.config.words) {
                    if (choosenWord !== null && word.word === choosenWord.word) {
                        this.self.choosenWord = word;
                    }
                    this.self.wordSearchMap.set(word.word, word);
                }
                this.self.redraw();
                this.undoingConfig = false;
                this.lock();
            });
            this.lock();
        }

        unlock() {
            if (this.undoingConfig) {return;}
            let saveButton = this.self.body.querySelector("a#save_config");
            if (saveButton !== null) {
                saveButton.classList.remove("disabled");
            }
            if (this.canUndo) {
                let undoButton = this.self.body.querySelector("a#undo_config");
                if (undoButton !== null) {
                    undoButton.classList.remove("disabled");
                }
            }
        }

        lock() {
            let saveButton = this.self.body.querySelector("a#save_config");
            if (saveButton !== null) {
                saveButton.classList.add("disabled");
            }
            let undoButton = this.self.body.querySelector("a#undo_config");
            if (undoButton !== null) {
                undoButton.classList.add("disabled");
            }
        }

        get id() {return this.config.id;}
        set id(id) {this.config.id = id;this.unlock();}
        get words() {return this.config.words;}
        set words(words) {this.config.words = words;this.unlock();}
        get definitions() {return this.config.definitions;}
        set definitions(defs) {this.config.definitions = defs; this.unlock();}
        get type() {return this.config.type;}
        set type(type) {this.config.type = type;this.unlock();}
        get numberOfWordsToUse() {return this.config.numberOfWordsToUse;}
        set numberOfWordsToUse(numberOfWordsToUse) {this.config.numberOfWordsToUse = numberOfWordsToUse;this.unlock();}
        get newSecrets() {return this.config.newSecrets;}
        set newSecrets(newSecrets) {this.config.newSecrets = newSecrets;this.unlock();}
        get templateId() {return this.config.templateId;}
        set templateId(templateId) {this.config.templateId = templateId;this.unlock();}
        get horBubbleColor() {return this.config.horBubbleColor;}
        set horBubbleColor(horBubbleColor) {this.config.horBubbleColor = horBubbleColor;this.unlock();}
        get verBubbleColor() {return this.config.verBubbleColor;}
        set verBubbleColor(verBubbleColor) {this.config.verBubbleColor = verBubbleColor;this.unlock();}
        get diacriticAutofill() {return this.config.diacriticAutofill;}
        set diacriticAutofill(diacriticAutofill) {this.config.diacriticAutofill = diacriticAutofill;this.unlock();}

    }(this);

//---------------------------------------------------------------------------------CONFIG---------------------------------------------------------------------------------------

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TEXT CONFIG~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    TextConfig = new class {
        constructor(self) {
            this.self = self;
        }

        init() {
            let html = new DOMParser().parseFromString(this.HTML_TEXT_CONFIG, "text/html");
            const self = this;
            this.self.body.querySelector("#contents").innerHTML = html.body.innerHTML;
            this.self.body.querySelector("button#processTextButton").addEventListener('click', function() {
                const text = self.self.body.querySelector("#textToAnalyze").value;
                if (typeof text === undefined || text === null || text.length === 0) {return;}
                self.self.makeALoaderOutOfMe(this); 
                self.processText();
            });
            this.self.removeActiveFromNav();
            this.self.body.querySelector("a#nav_TC").classList.add('active');
        }

        redraw() {
            let text = this.self.body.querySelector("#textToAnalyze").value;
            this.init();
            this.self.body.querySelector("#textToAnalyze").value = text;
        }

        processText() {
            socket.emit('crossword::textHasArrived', this.self.body.querySelector("#textToAnalyze").value, (words, definitions) => {
                let defs = new Map();
                (new Map(definitions)).forEach((defArray, word) => {
                    defArray.forEach((def, i) => {
                        def.selected = i === 0;
                    });
                    defs.set(word, defArray);
                });
                let ws = [];
                let secretWord = {word: ""};
                let w;
                for (let word of words) {
                    w = {word: word, selected: defs.has(word) && defs.get(word).length > 0, secret: false};
                    ws.push(w);
                    if (secretWord.word.length <= 5 && word.length > 5) {secretWord = w;}
                    this.self.wordSearchMap.set(word, w);
                }
                secretWord.secret = true;
                let config = this.self.Configuration;
                config.words = ws;
                config.definitions = defs;
                config.save(() => {window.location.href = `/config/config.html?id=${config.id}`;});
            });
        }

        HTML_TEXT_CONFIG = `
            <div class="pb-5 pt-3 d-flex align-items-center justify-content-center">
                <h1 class="h1">Nastavenia</h1>
            </div>
                <div class="d-flex align-items-center justify-content-center">
                    <textarea name="textToAnalyze" class="textarea form-control" id="textToAnalyze" cols="50" rows="15"></textarea>
                </div>
                <div class="d-flex align-items-center justify-content-center pt-4">
                    <button id="processTextButton" type="button" class="button">spracuj</button>
                </div>
            </div>
        `
    }(this);

//-------------------------------------------------------------------------------TEXT CONFIG------------------------------------------------------------------------------------

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~CROSSWORD CONFIG~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    CrosswordConfig = new class {
        constructor(self) {
            this.self = self;
        }

        init() {
            const self = this;
            let html = new DOMParser().parseFromString(this.HTML_CROSSWORD_TYPE_CONFIG, "text/html");
            html.querySelector("#crosswordSettings").innerHTML = this.HTMLgetCrosswordSettings();
            const radioButtonList = html.querySelector("#radioButtonList");
            radioButtonList.innerHTML = this.HTMLgetCrosswordTypeRadio();
            radioButtonList.querySelector("input#U").addEventListener('click', function() {
                self.chooseANewType(this);
            });
            radioButtonList.querySelector("input#F").addEventListener('click', function() {
                self.chooseANewType(this);
            });
            radioButtonList.querySelector("input#H").addEventListener('click', function() {
                self.chooseANewType(this);
            });
            this.self.body.querySelector("#contents").innerHTML = "";
            this.self.body.querySelector("#contents").appendChild(html.querySelector("div#crosswordTypeConfigDiv"));
            this.self.body.querySelector("#confirmTypeChoiceInput").addEventListener('click', function() {
                self.self.makeALoaderOutOfMe(this);
                self.confirmChoosingAType()
            });
            this.self.body.querySelector("#horizontalBubbleColor").addEventListener('change', function() {self.self.Configuration.horBubbleColor = this.value;});
            this.self.body.querySelector("#verticalBubbleColor").addEventListener('change', function() {self.self.Configuration.verBubbleColor = this.value;});
            this.self.body.querySelector("#autoDiacritic").addEventListener('change', function() {self.self.Configuration.diacriticAutofill = this.checked;});
            this.self.removeActiveFromNav();
            this.self.body.querySelector("a#nav_CC").classList.add('active');
            switch (this.self.Configuration.type) {
                case null:
                case 'U':
                    this.addUnfullCrosswordSettings();
                    break;
                case 'F':
                    this.addFullCrosswordSettings();
                    break;
                case 'H':
                    this.addHrebenovkaSettings();
                    break;
            }
        }

        redraw() {
            this.init();
        }

        chooseANewType(elem) {
            switch (elem.value) {
                case 'U':
                    this.self.Configuration.type = 'U';
                    this.addUnfullCrosswordSettings();
                    break;
                case 'F':
                    this.self.Configuration.type = 'F';
                    this.addFullCrosswordSettings();
                    break;
                case 'H':
                    this.self.Configuration.type = 'H';
                    this.addHrebenovkaSettings();
                    break;
            }
        }
    
        addUnfullCrosswordSettings() {
            const self = this;
            if (!this.self.Configuration.numberOfWordsToUse) {this.self.Configuration.numberOfWordsToUse = 10;}
            let parrent = this.self.body.querySelector("#additionalSettings");
            parrent.innerHTML = "";
            let div = this.HTMLcreateAdditionalConfigTab();
            let numberOfWords = new DOMParser().parseFromString(`
            <div>
                <label for="additionalSettings__content__numberOfWords">Maximálny počet slov použitých v krížovke</label>
                <input type="number" class="form-control" value="${this.self.Configuration.numberOfWordsToUse}" id="additionalSettings__content__numberOfWords">
            </div>
            `, "text/html").querySelector("div");
            div.querySelector("#additionalSettings__content").appendChild(numberOfWords);
            numberOfWords.querySelector("input#additionalSettings__content__numberOfWords").addEventListener('change', function() {
                self.changeNumberOfWords(this.value);
            });
            parrent.appendChild(div);
        }
    
        changeNumberOfWords(numberOfWords) {
            this.self.Configuration.numberOfWordsToUse = numberOfWords;
        }
    
        addFullCrosswordSettings() {
            const self = this;
            if (!this.self.Configuration.numberOfWordsToUse) {this.self.Configuration.numberOfWordsToUse = 10;}
            let parrent = this.self.body.querySelector("#additionalSettings");
            parrent.innerHTML = "";
            let div = this.HTMLcreateAdditionalConfigTab();
            let editorButton = new DOMParser().parseFromString(`
            <div class="d-grid pb-2">
                <button onclick="window.open('/config/template.html', '_blank').focus();" class="btn button--no-expand">Nový dizajn</button>
            </div>
            `, "text/html").querySelector("div");
            let content = div.querySelector("#additionalSettings__content");
            content.appendChild(editorButton);
            let crosswordTemplateDiv = new DOMParser().parseFromString(`<div class="row"></div>`, "text/html").querySelector("div");
            socket.emit("crossword::getAllCrosswordTemplates", (templates) => {
                templates.forEach((cw) => {
                    if (this.self.Configuration.templateId === -1) {this.self.Configuration.templateId = cw.id;}
                    let HTMLcrossword = new DOMParser().parseFromString(this.stringHTMLgetCrossword(cw), "text/html").querySelector("div");
                    crosswordTemplateDiv.appendChild(HTMLcrossword);
                    crosswordTemplateDiv.querySelector(`#crossword_${cw.id}`).addEventListener('click', function() {
                        self.chooseTemplate(cw.id);
                    });
                });
            });
            content.appendChild(crosswordTemplateDiv);
            parrent.appendChild(div);
        }

        chooseTemplate(id) {
            let old = this.self.body.querySelector(`div#crossword_${this.self.Configuration.templateId}`);
            if (old !== null) {
                old.classList.remove("crossword--choosen");
            }
            this.self.body.querySelector(`div#crossword_${id}`).classList.add("crossword--choosen");
            this.self.Configuration.templateId = id;
        }

        addHrebenovkaSettings() {
            let parrent = this.self.body.querySelector("#additionalSettings");
            parrent.innerHTML = "";
        }

        confirmChoosingAType() {
            this.self.Configuration.save();
            this.self.switchHTML("WC");
        }

        HTMLcreateAdditionalConfigTab() {
            return new DOMParser().parseFromString(`
        <div class="row py-2">
            <div class="col">
                <div class="p-3 pb-5 form-control" id="additionalSettings__content">
                </div>
            </div>
        </div>
            `, "text/html").querySelector(".row");
        }

        stringHTMLgetCrossword(cw) { // cw = {id: int, template: {backgroundImage: may be null, backgroundColor: "#hex", template: 2d Array consisting of {hidden: bool, color: "#hex"}}}
            return `
            <div class="col-12 col-md-6 crossword__col">
                <div class="edit-template-div">
                    <button onclick="window.open('/config/template.html?id=${cw.id}', '_blank').focus();" class="btn button--absolute">Klonovať</button>
                </div>
                <div id="crossword_${cw.id}" class="crossword ${this.self.Configuration.templateId === cw.id ? "crossword--choosen" : ""}" 
                    
                    style="${cw.template.backgroundImage !== null ? `background-image: url(${cw.template.backgroundImage})` : `background-color: ${cw.template.backgroundColor}`}">
                    <div class="crossword__box">
                        ${(() => {
                            let res = "";
                            cw.template.template.forEach((row) => {
                                res += `<div class="crossword__row">`;
                                row.forEach((cell) => {
                                    res += `
                                    <div class="crossword__square${cell.hidden ? "--hidden" : ""}">
                                        <input type="text" disabled class="crossword__char${cell.hidden ? "--hidden" : ""} text-readable"
                                            ${cell.letterCell ? `value="?"` : ``} style="background: ${cell.color};">
                                            <div style="position:absolute; left:0; right:0; top:0; bottom:0;"
                                                 ></div>
                                    </div>
                                    `
                                });
                                res += `</div>`;
                            });
                            return res;
                        })()}
                    </div>
                </div>
            </div>`
        }

        HTMLgetCrosswordSettings() {
            return `
            <div class="row g-3 align-items-center">
                <div class="col-auto">
                    <label for="horizontalBubbleColor" class="col-form-label">Farba označených slov <i class="fa-solid fa-arrow-right"></i></label>
                </div>
                <div class="col-auto">
                    <input type="color" id="horizontalBubbleColor" value="${this.self.Configuration.horBubbleColor}">
                </div>
            </div>
            <div class="row g-3 align-items-center">
                <div class="col-auto">
                    <label for="verticalBubbleColor" class="col-form-label">Farba označených slov <i class="fa-solid fa-arrow-down"></i></label>
                </div>
                <div class="col-auto">
                    <input type="color" id="verticalBubbleColor" value="${this.self.Configuration.verBubbleColor}">
                </div>
            </div>
            <hr class="hr">
            <div class="row g-3 align-items-center">
                <div class="col-auto">
                    <label for="autoDiacritic" class="col-form-label">Automaticky dopĺňať diakritiku</label>
                </div>
                <div class="col-auto">
                    <input type="checkbox" id="autoDiacritic" ${this.self.Configuration.diacriticAutofill ? "checked" : ""}>
                </div>
            </div>
            <hr class="hr">
            <div class="row g-3 align-items-center">
                <div class="col-auto">
                    <label for="radioButtonList" class="col-form-label">Typ krížovky</label>
                </div>
                <div class="col">
                    <div class="d-flex justify-content-evenly" id="radioButtonList"></div>
                </div>
            </div>`
        }

        HTMLgetCrosswordTypeRadio() {
            return `
        <div class="row">
            <div class="col-12 col-md-4 d-flex justify-content-center">
                <div class="form-check form-check-inline">
                    <input class="btn-check" name="crosswordType" id="U" type="radio" value="U" autocomplete="off" ${(this.self.Configuration.type === null || this.self.Configuration.type === 'U') ? "checked" : ""}>
                    <label class="btn button" for="U">
                        Neúplná krížovka
                    </label>
                </div>
            </div>
            <div class="col-12 col-md-4 d-flex justify-content-center">
                <div class="form-check form-check-inline">
                    <input class="btn-check" name="crosswordType" id="F" type="radio" value="F" autocomplete="off" ${(this.self.Configuration.type === 'F') ? "checked" : ""}>
                    <label class="btn button" for="F">
                        Úplná krížovka
                    </label>
                </div>
            </div>
            <div class="col-12 col-md-4 d-flex justify-content-center">
                <div class="form-check form-check-inline">
                    <input class="btn-check" name="crosswordType" id="H" type="radio" value="H" autocomplete="off" ${(this.self.Configuration.type === 'H') ? "checked" : ""}>
                    <label class="btn button" for="H">
                        Hrebeňovka
                    </label>
                </div>
            </div>
        </div>`;
        }

        HTML_CROSSWORD_TYPE_CONFIG = `
            <div id="crosswordTypeConfigDiv">
                <div class="row">
                    <div class="col-1">
                    </div>
                    <div class="col-10">
                        <h1 class="h1 text-center pt-3">Nastavenia</h1>
                    </div>
                </div>
                <div class="row py-2">
                    <div class="col">
                        <div class="form-control" id="crosswordSettings">
                        </div>
                    </div>
                </div>
                <div id="additionalSettings">
                </div>
                <div class="row py-2">
                    <div class="col">
                        <div class="d-grid">
                            <input id="confirmTypeChoiceInput" type="submit" value="Potvrď" class="btn button">
                        </div>
                    </div>
                </div>
            </div>`

    }(this);

//-----------------------------------------------------------------------------CROSSWORD CONFIG---------------------------------------------------------------------------------

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~WORD CONFIG~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    WordConfig = new class {
        constructor(self) {
            this.self = self;
        }

        init() {
            let html = new DOMParser().parseFromString(this.HTML_WORD_CONFIG, "text/html");
            let wordList = html.querySelector("#words");
            wordList.classList.add("wordList");
            this.self.body.querySelector("#contents").innerHTML = html.body.innerHTML;
            const self = this;
            this.self.body.querySelector("#generateButton").addEventListener('click', function() {
                const spinner = self.self.makeALoaderOutOfMe(this);
                self.self.generate(() => {
                    this.classList.remove("remove");
                    spinner.remove();
                });
            });
            if (this.self.choosenWord === null) {
                this.self.choosenWord = this.self.Configuration.words[0];
            }
            this.redraw();
            this.self.removeActiveFromNav();
            this.self.body.querySelector("a#nav_WC").classList.add('active');
        }

        redraw() {
            this.drawWords();
            this.drawSecrets();
            this.redrawDefinitionTab();
        }

        drawWords() {
            let wordList = this.self.body.querySelector("#words");
            wordList.innerHTML = this.self.Configuration.words.map((w) => {
                let defs = this.self.Configuration.definitions.get(w.word);
                return `<span class="${(this.self.choosenWord === w) ? "wordList__word--choosen" : "wordList__word"} ${
                    (this.self.Configuration.definitions.has(w.word))
                        ? (defs.length > 0)
                            ? (defs.filter((d) => d.pretty > 5).length > 0
                                ? (w.selected)
                                        ? "wordList__word__many_defs--selected"
                                        : "wordList__word__many_defs"
                                : (w.selected)
                                        ? "wordList__word__few_defs--selected"
                                        : "wordList__word__few_defs"
                                )
                            : (w.selected)
                                    ? ""
                                    : "wordList__word__no_defs"
                        : (w.selected)
                                ? ""
                                : "wordList__word__no_defs"}"
                id="${w.word}">${w.word}</span>`
            }).join("<span class='wordList__comma'>, </span>");
            const self = this;
            this.self.Configuration.words.forEach((w) => {
                wordList.querySelector(`#${w.word}`).addEventListener('click', function() {
                    self.showDefinitions(this.id);
                });
            });
        }

        drawSecrets() {
            if (this.self.Configuration.type !== 'H') {return;}
            let secretList = [];
            let closeSecretButtonIds = [];
            this.self.Configuration.words.forEach((w) => {
                if (w.secret) {
                    secretList.push(`<span class="secretList__word">${w.word}<button id="${w.word}-removeButton" class="close-button"></button></span>`); //&#10006;
                    closeSecretButtonIds.push(w.word);
                }
            });
            this.self.Configuration.newSecrets.forEach((w) => {
                secretList.push(`<span class="secretList__word">${w}<button id="${w}-removeButton" class="close-button"></button></span>`);
                closeSecretButtonIds.push(w);
            });
            let HTML = `
            <div class="form-control">
                <h3 class="text-center">Zoznam tajničiek</h3>
                <p id="secrets_list">${secretList.join("")}</p>
                <div id="newSecretDiv" class="row align-middle">
                    <div class="col align-middle">
                        <input type="text" id="newSecretText" class="form-control newSecretInput" placeholder="Vlastná tajnička" aria-label="Vlastná tajnička">
                    </div>
                    <div class="col-auto definitions__definition__button">
                        <button id="addNewSecretButton" class="btn button--no-expand--success" type="button"><i class="bi bi-check"></i></button>
                    </div>
                </div>
            </div>`
            let div = this.self.body.querySelector("#list_of_secrets_div");
            div.innerHTML = HTML;
            const self = this;
            div.querySelector("button#addNewSecretButton").addEventListener('click', function() {
                self.addNewSecret();
            });
            closeSecretButtonIds.forEach((w) => {
                div.querySelector(`button#${w}-removeButton`).addEventListener('click', function() {
                    self.removeSecret(w);
                });
            });
        }

        redrawDefinitionTab() {
            if (this.self.choosenWord === null) {return;}
            let HTML = `
            <h3 class="text-center">Definícia slova <b>${this.self.choosenWord.word}</b></h3>
            <p><small><i>Vyber legendy, ktoré budú použité na identifikovanie tohoto slova</i></small></p>
            <div id="definitionList" class="definitions__definitionList">
                <div class="d-grid" id="addNewDefButton">
                    <input id="addNewDefinitionButton" type="button" class="btn button--no-expand" value="Pridať novú definíciu">
                </div>
            </div>
            <div class="d-flex justify-content-evenly py-2">
    
            ${this.self.Configuration.type === 'H'
                ? (!this.self.choosenWord.secret)
                    ? ((this.self.Configuration.definitions.has(this.self.choosenWord.word) && this.self.Configuration.definitions.get(this.self.choosenWord.word).length > 0)
                        ? ((this.self.choosenWord.selected)
                            ? `<input type="button" id="selectWordButton" value="Nepoužiť toto slovo" class="btn button--no-expand--danger">`
                            : `<input type="button" id="selectWordButton" value="Použiť toto slovo" class="btn button--no-expand--success">`)
                        : ``) + `<input type="button" id="selectSecretButton" value="Vybrať ako tajničku" class="btn button--no-expand--secret">`
                    : ``
                : (this.self.Configuration.definitions.has(this.self.choosenWord.word) && this.self.Configuration.definitions.get(this.self.choosenWord.word).length > 0)
                    ? (this.self.choosenWord.selected)
                        ? `<input type="button" id="selectWordButton" value="Nepoužiť toto slovo" class="btn button--no-expand--danger">`
                        : `<input type="button" id="selectWordButton" value="Použiť toto slovo" class="btn button--no-expand--success">`
                    : ``
            }
            </div>
            `

            let div = this.self.body.querySelector("#definitions");
            div.classList.remove("definitions--hidden");
            div.classList.add("definitions--visible");
            div.innerHTML = HTML;
            const self = this;
            div.querySelector("input#addNewDefinitionButton").addEventListener('click', function() {
                self.addNewDefinition();
            });
            const selectButton = div.querySelector("input#selectWordButton");
            if (selectButton !== null) {
                selectButton.addEventListener('click', function() {
                    self.changeSelectedStatus();
                });
            }
            const secretButton = div.querySelector("input#selectSecretButton");
            if (secretButton !== null) {
                secretButton.addEventListener('click', function() {
                    self.changeSecretStatus();
                });
            }
            if (!this.self.Configuration.definitions.has(this.self.choosenWord.word)) {
                return;
            }
            let i = 0;
            let defListDiv = div.querySelector("#definitionList");
            this.self.Configuration.definitions.get(this.self.choosenWord.word).sort((a, b) => b.pretty-a.pretty);
            for (let definition of this.self.Configuration.definitions.get(this.self.choosenWord.word)) {
                defListDiv.appendChild(this.HTMLcreateDefinition(definition, i, this.self.Configuration.definitions.get(this.self.choosenWord.word)));
                i++;
            }
            this.drawWords();
        }

        showDefinitions(word) {
            this.self.choosenWord = this.self.wordSearchMap.get(word);
            this.drawWords();
            this.redrawDefinitionTab();
        }

        addNewDefinition() {
            let HTML = `
            <div id="newDefinitionDiv" class="row definitions__definition align-middle">
                <div class="col">
                    <div>
                        <input type="text" id="newDefinitionText" class="form-control" placeholder="Legenda" aria-label="Legenda">
                    </div>
                </div>
                <div class="col-auto definitions__definition__button">
                    <button id="approveDefinitionButton" class="btn button--no-expand--success" type="button"><i class="bi bi-check"></i></button>
                </div>
                <div class="col-auto definitions__definition__button scroll_padding">
                    <button id="declineDefinitionButton" class="btn button--no-expand--danger" type="button"><i class="bi bi-x"></i></button>
                </div>
            </div>`
            const self = this;
            let definitionList = this.self.body.querySelector("#definitionList");
            const definition = new DOMParser().parseFromString(HTML, "text/html").querySelector(".row");
            definition.querySelector("button#approveDefinitionButton").addEventListener('click', function() {
                self.approveNewDefinition();
            });
            definition.querySelector("button#declineDefinitionButton").addEventListener('click', function() {
                self.declineNewDefinition();
            });
            definitionList.insertBefore(definition, definitionList.firstChild);
            definitionList.removeChild(definitionList.querySelector("#addNewDefButton"));
        }

        editDefinition(id) {
            let definitionText = this.self.body.querySelector("label[for=" + id + "]").innerHTML;
            this.addNewDefinition();
            this.self.body.querySelector("#newDefinitionText").value = definitionText;
        }
    
        declineNewDefinition() {
            this.redrawDefinitionTab();
        }
    
        approveNewDefinition() {
            const NEW_DEFINITION_STARTING_PRETTINESS = 10;
            let def = this.self.body.querySelector("#newDefinitionText").value;
            if (def.length > 0) {
                if (!this.self.Configuration.definitions.has(this.self.choosenWord.word)) {
                    this.self.Configuration.definitions.set(this.self.choosenWord.word, []);
                }
                this.self.Configuration.definitions.get(this.self.choosenWord.word).unshift({id: -1, definition: def, pretty: NEW_DEFINITION_STARTING_PRETTINESS, selected: true});

                this.self.Configuration.unlock();
                this.redraw();
            }
        }
    
        markDefinition(elem) {
            let definition = this.self.body.querySelector("label[for=" + elem.id + "]").innerHTML;
            if (elem.checked) {
                for (let def of this.self.Configuration.definitions.get(this.self.choosenWord.word)) {
                    if (def.definition === definition) {
                        def.selected = true;
                        break;
                    }
                }
            } else {
                for (let def of this.self.Configuration.definitions.get(this.self.choosenWord.word)) {
                    if (def.definition === definition) {
                        def.selected = false;
                        break;
                    }
                }
            }
            this.self.Configuration.unlock();
        }
    
        changeSelectedStatus() {
            let button = this.self.body.querySelector("#selectWordButton");
            let word = this.self.body.querySelector(`#${this.self.choosenWord.word}`);
            if (this.self.choosenWord.selected) {
                this.self.choosenWord.selected = false;
                button.value = "Použiť toto slovo";
                button.classList.remove("button--no-expand--danger");
                button.classList.add("button--no-expand--success");
                word.classList.remove("wordList__word--selected");
            } else {
                this.self.choosenWord.selected = true;
                button.value = "Nepoužiť toto slovo";
                button.classList.add("button--no-expand--danger");
                button.classList.remove("button--no-expand--success");
                word.classList.add("wordList__word--selected");
            }
            this.self.Configuration.unlock();
            this.redraw();
        }

        addNewSecret() {
            let input = this.self.body.querySelector('#newSecretText');
            this.self.Configuration.newSecrets.push(input.value.toUpperCase());
            input.value = "";
            this.self.Configuration.unlock();
            this.redraw();
        }

        removeSecret(word) {
            if (this.self.wordSearchMap.has(word)) {
                this.self.wordSearchMap.get(word).secret = false;
            } else {
                this.self.Configuration.newSecrets.splice(this.self.Configuration.newSecrets.indexOf(word), 1);
            }
            this.self.Configuration.unlock();
            this.redraw();
        }

        changeSecretStatus() {
            this.self.choosenWord.secret = true;
            this.self.Configuration.unlock();
            this.redraw();
        }

        HTMLcreateDefinition(definition, i) {
            let HTML = `
            <div class="row definitions__definition align-items-center">
                <div class="col">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="" id="definition${i}" ${(definition.selected) ? "checked" : ""}>
                        <label class="form-check-label" for="definition${i}">${definition.definition}</label>
                    </div>
                </div>
                <div class="col-auto definitions__definition__button">
                    <button class="btn button--no-expand--warning"><i class="bi bi-pencil"></i></button>
                </div>
                <div class="col-auto definitions__definition__button scroll_padding">
                    <button class="btn button--no-expand--danger"><i class="bi bi-flag"></i></button>
                </div>
            </div>`
            let row = new DOMParser().parseFromString(HTML, "text/html").querySelector(".row");
            let self = this;
            row.querySelector("button.button--no-expand--warning").addEventListener("click", function() {
                self.editDefinition(`definition${i}`);
            });
            row.querySelector("button.button--no-expand--danger").addEventListener("click", function() {
                socket.emit("crossword::reportDefinition", definition.id);
                definition.selected = false;
                definition.pretty--;
                self.self.redraw();
            });
            row.querySelector(`input#definition${i}`).addEventListener('click', function() {
                self.markDefinition(this);
            });
            return row;
        }

        HTML_WORD_CONFIG = `
            <div class="row">
                <div class="col-1">
                    <!-- <div class="d-flex justify-content-left p-3">
                        <button class="btn btn-outline-dark"><i class="bi bi-arrow-left-short"></i></button>
                    </div> -->
                </div>
                <div class="col-10">
                    <h1 class="h1 text-center pb-2 pt-3">Nastavenia</h1>
                </div>
            </div>
            <div class="row py-2">
                <div class="col-lg-7 col-12">
                    <div class="form-control">
                        <h3 class="text-center">Vyber slová do krížovky</h3>
                        <p id="words">
                            This should not be here
                        </p>
                        <!-- <p class="number_of_words_warning text-danger">
                            0 z 12 slov vybraných!
                        </p>
                        <p class="number_of_words_warning text-danger">
                            Tajnička nevybratá!
                        </p> -->
                    </div>
                </div>
                <div class="col-lg-5 col-12">
                    <div class="form-control">
                        <div id="definitions" class="definitions--hidden">
                            <h3 class="text-center">Definícia slova <b id="definedWord"></b></h3>
                            <p><small><i>Vyber legendy, ktoré budú použité na identifikovanie tohoto slova</i></small></p>
                            <div id="definitionList" class="definitions__definitionList">
                                <div class="row">
                                    <div class="col">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" value="" id="definition1">
                                            <label class="form-check-label" for="definition1">
                                                Definicia 1
                                            </label>
                                        </div>
                                    </div>
                                    <div class="col-auto">
                                        <button class="btn button--no-expand--warning"><i class="bi bi-pencil"></i></button>
                                    </div>
                                    <div class="col-auto">
                                        <button class="btn button--no-expand--danger"><i class="bi bi-flag"></i></button>
                                    </div>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="" id="definition2">
                                    <label class="form-check-label" for="definition2">
                                        Definicia 2
                                    </label>
                                </div>
                            </div>
                            <div class="d-flex justify-content-evenly py-2">
                                <input type="button" id="selectWordButton" value="Vybrať" class="btn button--no-expand--success">
                                <input type="button" value="Vybrať ako tajničku" class="btn button--no-expand--secret">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row py-2">
                <div id="list_of_secrets_div" class="col"></div>
            </div>
            <div class="row py-2">
                <div class="col">
                    <div id="generateButtonDiv" class="d-grid">
                        <input id="generateButton" type="submit" value="Generuj" class="btn button">
                    </div>
                </div>
            </div>`

    }(this);

//-------------------------------------------------------------------------------WORD CONFIG------------------------------------------------------------------------------------

    generate(removeSpinnerFunction) {
        if (this.Configuration.newSecrets.length == 0 && this.Configuration.words.filter((w) => w.secret).length === 0) {
            this.showError("Aspoň jedna tajnička musí byť vybraná!", () => {
                removeSpinnerFunction();
            });
            return;
        }

        for (let w of this.Configuration.words) {
            if (w.selected && (!w.secret || this.Configuration.type != 'H')) {
                let atLeastOneDefSelected = false;
                for (let def of this.Configuration.definitions.get(w.word)) {
                    if (def.selected) {
                        atLeastOneDefSelected = true;
                        break;
                    }
                }
                if (!atLeastOneDefSelected) {
                    this.showError(`Slovo ${w.word} musí mať aspoň 1 definíciu`, () => {
                        removeSpinnerFunction();
                    });
                    return;
                }
            }
        }

        this.Configuration.definitions = Array.from(this.Configuration.definitions);
        socket.emit("crossword::generate", this.Configuration.config);

        const self = this;
        socket.on("crossword::cannotBeGenerated", (msg) => {
            self.crosswordCannotBeGenerated(msg, () => {
                removeSpinnerFunction();
                this.Configuration.definitions = new Map(this.Configuration.definitions);
            });
        });
    }

    BODY = `
        <div class="container-fluid">
            <div class="row">
                <div class="col-2">
                    <div class="leftbox">
                        <nav class="nav">
                            <a id="nav_TC" class="a" style="margin-top: 7px;"><i class="fa-regular fa-keyboard"></i></a>
                            <a id="nav_CC" class="disabled a"><i class="fa fa-cog"></i></a>
                            <a id="nav_WC" class="disabled a"><i class="fa-solid fa-spell-check"></i></a>
                            <hr class="hr">
                            <div id="save_div" style="display: contents;"><a id="save_config" class="disabled a"><i class="fa-regular fa-floppy-disk"></i></a></div>
                            <div id="undo_div" style="display: contents;"><a id="undo_config" class="disabled a"><i class="fa-solid fa-rotate-left"></i></a></div>
                        </nav>
                        </div>
                </div>
                <div class="col-10 col-md-8" id="contents"></div>
            </div>
        </div>
        <div id="goodSmiley" style="visibility: hidden;" class="smiley__container--good">
            <div class="smiley__success-box">
                <div class="smiley__face">
                    <div class="smiley__eye"></div>
                    <div class="smiley__eye smiley__right"></div>
                    <div class="smiley__mouth smiley__happy"></div>
                </div>
                <div class="smiley__shadow smiley__scale"></div>
                <div class="smiley__message"><h1 class="smiley__alert smiley__h1">úspech!</h1><p id="goodSmileyMessage" class="smiley__p">Krížovka bola uložená</p></div>
                <button id="goodSmileyButton" class="smiley__button-box smiley__button" onclick="document.querySelector('div#goodSmiley').style.visibility = 'hidden';"><h1 class="smiley__green smiley__h1">pokračuj</h1></button>
                <div class="smiley__footer"><p>made by <a href="https://codepen.io/juliepark"> julie</a> ♡</div>
            </div>
        </div>
        <div id="badSmiley" style="visibility: hidden;" class="smiley__container--bad">
            <div class="smiley__error-box">
                <div class="smiley__error-smiley-box">
                    <div class="smiley__face2">
                        <div class="smiley__eye"></div>
                        <div class="smiley__eye smiley__right"></div>
                        <div class="smiley__mouth smiley__sad"></div>
                    </div>
                    <div class="smiley__shadow smiley__move"></div>
                </div>
                <div class="smiley__message"><h1 class="smiley__alert smiley__h1">CHYBA!</h1><p id="badSmileyMessage" class="smiley__p">správa</p></div>
                <button id="badSmileyButton" class="smiley__button-box smiley__button" onclick="document.querySelector('div#badSmiley').style.visibility = 'hidden';"><h1 class="smiley__red smiley__h1">pokračuj</h1></button>
                <div class="smiley__footer"><p>made by <a href="https://codepen.io/juliepark"> julie</a> ♡</div>
            </div>
        </div>
        <div id="wideBadSmiley" style="visibility: hidden;" class="smiley__container--bad--wide">
            <div class="smiley__error-box">
                <div class="smiley__error-smiley-box">
                    <div class="smiley__face2">
                        <div class="smiley__eye"></div>
                        <div class="smiley__eye smiley__right"></div>
                        <div class="smiley__mouth smiley__sad"></div>
                    </div>
                    <div class="smiley__shadow smiley__move"></div>
                </div>
                <div class="smiley__message"><h1 class="smiley__alert smiley__h1">CHYBA!</h1><p id="badSmileyMessage" class="smiley__p">Krížovka sa nedá vygenerovať!</p></div>
                <button id="wideBadSmileyButton1" class="wide-smiley__button-box-1 smiley__button" onclick="document.querySelector('div#wideBadSmiley').style.visibility = 'hidden';"><h1 class="smiley__red smiley__h1">použit slová z databázy</h1></button>
                <button id="wideBadSmileyButton2" class="wide-smiley__button-box-2 smiley__button" onclick="document.querySelector('div#wideBadSmiley').style.visibility = 'hidden';"><h1 class="smiley__red smiley__h1">zmeniť nastavenia</h1></button>
                <div class="smiley__footer"><p>made by <a href="https://codepen.io/juliepark"> julie</a> ♡</div>
            </div>
        </div>
    `
}

function useExistingConfig(conf) {
    if (conf.id === 0) {return;}
    conf.definitions = new Map(conf.definitions);
    const body = document.querySelector("div.body");
    new Config(conf, body);
}

function createNewConfig() {
    new Config({id: 0, words: null, definitions: null, type: 'U', numberOfWordsToUse: 10}, document.querySelector("div.body"));
}
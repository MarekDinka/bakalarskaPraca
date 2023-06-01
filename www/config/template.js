class Template {
    REMOVE_CELLS_MODE = 0;
    ADD_LETTER_CELLS_MODE = 1;


    constructor(body) {
        this.body = body;
        this.body.innerHTML = this.BODY;
        this.clickMode = this.REMOVE_CELLS_MODE;

        this.draw();
        const self = this;
        this.body.querySelector("button#crosswordHeightButton").addEventListener('click', (e) => {
            self.Configuration.changeHeight(self.body.querySelector("input#crosswordHeight").value);
            self.draw();
        });
        this.body.querySelector("button#crosswordWidthButton").addEventListener('click', (e) => {
            self.Configuration.changeWidth(self.body.querySelector("input#crosswordWidth").value);
            self.draw();
        });
        this.body.querySelector("button#saveButtonButton").addEventListener('click', function() {
            const spinner = self.makeALoaderOutOfMe(this);
            self.Configuration.save(() => {
                spinner.remove();
                this.classList.remove("remove");
            });
        });
        this.body.querySelector("input#two").addEventListener('change', function() {
            self.switchClickMode(this);
        });

        this.body.querySelector("input#crosswordCellColor").value = '#'+(Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');

        this.body.querySelector("input#crosswordBackgroundImage").addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file.type.match("image.*")) {
                return;
            }
            let fileReader = new FileReader();
            fileReader.readAsDataURL(file);
            fileReader.onload = function (){
                let box = self.body.querySelector("div#crossword_div");
                let res = fileReader.result;
                box.style.backgroundImage = `url('${res}')`;
                self.Configuration.backgroundImage = res;
                self.body.querySelector("#removeImageButton").disabled = false;
                self.body.querySelector("input#crosswordBackgroundImage").value = "";
            }
        });

        this.body.querySelector("#removeImageButton").addEventListener('click', () => {
            self.body.querySelector("div#crossword_div").style.backgroundImage = ``;
            self.body.querySelector("#removeImageButton").disabled = true;
            self.Configuration.backgroundImage = null;
        });

        let backgroundColorInput = this.body.querySelector("input#crosswordBackgroundColor");
        backgroundColorInput.addEventListener('change', (e) => {
            self.body.querySelector("div#crossword_div").style.backgroundColor = backgroundColorInput.value;
            self.Configuration.backgroundColor = backgroundColorInput.value;
        });

        let id = parseInt(get("id"));
        if (id > 0) {
            socket.emit("crossword::getTemplate", id, (template) => {
                this.Configuration.init(template);
                this.draw();
                if (template.backgroundImage !== null) {
                    const request = new XMLHttpRequest();
                    request.open('GET', template.backgroundImage, true);
                    request.responseType = 'blob';
                    request.onload = function() {
                        let fileReader = new FileReader();
                        fileReader.onload = function () {
                            let box = self.body.querySelector("div#crossword_div");
                            let res = fileReader.result;
                            box.style.backgroundImage = `url('${res}')`;
                            self.Configuration.backgroundImage = res;
                            self.body.querySelector("#removeImageButton").disabled = false;
                            self.body.querySelector("input#crosswordBackgroundImage").value = "";
                        }
                        fileReader.readAsDataURL(request.response);
                    }
                    request.send();
                }
            });
            this.draw();
        }
    }

    draw() {
        this.body.querySelector("div#crossword_div").style.backgroundColor = this.Configuration.backgroundColor;
        const HTMLbox = new DOMParser().parseFromString(`<div class="crossword__box"></div>`, "text/html").querySelector("div");
        for (let row of this.Configuration.template) {
            const HTMLrow = new DOMParser().parseFromString(`<div class="crossword__row"></div>`, "text/html").querySelector("div");
            for (let cell of row) {
                HTMLrow.appendChild(cell.draw());
            }
            HTMLbox.appendChild(HTMLrow);
        }
        const div = this.body.querySelector("#crossword_div");
        div.innerHTML = "";
        div.appendChild(HTMLbox);
    }

    clickOnACell(X, Y) {
        if (this.clickMode === this.REMOVE_CELLS_MODE) {
            this.Configuration.template[Y][X].changeHidden();
        } else if (this.clickMode === this.ADD_LETTER_CELLS_MODE) {
            this.Configuration.template[Y][X].changeLetterCellStatus();
        }
    }

    colorCell(X, Y) {
        this.Configuration.template[Y][X].changeColor(this.body.querySelector("input#crosswordCellColor").value);
    }

    switchClickMode(elem) {
        let label = this.body.querySelector("label#switchDivLabel");
        if (elem.checked) {
            label.innerHTML = "Pridávaj písmená";
            this.clickMode = this.ADD_LETTER_CELLS_MODE;
        } else {
            label.innerHTML = "Maž bunky";
            this.clickMode = this.REMOVE_CELLS_MODE;
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

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~CELL~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    Cell = class {
        static new(X, Y, self) {
            return new this(X, Y, self);
        }

        constructor(X, Y, self) {
            this.self = self;
            this.X = X;
            this.Y = Y;
            this.hidden = false;
            this.letterCell = false;
            this.color = "#FFFFFF";
        }

        changeHidden() {
            if (this.hidden) {
                this.self.body.querySelector(`#square_${this.X}_${this.Y}`).classList.replace("crossword__square--hidden", "crossword__square");
                this.self.body.querySelector(`#char_${this.X}_${this.Y}`).classList.replace("crossword__char--hidden", "crossword__char");
            } else {
                this.self.body.querySelector(`#square_${this.X}_${this.Y}`).classList.replace("crossword__square", "crossword__square--hidden");
                this.self.body.querySelector(`#char_${this.X}_${this.Y}`).classList.replace("crossword__char", "crossword__char--hidden");
            }
            this.hidden = !this.hidden;
        }

        changeLetterCellStatus() {
            if (this.letterCell) {
                this.self.body.querySelector(`#char_${this.X}_${this.Y}`).value = "";
            } else {
                this.self.body.querySelector(`#char_${this.X}_${this.Y}`).value = "?"
            }
            this.letterCell = !this.letterCell;
        }

        changeColor(newColor) {
            this.self.body.querySelector(`#char_${this.X}_${this.Y}`).style.background = newColor;
            this.color = newColor;
        }

        import(hidden, color, letterCell) {this.hidden = hidden; this.color = color; this.letterCell = letterCell}
        export() {return {hidden: this.hidden, color: this.color, letterCell: this.hidden ? false : this.letterCell}};

        draw() {
            const cell = new DOMParser().parseFromString(`
            <div id="square_${this.X}_${this.Y}" class="crossword__square${this.hidden ? `--hidden` : ``}">
                <input type="button" id="char_${this.X}_${this.Y}" class="crossword__char${this.hidden ? `--hidden` : ``} text-readable"
                    ${this.color === null ? `` : ` style="background-color: ${this.color};"`}
                    ${this.letterCell ? `value="?"` : ``}>
            </div>
            `, "text/html").querySelector("div");

            const input = cell.querySelector("input");
            const self = this;
            input.addEventListener('click', function() {
                self.self.clickOnACell(self.X, self.Y);
            });
            input.addEventListener('contextmenu', function() {
                self.self.colorCell(self.X, self.Y);
            });

            return cell;
        }
    };

//----------------------------------------------------------------------------------CELL----------------------------------------------------------------------------------------

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~CONFIG~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    Configuration = new class {
        DEFAULT_WIDTH = 10;
        DEFAULT_HEIGHT = 10;

        constructor(self) {
            this.self = self;
            this.backgroundImage = null;
            this.backgroundColor = "#FFFFFF";
            this.width = this.DEFAULT_WIDTH;
            this.height = this.DEFAULT_HEIGHT;
            this.template = [];
            for (let y = 0; y < this.height; y++) {
                this.template.push([]);
                for (let x = 0; x < this.width; x++) {
                    this.template[y].push(this.self.Cell.new(x, y, self));
                }
            }
        }

        init(config) {
            this.changeHeight(config.template.length);
            this.changeWidth(config.template.length > 0 ? config.template[0].length : 0);
            this.backgroundColor = config.backgroundColor;
            this.self.body.querySelector("input#crosswordBackgroundColor").value = config.backgroundColor;
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    this.template[y][x].import(config.template[y][x].hidden, config.template[y][x].color, config.template[y][x].letterCell);
                }
            }
        }

        save(callback) {
            let template = [];
            for (let y = 0; y < this.height; y++) {
                template.push(this.template[y].map((cell) => cell.export()));
            }
            socket.emit('crossword::saveTemplate', {backgroundImage: this.backgroundImage, backgroundColor: this.backgroundColor, template: template}, () => {
                this.self.body.querySelector('div#smiley').style.visibility = 'visible';
                callback();
            });
        }

        changeHeight(newHeight) {
            this.self.body.querySelector("input#crosswordHeight").value = newHeight;
            newHeight = parseInt(newHeight);
            if (this.height > newHeight) {
                this.template.splice(newHeight, this.height-newHeight);
            } else {
                for (let y = this.height; y < newHeight; y++) {
                    this.template.push([]);
                    for (let x = 0; x < this.width; x++) {
                        this.template[y].push(this.self.Cell.new(x, y, this.self));
                    }
                }
            }
            this.height = newHeight;
        }

        changeWidth(newWidth) {
            this.self.body.querySelector("input#crosswordWidth").value = newWidth;
            newWidth = parseInt(newWidth);
            for (let y = 0; y < this.height; y++) {
                if (this.width > newWidth) {
                    this.template[y].splice(newWidth, this.width-newWidth);
                } else {
                    for (let x = this.width; x < newWidth; x++) {
                        this.template[y].push(this.self.Cell.new(x, y, this.self));
                    }
                }
            }
            this.width = newWidth;
        }

    }(this);

//---------------------------------------------------------------------------------CONFIG---------------------------------------------------------------------------------------

    BODY = `
    <div class="container-fluid body">
            <div class="row">
                <div class="col-0 col-md-1"></div>
                <div class="col-12 col-md-10">
                    <div class="d-flex justify-content-center">
                        <h1 class="h1">Dizajn krížovky</h1>
                    </div>
                    <div class="box">
                        <div class="row" style="height: 100%;">
                            <div class="col-8 col-md-10" style="max-height: 100%;">
                                <div id="crossword_div" class="crossword" oncontextmenu="return false;">
                                </div>
                            </div>
                            <div class="col-4 col-md-2">
                                <div class="config__box px-1">
                                    <label class="py-2" for="crosswordHeight">Výška krížovky</label>
                                    <div class="input-group mb-1">
                                        <input type="number" id="crosswordHeight" value="10" class="form-control">
                                        <button class="btn button--no-expand--success" id="crosswordHeightButton" type="button"><i class="bi bi-check"></i></button>
                                    </div>
                                    <label class="py-2" for="crosswordHeight">Šírka krížovky</label>
                                    <div class="input-group mb-1">
                                        <input type="number" id="crosswordWidth" value="10" class="form-control">
                                        <button class="btn button--no-expand--success" id="crosswordWidthButton" type="button"><i class="bi bi-check"></i></button>
                                    </div>
                                    <hr class="hr">
                                    <label id="switchDivLabel" for="switchDiv">Maž bunky</label>
                                    <div id="switchDiv" class="switch">
                                        <label for="two" class="label">
                                            <div class="crossword__square--choose--removeSpace">
                                                <input type="button" disabled class="crossword__char--choose--removeSpace" value="">
                                            </div>
                                        </label>
                                        <input id="two" class="input" type="checkbox">
                                        <label for="two" class="slider"></label>
                                        <label for="two" class="label">
                                            <div class="crossword__square--choose--letterSpace">
                                                <input type="button" disabled class="crossword__char--choose--letterSpace" value="?">
                                            </div>
                                        </label>
                                    </div>
                                    <hr class="hr">
                                    <label class="py-2" for="crosswordCellColor">Zafarbi bunku krížovky</label>
                                    <input type="color" id="crosswordCellColor">
                                    <label class="py-2" for="crosswordCellColor"><i>(vyber farbu a klikni pravým tlačítkom na bunku)</i></label>
                                    <hr class="hr">
                                    <label class="py-2" for="crosswordBackgroundImage">Vyber obrázok ako pozadie</label>
                                    <input type="file" id="crosswordBackgroundImage">
                                    <button class="btn smol_button mt-2" disabled id="removeImageButton">Zruš obrázok</button>
                                    <hr class="hr">
                                    <label class="py-2" for="crosswordCellColor">Vyber farbu ako pozadie</label>
                                    <input type="color" id="crosswordBackgroundColor" value="#FFFFFF">
                                    <hr class="hr">
                                    <div id="saveButtonDiv"><button class="btn button" id="saveButtonButton">Ulož</button></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-0 col-md-1"></div>
            </div>
        </div>
        <div id="smiley" style="visibility: hidden;" class="smiley__container">
            <div class="smiley__success-box">
                <div class="smiley__face">
                    <div class="smiley__eye"></div>
                    <div class="smiley__eye smiley__right"></div>
                    <div class="smiley__mouth smiley__happy"></div>
                </div>
                <div class="smiley__shadow smiley__scale"></div>
                <div class="smiley__message"><h1 class="smiley__alert smiley__h1">Úspech!</h1><p class="smiley__p">Krížovka bola uložená</p></div>
                <button class="smiley__button-box smiley__button" onclick="document.querySelector('div#smiley').style.visibility = 'hidden';"><h1 class="smiley__green smiley__h1">pokračuj</h1></button>
                <div class="smiley__footer"><p>made by <a href="https://codepen.io/juliepark"> julie</a> ♡</div>
            </div>
        </div>`

}
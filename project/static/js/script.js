// CONSTANTS
const LETTERS_TO_POINTS = {
    "A": 1,
    "B": 3,
    "C": 3,
    "D": 2,
    "E": 1,
    "F": 4,
    "G": 2,
    "H": 4,
    "I": 1,
    "J": 8,
    "K": 5,
    "L": 1,
    "M": 3,
    "N": 1,
    "O": 1,
    "P": 3,
    "Q": 10,
    "R": 1,
    "S": 1,
    "T": 1,
    "U": 1,
    "V": 4,
    "W": 4,
    "X": 8,
    "Y": 4,
    "Z": 10,
    "-": 0,
    "": 0
}

const BOARD_ID = "board";
const NUM_WORDS = 4;
const WORD_LENGTH = 5;

// HELPER FUNCTIONS
function getWithDefault(obj, key, defaultValue) {
    return key in obj ? obj[key] : defaultValue;
}

function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        // Remove leading spaces and split into key-value
        const [key, value] = cookie.trim().split('=');
        if (key === name) {
            return decodeURIComponent(value); // Decode the cookie value
        }
    }
    return null; // Return null if the cookie is not found
}

function deleteAllCookies() {
    document.cookie.split(';').forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
}

// CLASSES
class Letter {
    // w: index of word, l: index of letter
    constructor(w, l, constraint, clickHandler, gameMode) {
        this.w = w;
        this.l = l;
        this.constraint = constraint;
        this.clickHandler = clickHandler;
        this.gameMode = gameMode;
        [this.textElement, this.pointsElement] = this.createTextElement();
        
        this.isSelected = false;
        this.tileElement = this.createTileElement(this.textElement, this.pointsElement, this.isSelected);
        
        this.currentLetter = "";
    }

    createTextElement() {
        const letterSpan = document.createElement('span');
        letterSpan.classList.add('letter-text');
        letterSpan.style.visibility = 'hidden';
        letterSpan.textContent = '';
        const pointSpan = document.createElement('span');
        pointSpan.classList.add('letter-points');
        pointSpan.visibility = 'hidden';
        pointSpan.textContent = '';

        return [letterSpan, pointSpan];
    }

    createTileElement(text_element, points_element, is_selected) {
        const div = document.createElement('div');
        div.appendChild(text_element);
        if (this.gameMode === "score") {
            div.appendChild(points_element);
        }
        div.classList.add('letter');
        
        if (is_selected) {
            div.classList.add('selected');
        }

        div.addEventListener('click', () => {
            this.clickHandler(this.w, this.l);
        });

        return div;
    }

    appendLetterElement(container) {
        container.appendChild(this.tileElement);
    }

    toggleIsSelected() {
        this.setIsSelected(!this.is_selected);
    }

    setIsSelected(value) {
        this.isSelected = value;
        if (value) {
            this.tileElement.classList.add('selected');
        } else {
            this.tileElement.classList.remove('selected');
        }
    }

    updateLetter(letter) {
        this.currentLetter = letter;
        this.textElement.textContent = letter;
        let points = LETTERS_TO_POINTS[letter];
        if (points == 0) {
            this.pointsElement.textContent = "";
        } else {
            this.pointsElement.textContent = points.toString();
        }
       
        this.textElement.style.visibility = 'visible';
        this.pointsElement.style.visibility = 'visible';
    }
    pause() {
        this.tileElement.classList.add('paused');
        this.textElement.style.visibility = 'hidden';
        this.pointsElement.style.visibility = 'hidden';
    }
    resume() {
        this.tileElement.classList.remove('paused');
        this.textElement.style.visibility = 'visible';
        this.pointsElement.style.visibility = 'visible';
    }

    isConstrained() {
        return this.constraint > 0;
    }

    isTopLeft() {
        return this.w === 0 && this.l === 0;
    }
}

class Word {
    // w: index of the word
    constructor(w, word, clickHandler, gameMode) {
        this.index = w;
        this.gameMode = gameMode;
        this.letters = [];
        this.isInvalid = false; // true if the word is not full or is a valid word
        this.initWord(word, clickHandler);
    }

    initWord(word, click_handler) {
        for (let l = 0; l < WORD_LENGTH; l++) {
            const letter = new Letter(this.index, l, word[l], click_handler, this.gameMode);
            this.letters.push(letter);
        }
    }

    appendWordElement(container) {
        this.letters.forEach((letter) => {
            letter.appendLetterElement(container);
        });
    }

    // some handy functions might live here,
    // like getting a word in string version from the letters
    isAllLettersFilled() {
        let all_letters_filled = true;
        this.letters.forEach(letter => {
            all_letters_filled = all_letters_filled && Boolean(letter.current_letter);
        });
        return all_letters_filled;
    }

    isBlank() {
        let is_blank = true;
        this.letters.forEach(letter => {
            is_blank = is_blank && letter.current_letter == "";
        });
        return is_blank;
    }

    getWordString() {
        let word = "";
        this.letters.forEach(letter => {
            if (letter.current_letter == "") {
                word = word + "-";
                return;
            }
            word = word + letter.current_letter;
        });
        return word.toLowerCase();
    }

    turnRed(w, constraint_symbol) {
        if (w != this.index) {
            // the only time we don't want to flash would be if the word is not the one that just got completed
            let word_contrains_constraint_symbol = false;
            this.letters.forEach(letter => {
                if (constraint_symbol != "-" && letter.constraint_symbol == constraint_symbol) {
                    word_contrains_constraint_symbol = true;
                }
            });
            if (!word_contrains_constraint_symbol) {
                return;
            }
        }
        this._turnRed();
    }
    _turnRed() {
        this.letters.forEach(letter => {
            letter.tileElement.classList.add('incorrect');
        });
        this.isInvalid = true;
    }
    
    clear(resetLetters) {
        this.letters.forEach(letter => {
            if (resetLetters) {
                letter.updateLetter("");
            }
            letter.element.classList.remove('incorrect');
        });
        this.isInvalid = false;
    }
}

class Board {
    constructor(manager, data, gameMode) {
        this.manager = manager;
        this.gameMode = gameMode;
        this.element = document.getElementById(BOARD_ID);
        this.words = [];
        this.selectedLetter = null;
        
        this.game_id = data["game_id"];
        this.constraints = data["constraints"];
        this.grid = data["grid"];
        this.accepted_words = new Set(data["words"]);
        this.num_possible_solutions = data["num_possible_solutions"];

        // constraints_to_letters
        this.initDataStructures();
        
        
        this.is_paused = false;
        this.game_has_started = false; // this will only ever be updated once, when the user makes their first click
        this.first_solution_found = false; // they are only timed for their first solution. then the timer stops
        this.total_seconds = 0;
        this.interval_id = null;
        this.timer_element = document.getElementById("timer");
        this.date_element = document.getElementById("date");
        this.playPauseButton = document.getElementById("play-pause-button");
        this.reportMissingWordButton = document.getElementById("report-missing-word-button");
        this.start_instructions_element = document.getElementById("start-message");
        this.initBoard(data["use_saved_game"]);
        this.pause(!data["use_saved_game"]);

        this.copyButton = document.getElementById("copy-results-button");
        this.copyResultsTimeout = null
    }

    initDataStructures() {
        this.constraintAssignments = []; // tracks the letter assigned to each constraint (colored tile)
        for (let i = 0; i < this.constraints.length; i++) {
            this.constraintAssignments.push("");
        }
        this.blackLetters = {}; // keys are black letters, values are the number of times they appear on the board
    }

    saveToCookie() {
        // write cookie for state of each word
        // e.g. word0=cloud;word1=--in-;...
        this.words.forEach((word, w) => {
            document.cookie = `word${w}=${word.getWordString()};path=/;max-age=${60 * 60 * 24}`;
        });
        document.cookie = `first_solution_found=${this.first_solution_found};path=/;max-age=${60 * 60 * 24}`;
    }

    isEmpty() {
        this.words.forEach(word => {
            if (!word.isBlank()) {
                return false;
            }
        });
        return true;
    }

    isFull() { 
        this.words.forEach(word => {
            if (!word.isAllLettersFilled()) {
                return false;
            }
        });
        return true;
    }

    updateTimerDisplay() {
        let minutes = Math.floor(this.total_seconds / 60).toString().padStart(2, '0');
        let seconds = (this.total_seconds % 60).toString().padStart(2, '0');
        this.timer_element.textContent = `${minutes}:${seconds}`;
    }

    startTimer() {
        this.interval_id = setInterval(() => {
            this.total_seconds++;
            // total_seconds cookie
            document.cookie = `total_seconds=${this.total_seconds};path=/;max-age=${60 * 60 * 24}`;
            this.updateTimerDisplay();
        }, 1000);
    }

    pauseTimer() {
        clearInterval(this.interval_id);
    }

    pause(initial = false) {
        if (this.is_paused || this.first_solution_found) {
            return;
        }
        this.timer_element.style.display = 'none';
        this.date_element.style.display = 'inline-block';
        this.pauseTimer();
        if (initial) {
            this.playPauseButton.textContent = "START GAME";
        } else {
            this.playPauseButton.textContent = "RESUME";
        }
        this.is_paused = true;
        // add the paused class to all of the letters
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.pause();
            });
        });
        for (let i = 65; i <= 90; i++) {
            let key_element = document.getElementById(`key-${String.fromCharCode(i)}`);
            if (key_element) {
                key_element.classList.add('paused-key');
            }
        }
        document.getElementById("refresh-key").classList.add('paused-key');
        document.getElementById("delete-key").classList.add('paused-key');
    }
    resume() {
        if (!this.is_paused || this.first_solution_found) {
            return;
        }
        this.timer_element.style.display = 'inline-block';
        this.date_element.style.display = 'none'
        this.startTimer();
        this.playPauseButton.textContent = "PAUSE";
        this.is_paused = false;
        // remove the paused class from all of the letters
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.resume();
            });
        });
        if (!this.game_has_started) {
            this.game_has_started = true;
            // need to switch the start message for the timer and get it rolling
        }
        for (let i = 65; i <= 90; i++) {
            let key_element = document.getElementById(`key-${String.fromCharCode(i)}`);
            if (key_element) {
                key_element.classList.remove('paused-key');
            }
        }
        document.getElementById("refresh-key").classList.remove('paused-key');
        document.getElementById("delete-key").classList.remove('paused-key');
    }

    handlePlayPauseClicked() {
        if (this.first_solution_found) {
            return;
        }
        if (this.is_paused) {
            // if there is no currently selected letter, select the first letter of the first word
            if (this.selectedLetter === null) {
                this.selectedLetter = this.words[0].letters[0];
                this.toggleSelected();
            }
            this.resume();
        } else {
            this.pause();
        }
    }

    initBoard(use_saved_game) {
        document.addEventListener('keydown', (event) => {
            console.log(event);
            this.handleKeyPressed(event);
        });
        for (let w = 0; w < NUM_WORDS; w++) {
            const word = new Word(w, this.grid[w], this.handleLetterClicked.bind(this), this.gameMode)
            this.words.push(word);
            word.appendWordElement(this.element);
        }
        
        this.constraints.forEach((letters, constraint) => {
            if (constraint === 0) {
                return;
            }
            letters.forEach((letter) => {
                this.words[letter[0]].letters[letter[1]].tileElement.classList.add(`c${constraint}`)
            });
        });

        if (use_saved_game) {
            this.loadSavedGame();
        } else {
            this.manager.resetCookie();
        }
    }


    loadSavedGame() {
        // load the saved words into a 2d array of characters
        let saved_words = [];
        for (let w = 0; w < NUM_WORDS; w++) {
            let word = [];
            getCookie(`word${w}`).split('').forEach((letter, i) => {
                if (letter != '-') {
                    word.push(letter.toUpperCase());
                } else {
                    word.push("");
                }
            });
            saved_words.push(word);
        }

        // populate constraintAssignments and blackLetters
        this.constraints.forEach((letters, constraint) => {
            if (constraint === 0) {
                // black letters
                letters.forEach((letter) => {
                    const value = this.words[letter[0]].letters[letter[1]].currentLetter;
                    if (value != "") {
                        this.blackLetters[value] = getWithDefault(this.blackLetters, value, 0) + 1;
                    }
                });
            } else {
                // constraints
                // only need one occurrence of the constraint letter to know its value
                const value = this.words[letters[0][0]][letters[0][1]].currentLetter;
                this.constraintAssignments[constraint - 1] = value; // constraint 1 is at index 0 of constraintAssignments...
            }
        });

        // update each letter with the saved letter
        saved_words.forEach((word, w) => {
            word.forEach((letter, l) => {
                this.words[w].letters[l].updateLetter(letter);
            });
        });


        // turn a word red if it is invalid. Will move this to the Word class later
        this.words.forEach(word => {
            if (word.isAllLettersFilled()) {
                let is_valid_word = this.accepted_words.has(word.getWordString());
                if (!is_valid_word) {
                    word._turnRed();
                } else {
                    word.clear(false);
                }
            }
        });
    

        this.game_has_started = true;
        this.first_solution_found = (getCookie("first_solution_found") == "true");
        
        // move this to the Manager class later
        // show the copy results button if the solution has been found
        if (this.first_solution_found) {
            this.copyButton.style.display = "inline-block";
            this.playPauseButton.style.display = "none";
            this.date_element.style.display = 'none';
            this.timer_element.style.display = 'inline-block';

        }
        
        this.total_seconds = parseInt(getCookie("total_seconds"));
        this.updateTimerDisplay();
    }

    deselectAll() {
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.setIsSelected(false);
            });
        });
    }

    toggleSelected() {
        this.deselectAll();
        this.selectedLetter.toggleIsSelected();
    }
    
    clearBoard() {  
        // clear all of the letters
        this.words.forEach((word) => {
            word.clear(true);
        });
        
        this.initDataStructures(); // reset the constraints and black letters
        
        // guarantee that the report missing word button is hidden
        this.reportMissingWordButton.style.display = "none";
        
        // reset the keyboard
        this.manager.resetKeyboard();

        this.saveToCookie();
    }

    handleKeyPressed(event) {
        if (event.keyCode == 2000 && !this.is_paused) {
            // special clear board case
            this.clearBoard();
            return;
        }
        if (this.selectedLetter === null || this.is_paused) {
            return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'r') {
            return;
        }
        if (event.keyCode == 32) {
            this.handleArrowKeyPressed(39)
        }
        if (event.keyCode >= 37 && event.keyCode <= 40) {
            this.handleArrowKeyPressed(event.keyCode);
            return;
        }
        if (event.keyCode >= 65 && event.keyCode <= 90) {
            this.handleLetterKeyPressed(event.keyCode);
            return;
        }
        if (event.keyCode == 8) {
            // backspace
            this.handleBackspacePressed();
            return;
        }
    }

    moveLeft() {
        let new_w = this.selectedLetter.w;
        let new_l = this.selectedLetter.l;
        new_l--;
        if (new_l < 0) {
            new_l = 4;
            if (new_w != 0) {
                this.moveUp();
                new_w = this.selectedLetter.w;
            }
        }
        this.selectedLetter = this.words[new_w].letters[new_l];
        this.updateKeyboard();
    }

    moveUp() {
        let new_w = this.selectedLetter.w;
        new_w--;
        if (new_w < 0) {
            new_w = 3;
        }
        this.selectedLetter = this.words[new_w].letters[this.selectedLetter.l];
        this.updateKeyboard();
    }

    moveRight() {
        let new_w = this.selectedLetter.w;
        let new_l = this.selectedLetter.l;
        new_l++;
        if (new_l > 4) {
            new_l = 0;
            this.moveDown();
            new_w = this.selectedLetter.w;
        }
        this.selectedLetter = this.words[new_w].letters[new_l];
        this.updateKeyboard();
    }

    moveDown() {
        let new_w = this.selectedLetter.w;
        new_w++;
        if (new_w > 3) {
            new_w = 0;
        }
        this.selectedLetter = this.words[new_w].letters[this.selectedLetter.l];
        this.updateKeyboard();
    }

    handleArrowKeyPressed(key) {
        switch (key) {
            case 37:
                this.moveLeft();
                break;
            case 38:
                this.moveUp();
                break;
            case 39:
                this.moveRight();
                break;
            case 40:
                this.moveDown();
                break;
        }
        // toggle new on
        this.toggleSelected();
    }

    // this gets called when the user uses their mouse to click on a letter to select it
    handleLetterClicked(w, l) {
        this.resume();
        let clicked_currently_selected = (this.selectedLetter !== null) && (w == this.selectedLetter.w && l == this.selectedLetter.l);
        this.deselectAll();
        this.selectedLetter = null;

        if (!clicked_currently_selected) {
            // toggle new on
            this.selectedLetter = this.words[w].letters[l];
            this.selectedLetter.toggleIsSelected();
        }
        this.updateKeyboard();
    }

    getSelectedConstrainedLetterPositions() {
        return this.constraints[this.selectedLetter.constraint];
    }

    // need two functions to answer two different questions
    // is the typed letter used by any constrained letters? (asked by wildcard tile)
    // if the typed letter used anywhere?

    flashLetters(positions) {
        positions.forEach(conflicting_letter => {
            let w = conflicting_letter[0];
            let l = conflicting_letter[1];
            this.words[w].letters[l].element.classList.add('conflict');
        });
        setTimeout(() => {
            positions.forEach(conflicting_letter => {
                let w = conflicting_letter[0];
                let l = conflicting_letter[1];
                this.words[w].letters[l].element.classList.remove('conflict');
            });
        }, 200);
    }

    flashConflictingConstrainedLetters(pressedLetter) {
        // if the pressedLetter is already assigned to a constraint, flash all other letters with that constraint
        this.constraintAssignments.forEach((letter, i) => {
            if (letter === pressedLetter) {
                let conflictingLetters = this.constraints[i + 1];
                this.flashLetters(conflictingLetters);
                return true;
            }
        });
        return false;
    }

    flashConflictingWildcardLetters(pressedLetter) {
        let conflictingLetters = [];
        this.constraints[0].forEach((letter) => {
            if (this.words[letter[0]].letters[letter[1]].currentLetter == pressedLetter) {
                conflictingLetters.push(letter);
            }
        });

        if (conflictingLetters.length === 0) {
            return false;
        }
        this.flashLetters(conflictingLetters);
        return true;

    }
    

    async handleLetterKeyPressed(key) {
        const pressedLetter = String.fromCharCode(key);
        // if the key is already the current letter, save a bunch of work and do nothing
        if (this.selectedLetter.current_letter === pressedLetter) {
            return;
        }
        
        // if the currently selected letter is constrained, update all letters with that same constraint
        if (this.selectedLetter.isConstrained()) {
            // check if there are conflicts, and if so, flash the conflicting letters
            if (this.flashConflictingConstrainedLetters(pressedLetter)) {
                return;
            }
            if (this.flashConflictingWildcardLetters(pressedLetter)) {
                return;
            }
            this.constraints[this.selectedLetter.constraint].forEach(letter => {
                this.words[letter[0]].letters[letter[1]].updateLetter(letter);
            });
            this.constraintAssignments[this.selectedLetter.constraint - 1] = pressedLetter;
        } else {
            // otherwise, just update the letter
            if (this.flashConflictingConstrainedLetters(pressedLetter)) {
                return;
            }
            let previousLetter = this.selectedLetter.current_letter;
            this.selectedLetter.updateLetter(pressedLetter);
            this.blackLetters[pressedLetter] = getWithDefault(this.blackLetters, String.fromCharCode(key), 0) + 1;
            this.blackLetters[previousLetter]--;
        }
        
        
        if (this.isSolutionFound()) {
            document.getElementById("copy-results-button").style.display = "inline-block";
            this.pauseTimer();
            this.playPauseButton.style.display = "none";
            this.deselectAll();
            this.selectedLetter = null;
            this.updateKeyboard();
            let delay_time = 100;
            // loop through the letters and add celebrate class
            await this.delayedForEach(this.words, (word) => {
                this.delayedForEach(word.letters, (letter) => {
                    letter.element.classList.add('celebrate');
                }, delay_time);
            }, delay_time);
            // loop through the letters and remove celebrate class
            await this.delayedForEach(this.words, (word) => {
                this.delayedForEach(word.letters, (letter) => {
                    letter.element.classList.remove('celebrate');
                }, delay_time);
            }, delay_time);
        } else {
            if (this.words[this.selectedLetter.w].is_invalid) {
                return;
            }
            if (this.isFull()) {
                this.moveRight();
            } else {
                while (this.selectedLetter.current_letter != "") {
                    this.moveRight();
                }
            }
            this.toggleSelected();
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async delayedForEach(array, callback, delayTime) {
        for (const item of array) {
            await callback(item);
            await this.delay(delayTime);
        }
    }

    handleBackspacePressed() {
        // backspace only produces motion if the current letter is empty
        if (this.selectedLetter.currentLetter === "") {
            if (this.isEmpty()) {
                this.moveLeft();
            } else {
                while (this.selectedLetter.currentLetter === "" && !this.selectedLetter.isTopLeft()) {
                    this.moveLeft();
                }
            }
            this.toggleSelected();
            return;
        }

        // update data structures
        if (this.selectedLetter.isConstrained()) {
            this.constraints[this.selectedLetter.constraint].forEach(letter => {
                this.words[letter[0]].letters[letter[1]].updateLetter("");
                this.words[letter[0]].clear(false);
            });
            this.constraintAssignments[this.selectedLetter.constraint - 1] = "";
        } else {
            this.blackLetters[this.selectedLetter.currentLetter]--;
            this.selectedLetter.updateLetter("");
            this.words[this.selectedLetter.w].clear(false);
        }
        
        this.saveToCookie();
        
        // update the report missing word button
        let numInvalid = 0;
        this.words.forEach(word => {        
            if (word.isInvalid) {
                numInvalid++;
            }
        });
        if (numInvalid) {
            if (numInvalid == 1) {
                this.reportMissingWordButton.textContent = "REPORT MISSING WORD";
            } else {
                this.reportMissingWordButton.textContent = "REPORT MISSING WORDS";
            }
        } else {
            this.reportMissingWordButton.style.display = "none";
            if (this.first_solution_found) {
                this.copyButton.style.display = "inline-block";
            }
        }
        this.updateKeyboard();
    }

    isSolutionFound() {
        let is_solution_found = true;
        let num_invalid_words = 0;
        // ensure all letters of the board are filled
        this.words.forEach(word => {
            // is_solution_found = is_solution_found && word.isAllLettersFilled();
            if (word.isAllLettersFilled()) {
                let is_valid_word = this.accepted_words.has(word.getWordString());
                if (!is_valid_word) {
                    // color the word red for a second
                    num_invalid_words++;
                    word.turnRed(this.selectedLetter.w, this.grid[this.selectedLetter.w][this.selectedLetter.l]);
                    is_solution_found = false;
                } else {
                    word.clear(false);
                }
                is_solution_found = is_solution_found && is_valid_word;
            } else {
                is_solution_found = false;
            }
        });
        if (is_solution_found) {
            this.first_solution_found = true; // can overwrite this only once
            this.reportMissingWordButton.style.display = "none";
            if (this.first_solution_found) {
                this.copyButton.style.display = "inline-block";
            } // feels redundant lol
        } else {
            if (num_invalid_words > 0) {
                if (num_invalid_words == 1) {
                    this.reportMissingWordButton.textContent = "REPORT MISSING WORD";
                    
                } else {
                    this.reportMissingWordButton.textContent = "REPORT MISSING WORDS";
                }
                this.reportMissingWordButton.style.display = "inline-block";
                this.copyButton.style.display = "none";
            } else {
                this.reportMissingWordButton.style.display = "none";
                if (this.first_solution_found) {
                    this.copyButton.style.display = "inline-block";
                }
            }
        }
        this.saveToCookie();
        return is_solution_found;
    }

    copyResults() {
        if (this.copyResultsTimeout) {
            clearTimeout(this.copyResultsTimeout);
        }
        const include_solution = this.copyButton.textContent != "COPY RESULTS!";
        let symbol_to_emoji_map = {
            '@': '🟥',
            '#': '🟧',
            '$': '🟨',
            '%': '🟦',
            '-': '⬛️'
        }
        let message = "constrainbow.com\n";
        message += `${this.game_id[0]}${this.game_id[1]}/${this.game_id[2]}${this.game_id[3]} | ${this.timer_element.textContent}\n`;
        this.grid.forEach((word) => {
            word.forEach((letter) => {
                message += symbol_to_emoji_map[letter];
            });
            message += "\n";
        });
        message += `${this.num_possible_solutions.toLocaleString()} solutions\n`;
        if (include_solution) {
            message += "\n"
            this.words.forEach((word) => {
                message += word.getWordString().toUpperCase() + "\n";
            });
            navigator.clipboard.writeText(message.trim()).then(() => {
                this.copyButton.textContent = "COPIED WITH SOLUTION!";
                this.copyResultsTimeout = setTimeout(() => {
                    this.copyButton.textContent = "COPY RESULTS!"
                }, 2000);
            });
        } else {
            navigator.clipboard.writeText(message.trim()).then(() => {
                this.copyButton.textContent = "COPIED! INCLUDE SOLUTION?";
                this.copyResultsTimeout = setTimeout(() => {
                    this.copyButton.textContent = "COPY RESULTS!"
                }, 5000);
            });
        }
    }

    // this function will be called when the user clicks the report missing word button
    // it reports **incorect** words to the server, that the user thinks are valid
    reportMissingWords() {
        let incorect_words = [];
        this.words.forEach(word => {
            if (word.is_invalid) {
                incorect_words.push(word.getWordString());
            }
        });
        this.reportMissingWordButton.textContent = "REPORTING...";
        fetch("/report-missing-word", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "words": incorect_words,
            })
        }).then(() => {
            this.reportMissingWordButton.textContent = "REPORTED!";
            setTimeout(() => {
                this.reportMissingWordButton.textContent = "REPORT MISSING WORD";
                this.reportMissingWordButton.style.display = "none";
                if (this.first_solution_found) {
                    this.copyButton.style.display = "inline-block";
                }
            }, 1000);
        });
    }
}

class Manager {
    constructor() {
        this.showHowToPlayIfFirstTime();
        this.fetchBoard().then(() => {
            this.addEventListeners();
        });
    }
    
    async fetchBoard() {
        this.game_id = document.getElementById("game-id").value;
        this.game_mode = "speed"; // can be speed or score. hard coded for now
        const response = await fetch(`/game?game-id=${this.game_id}`);
        const data = await response.json();
        
        document.getElementById("num-possible-solutions").textContent = data["num_possible_solutions"].toLocaleString();
        document.getElementById("loading-text").style.display = "none";
        
        this.board = new Board(this, data, this.game_mode);
    }

    addEventListeners() {
        // virtual keys
        document.querySelectorAll(".key").forEach((key) => {
            key.addEventListener("click", (e) => {
                const keyCode = e.target.getAttribute("data-key");
                document.dispatchEvent(
                    new KeyboardEvent("keydown", { keyCode })
                );
            });
        });

        // how to play overlay
        const howToPlayOverlay = document.getElementById("how-to-play-overlay");
        function showOverlay() {
            howToPlayOverlay.style.visibility = 'visible';
            this.board.pause();
        }
        document.getElementById("how-to-play-button").addEventListener("click", showOverlay);
        function closeOverlay() {
            howToPlayOverlay.style.visibility = 'hidden';
        }
        document.getElementById("close-button").addEventListener("click", closeOverlay);
        document.getElementById("got-it-button").addEventListener("click", closeOverlay);
        howToPlayOverlay.addEventListener("click", (event) => {
            if (event.target === howToPlayOverlay) {
                closeOverlay();
            }
        });

        // report missing word
        document.getElementById("report-missing-word-button").addEventListener("click", () => {
            this.board.reportMissingWords();
        });

        // play pause button
        document.getElementById("play-pause-button").addEventListener("click", () => {
            this.board.handlePlayPauseClicked();
        });

        // copy results button
        document.getElementById("copy-results-button").addEventListener("click", () => {
            this.board.copyResults();
        });
    }

    showHowToPlayIfFirstTime() {
        if (!localStorage.getItem("visited")) {
            document.getElementById("how-to-play-overlay").style.visibility = 'visible'; // Show instructions
            localStorage.setItem("visited", "true"); // Mark as visited
        }
    }

    resetKeyboard() {
        for (let i = 65; i <= 90; i++) {
            document.getElementById(`key-${String.fromCharCode(i)}`).classList.remove('unavailable');
        }
    }

    updateKeyboard() {
        this.resetKeyboard();
        
        if (this.board.selectedLetter === null) {
            return;
        }
        
        let unavailableLetters = [];
        if(this.board.selectedLetter.isConstrained()) {
            // must add the black letters too
            for (let letter in this.board.blackLetters) {
                if (this.board.blackLetters[letter] > 0) {
                    unavailableLetters.push(letter);
                }
            }
        }
        this.board.constraintAssignments.forEach((letter) => {
            if (letter != "") {
                unavailableLetters.push(letter);
            }
        });
        
        // for each of these letters, except the current letter if there if one, get the key element from the dom
        // and add the unavailable class to the key
        unavailableLetters.forEach(letter => {
            if (this.board.selectedLetter.current_letter != letter) {
                document.getElementById(`key-${letter}`).classList.add('unavailable');
            }
        });
    }

    

    resetCookie() {
        deleteAllCookies();
        document.cookie = `game_id=${this.game_id};path=/;max-age=${60 * 60 * 24}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Manager();
});

// TODO:
// update keyboard should be the responsibility of the manager
// fix the toggleSelected bs
// ditch symbols for constraints, and use array indexes
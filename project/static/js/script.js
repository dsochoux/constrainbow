const letters_to_points = {
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

class Letter {
    // w: index of word, l: index of letter
    constructor(w, l, constraint_symbol, click_handler) {
        // a Letter needs to know "who" is is. when clicked, it must
        // tell the board that it has been selected
        this.w = w;
        this.l = l;
        this.constraint_symbol = constraint_symbol;
        this.click_handler = click_handler;
        [this.text_element, this.points_element] = this.createTextElement();
        
        // the first letter of the first word will begin in the selected state
        // this.is_selected = (w == 0 && l == 0);
        this.is_selected = false;
        this.element = this.createLetterElement(this.text_element, this.points_element, this.is_selected);
        
        this.current_letter = "";
    }

    createTextElement() {
        const letter_span = document.createElement('span');
        letter_span.classList.add('letter-text');
        letter_span.style.visibility = 'hidden';
        letter_span.textContent = '';
        const point_span = document.createElement('span');
        point_span.classList.add('letter-points');
        point_span.visibility = 'hidden';
        point_span.textContent = '';

        return [letter_span, point_span];
    }

    createLetterElement(text_element, points_element, is_selected) {
        const div = document.createElement('div');
        div.appendChild(text_element);
        div.appendChild(points_element);
        div.classList.add('letter');
        
        if (is_selected) {
            div.classList.add('selected');
        }

        div.addEventListener('click', () => {
            this.click_handler(this.w, this.l);
        });

        return div;
    }

    appendLetterElement(container) {
        container.appendChild(this.element);
    }

    toggleIsSelected() {
        this.setIsSelected(!this.is_selected);
    }

    setIsSelected(value) {
        this.is_selected = value;
        if (value) {
            this.element.classList.add('selected');
        } else {
            this.element.classList.remove('selected');
        }
    }

    updateLetter(letter) {
        this.current_letter = letter;
        this.text_element.textContent = letter;
        let points = letters_to_points[letter];
        if (points == 0) {
            this.points_element.textContent = "";
        } else {
            this.points_element.textContent = points.toString();
        }
       
        this.text_element.style.visibility = 'visible';
        this.points_element.style.visibility = 'visible';
    }
    pause() {
        this.element.classList.add('paused');
        this.text_element.style.visibility = 'hidden';
        this.points_element.style.visibility = 'hidden';
    }
    resume() {
        this.element.classList.remove('paused');
        this.text_element.style.visibility = 'visible';
        this.points_element.style.visibility = 'visible';
    }
}

class Word {
    // w: index of the word
    constructor(w, grid, click_handler) {
        this.index = w;
        this.letters = [];
        this.is_invalid = false; // true if the word is not full or is a valid word
        this.initWord(click_handler, grid);
    }

    initWord(click_handler, grid) {
        for (let l = 0; l < 5; l++) {
            const letter = new Letter(this.index, l, grid[this.index][l], click_handler);
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
            letter.element.classList.add('incorrect');
        });
        this.is_invalid = true;
    }
    clearRed() {
        this.letters.forEach(letter => {
            letter.element.classList.remove('incorrect');
        });
        this.is_invalid = false;
    }
}

class Board {
    constructor(container_id, num_words, data) {
        this.element = document.getElementById(container_id);
        this.words = [];
        this.num_words = num_words;
        
        this.selected_w = null;
        this.selected_l = null;
        
        this.game_id = data["game_id"];
        this.constraints_to_positions = data["constraints"];
        this.grid = data["grid"];
        this.accepted_words = new Set(data["words"]);
        this.num_possible_solutions = data["num_possible_solutions"];
        // this is used to ensure that no constraints can be assigned the same letter
        this.constraints_to_letters = {}
        this.black_letters_count_map = {}
        
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

    writeBoardDataToCookie() {
        // want to save:
        // each of the four words (with dashes for empty letters)
        // the value of this.first_solution_found
        // the total_seconds
        // the game id

        // words cookies
        for (let w = 0; w < this.num_words; w++) {
            let word = this.words[w].getWordString();
            document.cookie = `word${w}=${word};path=/;max-age=${60 * 60 * 24}`;
        }
        // first_solution_found cookie
        document.cookie = `first_solution_found=${this.first_solution_found};path=/;max-age=${60 * 60 * 24}`;
    }

    getWithDefault(obj, key, defaultValue) {
        return key in obj ? obj[key] : defaultValue;
    }

    isEmpty() {
        let is_empty = true;
        this.words.forEach(word => {
            is_empty = is_empty && word.isBlank();
        });
        return is_empty;
    }
    isFull() { 
        let is_full = true;
        this.words.forEach(word => {
            is_full = is_full && word.isAllLettersFilled();
        });
        return is_full;
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
            if (this.selected_w == null && this.selected_l == null) {
                this.selected_w = 0;
                this.selected_l = 0;
                this.toggleSelected();
            }
            this.resume();
        } else {
            this.pause();
        }
    }

    initBoard(use_saved_game) {

        document.addEventListener('keydown', (event) => {
            this.keyPressed(event);
        });
        for (let w = 0; w < this.num_words; w++) {
            const word = new Word(w, this.grid, this.handleLetterClicked.bind(this))
            this.words.push(word);
            word.appendWordElement(this.element);
        }
        let constraint_to_class = {
            '@': 'c1',
            '#': 'c2',
            '$': 'c3',
            '%': 'c4'
        }
        for (let constraint in this.constraints_to_positions) {
            this.constraints_to_positions[constraint].forEach(constrained_letter => {
                let w = constrained_letter[0];
                let l = constrained_letter[1];
                this.words[w].letters[l].element.classList.add(constraint_to_class[constraint]);
            });
        }
        if (use_saved_game) {
            this.loadSavedGame();
        } else {
            // write gameid to cookie
            deleteAllCookies();
            document.cookie = `game_id=${this.game_id};path=/;max-age=${60 * 60 * 24}`;
        }
    }


    loadSavedGame() {
        // use the information in the cookie to put the board into the saved state
        // need to update the following:
        // convert words into a word grid
        let saved_words = []
        for (let w = 0; w < this.num_words; w++) {
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
        // this.words
        for (let w = 0; w < this.num_words; w++) {
            saved_words[w].forEach((letter, l) => {
                this.words[w].letters[l].updateLetter(letter);
            });
        }
        this.words.forEach(word => {
            // is_solution_found = is_solution_found && word.isAllLettersFilled();
            if (word.isAllLettersFilled()) {
                let is_valid_word = this.accepted_words.has(word.getWordString());
                if (!is_valid_word) {
                    // color the word red for a second
                    word._turnRed();
                } else {
                    word.clearRed();
                }
            }
        });
        // this.constraints_to_letters
        for (let constraint in this.constraints_to_positions) {
            // grab the first position of the constraint
            let w = this.constraints_to_positions[constraint][0][0];
            let l = this.constraints_to_positions[constraint][0][1];
            if (saved_words[w][l] != "") {
                this.constraints_to_letters[constraint] = saved_words[w][l];
            }
        }
        // this.black_letters_count_map
        for (let w = 0; w < this.num_words; w++) {
            for (let l = 0; l < 5; l++) {
                let symbol = this.grid[w][l];
                let letter = saved_words[w][l];
                if (symbol == "-" && letter != "") {
                    this.black_letters_count_map[letter] = this.getWithDefault(this.black_letters_count_map, letter, 0) + 1;
                }
            }
        }
        // this.game_has_started = true;
        this.game_has_started = true;
        // this.first_solution_found;
        this.first_solution_found = (getCookie("first_solution_found") == "true");
        // show the copy results button if the solution has been found
        if (this.first_solution_found) {
            document.getElementById("copy-results-button").style.display = "inline-block";
            this.playPauseButton.style.display = "none";
            this.date_element.style.display = 'none';
            this.timer_element.style.display = 'inline-block';

        }
        // this.total_seconds;
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
        this.words[this.selected_w].letters[this.selected_l].toggleIsSelected();
    }
    //
    clearBoard() {  
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.updateLetter("");
                letter.element.classList.remove('incorrect');
            });
            word.is_invalid = false;
        });
        this.constraints_to_letters = {}
        this.black_letters_count_map = {}
        this.reportMissingWordButton.style.display = "none";
        if (this.first_solution_found) {
            this.copyButton.style.display = "inline-block";
        }
        for (let i = 65; i <= 90; i++) {
            let key_element = document.getElementById(`key-${String.fromCharCode(i)}`);
            if (key_element) {
                key_element.classList.remove('unavailable');
            }
        }
        this.writeBoardDataToCookie();
    }

    updateKeyboard() {
        for (let i = 65; i <= 90; i++) {
            let key_element = document.getElementById(`key-${String.fromCharCode(i)}`);
            if (key_element) {
                key_element.classList.remove('unavailable');
            }
        }
        if (this.selected_w == null || this.selected_l == null) {
            // set all of the keys to be unselected
            return;
        }
        // we have to figure out which letters are unavailable to be played at
        // the selected letter, and update keyboard keys accordingly
        // if the selected key is constrained, no letters that are constrained or black can be used
        let unavailable_letters = [];
        if(this.selectedIsConstrained()) {
            // must add the black letters too
            for (let letter in this.black_letters_count_map) {
                if (this.black_letters_count_map[letter] > 0) {
                    unavailable_letters.push(letter);
                }
            }
        }
        for (let symbol in this.constraints_to_letters) {
            if (this.getWithDefault(this.constraints_to_letters, symbol, '') != '') {
                unavailable_letters.push(this.constraints_to_letters[symbol]);
            }
        }
        // for each of these letters, except the current letter if there if one, get the key element from the dom
        // and add the unavailable class to the key
        unavailable_letters.forEach(letter => {
            if (this.words[this.selected_w].letters[this.selected_l].current_letter != letter) {
                let key_element = document.getElementById(`key-${letter}`);
                if (key_element) {
                    key_element.classList.add('unavailable');
                }
            }
        });
        
    }

    keyPressed(event) {
        if (event.keyCode == 2000 && !this.is_paused) {
            // special clear board case
            this.clearBoard();
            return;
        }
        if (this.selected_w == null || this.selected_l == null || this.is_paused) {
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
        let new_w = this.selected_w;
        let new_l = this.selected_l;

        new_l--;
        if (new_l < 0) {
            new_l = 4;
            if (new_w != 0) {
                this.moveUp();
                new_w = this.selected_w;
            }
        }
        this.selected_w = new_w;
        this.selected_l = new_l;
        this.updateKeyboard();
    }

    moveUp() {
        let new_w = this.selected_w;
        new_w--;
        if (new_w < 0) {
            new_w = 3;
        }
        this.selected_w = new_w;
        this.updateKeyboard();
    }

    moveRight() {
        let new_w = this.selected_w;
        let new_l = this.selected_l;
        new_l++;
        if (new_l > 4) {
            new_l = 0;
            this.moveDown();
            new_w = this.selected_w;
        }
        this.selected_w = new_w;
        this.selected_l = new_l;
        this.updateKeyboard();
    }

    moveDown() {
        let new_w = this.selected_w;
        new_w++;
        if (new_w > 3) {
            new_w = 0;
        }
        this.selected_w = new_w;
        this.updateKeyboard();
    }

    handleArrowKeyPressed(key) {
        if (this.selected_w == null) {
            this.selected_w = 0;
        }
        if (this.selected_l == null) {
            this.selected_l = 0;
        }
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
        let clicked_currently_selected = (w == this.selected_w && l == this.selected_l);
        this.deselectAll();
        this.selected_w = null;
        this.selected_l = null;

        if (!clicked_currently_selected) {
            // toggle new on
            this.words[w].letters[l].toggleIsSelected();
            this.selected_w = w;
            this.selected_l = l;
        }
        this.updateKeyboard();
    }

    selectedIsConstrained() {
        if (this.selected_w == null || this.selected_l == null) {
            return false;
        }
        return (this.grid[this.selected_w][this.selected_l] != '-');
    }

    getSelectedConstrainedLetterPositions() {
        return this.constraints_to_positions[this.grid[this.selected_w][this.selected_l]];
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

    flashConflictingConstrainedLetters(key) {
        for (let constraint in this.constraints_to_letters) {
            if (this.constraints_to_letters[constraint] == String.fromCharCode(key)) {
                if (constraint != this.grid[this.selected_w][this.selected_l]) {
                    this.flashLetters(this.constraints_to_positions[constraint])
                    return true;
                } // don't do anything about conflict, since it is in conflict with itself. not doing anything is the same as a self update
                // do something visual to highlight all of the conflicting letters
            } // if we find that a symbol already is using that letter, return early
        } // go through the map mapping a constraint symbol to a letter
        return false;
    }

    flashConflictingWildcardLetters(key) {
        let conflicting_wildcard_letter_positions = [];
        this.words.forEach(word => {
            word.letters.forEach(letter => {
                if (this.grid[letter.w][letter.l] == "-" && letter.current_letter == String.fromCharCode(key)) {
                    conflicting_wildcard_letter_positions.push([letter.w, letter.l]);
                }
            });
        });
        if (conflicting_wildcard_letter_positions.length == 0) {
            return false;
        }
        this.flashLetters(conflicting_wildcard_letter_positions);
        return true;

    }
    

    async handleLetterKeyPressed(key) {
        if (this.words[this.selected_w].letters[this.selected_l].current_letter == String.fromCharCode(key)) {
            return;
        }
        // if the currently selected letter is constrained, update all letters with that same constraint
        if (this.selectedIsConstrained()) {
            if (this.flashConflictingConstrainedLetters(key)) {
                return;
            }
            if (this.flashConflictingWildcardLetters(key)) {
                return;
            }
            let constrained_letters = this.getSelectedConstrainedLetterPositions();
            constrained_letters.forEach(letter => {
                let w = letter[0];
                let l = letter[1];
                this.words[w].letters[l].updateLetter(String.fromCharCode(key));
            })
            this.constraints_to_letters[this.grid[this.selected_w][this.selected_l]] = String.fromCharCode(key);
        } else {
            // otherwise, just update the letter
            if (this.flashConflictingConstrainedLetters(key)) {
                return;
            }
            let old_letter = this.words[this.selected_w].letters[this.selected_l].current_letter;
            this.words[this.selected_w].letters[this.selected_l].updateLetter(String.fromCharCode(key));
            // update black letter count map
            this.black_letters_count_map[String.fromCharCode(key)] = this.getWithDefault(this.black_letters_count_map, String.fromCharCode(key), 0) + 1;
            this.black_letters_count_map[old_letter]--;
        }
        if (this.isSolutionFound()) {
            // document.getElementById('encouraging-message').textContent = "Way to go! 🎉 Keep finding more.";
            document.getElementById("copy-results-button").style.display = "inline-block";
            this.pauseTimer();
            this.playPauseButton.style.display = "none";
            this.deselectAll();
            this.selected_w = null;
            this.selected_l = null;
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
            // if the board is full, this will go forver
            if (this.words[this.selected_w].is_invalid) {
                return;
            }
            if (this.isFull()) {
                this.moveRight();
            } else {
                while (this.words[this.selected_w].letters[this.selected_l].current_letter != "") {
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
        let is_on_blank_letter = (this.words[this.selected_w].letters[this.selected_l].current_letter == "");
        if (this.selectedIsConstrained()) {
            let constrained_letters = this.getSelectedConstrainedLetterPositions();
            constrained_letters.forEach(letter => {
                let w = letter[0];
                let l = letter[1];
                this.words[w].letters[l].updateLetter("");
                this.words[w].clearRed();
            })
            this.constraints_to_letters[this.grid[this.selected_w][this.selected_l]] = '';
        } else {
            this.black_letters_count_map[this.words[this.selected_w].letters[this.selected_l].current_letter]--;
            this.words[this.selected_w].letters[this.selected_l].updateLetter("");
        }
        this.words[this.selected_w].clearRed();
        this.writeBoardDataToCookie();
        let num_invalid = 0;
        this.words.forEach(word => {        
            if (word.is_invalid) {
                num_invalid++;
            }
        });
        if (num_invalid) {
            if (num_invalid == 1) {
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
        if (this.selected_w == 0 && this.selected_l == 0) {
            return;
        }
        if (is_on_blank_letter) {
            // if the board is empty this will go forever
            if (this.isEmpty()) {
                this.moveLeft();
            } else {
                // TODO fix the double delete freeze
                while (this.words[this.selected_w].letters[this.selected_l].current_letter == "" && 
                    !(this.selected_w == 0 && this.selected_l == 0)) {
                    this.moveLeft();
                }
            }
            this.toggleSelected();
        } else {
            this.updateKeyboard();
        }
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
                    word.turnRed(this.selected_w, this.grid[this.selected_w][this.selected_l]);
                    is_solution_found = false;
                } else {
                    word.clearRed();
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
        this.writeBoardDataToCookie();
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

function deleteAllCookies() {
    // Get all cookies
    const cookies = document.cookie.split(';');

    // Loop through all cookies and delete each one
    cookies.forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
}

document.addEventListener('DOMContentLoaded', () => {

    let board = null;

    const overlay = document.getElementById("how-to-play-overlay");
    // const overlay = document.getElementById("win-overlay");
    const howToPlayButton = document.getElementById("how-to-play-button");
    const reportMissingWordButton = document.getElementById("report-missing-word-button");
    const closeButton = document.getElementById("close-button");
    const gotItButton = document.getElementById("got-it-button");
    const playPauseButton = document.getElementById("play-pause-button");
    // const keyboard = document.getElementById("keyboard-container");
    const keys = document.querySelectorAll(".key");

    // Function to simulate key events
    function triggerKeyEvent(keyCode) {
        const event = new KeyboardEvent("keydown", { keyCode });
        document.dispatchEvent(event);
    }

    // Add click event to each virtual key
    keys.forEach((key) => {
        key.addEventListener("click", (e) => {
            
            const keyValue = e.target.getAttribute("data-key");
            triggerKeyEvent(keyValue);
        });
    });

    // Show the overlay when the "How to Play" button is clicked
    howToPlayButton.addEventListener("click", () => {
        overlay.style.visibility = 'visible';
        board.pause();
    });

    reportMissingWordButton.addEventListener("click", () => {
        board.reportMissingWords();
        
        // console.log("reporting missing word");
    });

    // Hide the overlay when the "X" button is clicked
    closeButton.addEventListener("click", () => {
        overlay.style.visibility = 'hidden';
        // board.resume();
    });
    gotItButton.addEventListener("click", () => {
        overlay.style.visibility = 'hidden';
    });

    playPauseButton.addEventListener("click", () => {
        board.handlePlayPauseClicked();
    });


    // Optional: Hide the overlay if the user clicks outside the popup
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.style.visibility = 'hidden';
        }
    });

    const game_id = document.getElementById("game-id").value;
    
    let endpoint = "/game";
    
    if (game_id != "None") {    
        endpoint = endpoint + `?game-id=${game_id}`;
    }
    
    fetch(endpoint)
    .then(response => response.json())
    .then(data => {
        board = new Board('board', 4, data);
        // document.getElementById("num-valid-constraint-assignments").textContent = data["num_valid_constraint_assignments"].toLocaleString();
        document.getElementById("num-possible-solutions").textContent = data["num_possible_solutions"].toLocaleString();
        document.getElementById("loading-text").style.display = "none";
    });

    document.getElementById("copy-results-button").addEventListener("click", () => {
        board.copyResults();
    });

    // show the instructions to the user if they have not visited the site before
    if (!localStorage.getItem("visited")) {
        overlay.style.visibility = 'visible'; // Show instructions
        localStorage.setItem("visited", "true"); // Mark as visited
    }
    
});
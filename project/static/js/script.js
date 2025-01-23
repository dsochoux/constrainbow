class Letter {
    // w: index of word, l: index of letter
    constructor(w, l, constraint_symbol, click_handler) {
        // a Letter needs to know "who" is is. when clicked, it must
        // tell the board that it has been selected
        this.w = w;
        this.l = l;
        this.constraint_symbol = constraint_symbol;
        this.click_handler = click_handler;
        this.text_element = this.createTextElement();
        
        // the first letter of the first word will begin in the selected state
        // this.is_selected = (w == 0 && l == 0);
        this.is_selected = false;
        this.element = this.createLetterElement(this.text_element, this.is_selected);
        
        this.current_letter = "";
    }

    createTextElement() {
        const span = document.createElement('span');
        span.classList.add('text');
        span.style.visibility = 'hidden';
        span.textContent = '';
        return span;
    }

    createLetterElement(text_element, is_selected) {
        const div = document.createElement('div');
        div.appendChild(text_element);
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
        this.text_element.style.visibility = 'visible';
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
            word = word + letter.current_letter;
        });
        return word.toLowerCase();
    } // will only be called for full words, guaranteed

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
        
        this.constraints_to_positions = data["constraints"];
        this.grid = data["grid"];
        this.accepted_words = new Set(data["words"]);
        // this is used to ensure that no constraints can be assigned the same letter
        this.constraints_to_letters = {}
        this.black_letters_count_map = {}
        
        this.is_paused = false;
        this.game_has_started = false; // this will only ever be updated once, when the user makes their first click
        this.first_solution_found = false; // they are only timed for their first solution. then the timer stops
        this.total_seconds = 0;
        this.interval_id = null;
        this.timer_element = document.getElementById("timer");
        this.start_instructions_element = document.getElementById("start-message");
        this.initBoard();
        this.pause();

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
            this.updateTimerDisplay();
        }, 1000);
    }

    pauseTimer() {
        clearInterval(this.interval_id);
    }

    pause() {
        if (this.is_paused || this.first_solution_found) {
            return;
        }
        this.pauseTimer();
        this.is_paused = true;
        // add the paused class to all of the letters
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.element.classList.add('paused');
                letter.text_element.style.visibility = 'hidden';
            });
        });
        for (let i = 65; i <= 90; i++) {
            let key_element = document.getElementById(`key-${String.fromCharCode(i)}`);
            if (key_element) {
                key_element.classList.add('paused-key');
            }
        }
    }
    resume() {
        if (!this.is_paused || this.first_solution_found) {
            return;
        }
        this.start_instructions_element.style.display = 'none';
        this.timer_element.style.display = 'inline-block';
        this.startTimer();
        this.is_paused = false;
        // remove the paused class from all of the letters
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.element.classList.remove('paused');
                letter.text_element.style.visibility = 'visible';
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
    }

    handleTimerClicked() {
        if (this.first_solution_found) {
            return;
        }
        if (this.is_paused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    initBoard() {
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
            // for (let constrained_letter in this.constraints[constraint]) {
            //     console.log(constrained_letter);
                
            //     let w = constrained_letter[0];
            //     let l = constrained_letter[1];
            //     console.log(w);
            //     console.log(l);
                
            //     this.words[w].letters[l].element.classList.add(constraint_to_class[constraint]);
            // }
        }
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
        document.getElementById("how-to-play-button").style.display = "inline-block";
        document.getElementById("report-missing-word-button").style.display = "none";
        for (let i = 65; i <= 90; i++) {
            let key_element = document.getElementById(`key-${String.fromCharCode(i)}`);
            if (key_element) {
                key_element.classList.remove('unavailable');
            }
        }
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
        if (this.selected_w == null || this.selected_l == null || this.is_paused) {
            return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'r') {
            return;
        }
        if (event.keyCode == 2000) {
            // special clear board case
            this.clearBoard();
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
            document.getElementById("copy-results-span").style.display = "inline-block";
            this.pauseTimer();
            this.timer_element.classList.add('end-timer');
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
        let num_invalid = 0;
        this.words.forEach(word => {        
            if (word.is_invalid) {
                num_invalid++;
            }
        });
        if (num_invalid) {
            if (num_invalid == 1) {
                document.getElementById("report-missing-word-button").textContent = "report missing word";
            } else {
                document.getElementById("report-missing-word-button").textContent = "report missing words";
            }
        } else {
            document.getElementById("how-to-play-button").style.display = "inline-block";
            document.getElementById("report-missing-word-button").style.display = "none";
        }
        if (this.selected_w == 0 && this.selected_l == 0) {
            return;
        }
        if (is_on_blank_letter) {
            // if the board is empty this will go forever
            if (this.isEmpty()) {
                this.moveLeft();
            } else {
                let i = 0;
                // TODO fix the double delete freeze
                while (this.words[this.selected_w].letters[this.selected_l].current_letter == "" && 
                    !(this.selected_w == 0 && this.selected_l == 0)) {
                    this.moveLeft();
                    // i++;
                }
            }
            this.toggleSelected();
        } else {
            this.updateKeyboard();
        }
        
        // if (is_on_blank_letter) {
            
            
            
        // }
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
            document.getElementById("how-to-play-button").style.display = "inline-block";
            document.getElementById("report-missing-word-button").style.display = "none";
        } else {
            let one_invalid = false;
            this.words.forEach(word => {        
                if (word.is_invalid) {
                    one_invalid = true;
                }
            });
            if (num_invalid_words > 0) {
                document.getElementById("how-to-play-button").style.display = "none";
                if (num_invalid_words == 1) {
                    document.getElementById("report-missing-word-button").textContent = "report missing word";
                    
                } else {
                    document.getElementById("report-missing-word-button").textContent = "report missing words";
                }
                document.getElementById("report-missing-word-button").style.display = "inline-block";
            } else {
                document.getElementById("how-to-play-button").style.display = "inline-block";
                document.getElementById("report-missing-word-button").style.display = "none";
            }
        }
        return is_solution_found;
    }

    copyResults() {

        let symbol_to_emoji_map = {
            '@': '🟥',
            '#': '🟧',
            '$': '🟨',
            '%': '🟦',
            '-': '⬛️'
        }

        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Get the month (0-11), so add 1 and pad to 2 digits
        const day = String(date.getDate()).padStart(2, '0');
        let message = `CONSTRAINBOW ${month}/${day}\n${this.timer_element.textContent}\n`;
        // generate the emojis from the grid
        this.grid.forEach((word) => {
            word.forEach((letter) => {
                message += symbol_to_emoji_map[letter];
            });
            message += "\n";
        });
        navigator.clipboard.writeText(message.trim()).then(() => {
            document.getElementById("copy-results-button").textContent = "copied!";
            setTimeout(() => {
                document.getElementById("copy-results-button").textContent = "copy results 🎉"
            }, 1000);
        });
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
        document.getElementById("report-missing-word-button").textContent = "reporting...";
        fetch("/report-missing-word", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "words": incorect_words,
            })
        }).then(() => {
            document.getElementById("report-missing-word-button").textContent = "reported!";
            setTimeout(() => {
                document.getElementById("report-missing-word-button").textContent = "report missing words";
                document.getElementById("report-missing-word-button").style.display = "none";
                document.getElementById("how-to-play-button").style.display = "inline-block";
            }, 1000);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {

    let board = null;

    const overlay = document.getElementById("how-to-play-overlay");
    // const overlay = document.getElementById("win-overlay");
    const howToPlayButton = document.getElementById("how-to-play-button");
    const reportMissingWordButton = document.getElementById("report-missing-word-button");
    const closeButton = document.getElementById("close-button");
    const timerButton = document.getElementById("timer");
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

    timerButton.addEventListener("click", () => {
        board.handleTimerClicked();
    });


    // Optional: Hide the overlay if the user clicks outside the popup
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.style.visibility = 'hidden';
            // board.resume();
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
    
});
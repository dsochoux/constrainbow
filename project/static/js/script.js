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

    getWordString() {
        let word = "";
        this.letters.forEach(letter => {
            word = word + letter.current_letter;
        });
        return word.toLowerCase();
    } // will only be called for full words, guaranteed

    turnRed(w, constraint_symbol) {
        console.log("here!")
        // want to return early if we should not flash red
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
        // setTimeout(() => {
        //     this.letters.forEach(letter => {
        //         letter.element.classList.remove('conflict');
        //     });
        // }, 200);
    }
    clearRed() {
        this.letters.forEach(letter => {
            letter.element.classList.remove('incorrect');
        });
    }
}

class Board {
    constructor(container_id, num_words, data) {
        this.element = document.getElementById(container_id);
        this.words = [];
        this.num_words = num_words;
        
        this.selected_w = null;
        this.selected_l = null;
        
        this.constraints = data["constraints"];
        this.grid = data["grid"];
        this.accepted_words = new Set(data["words"]);
        console.log(this.accepted_words);
        // this is used to ensure that no constraints can be assigned the same letter
        this.constraints_to_letters = {
            '@': '',
            '#': '',
            '$': '',
            '%': ''
        }
        
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
        for (let constraint in this.constraints) {
            this.constraints[constraint].forEach(constrained_letter => {
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

    keyPressed(event) {
        
        if (this.is_paused) {
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
    }

    moveUp() {
        let new_w = this.selected_w;
        new_w--;
        if (new_w < 0) {
            new_w = 3;
        }
        this.selected_w = new_w;
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
    }

    moveDown() {
        let new_w = this.selected_w;
        new_w++;
        if (new_w > 3) {
            new_w = 0;
        }
        this.selected_w = new_w;
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
    }

    selectedIsConstrained() {
        if (this.selected_w == null || this.selected_l == null) {
            return false;
        }
        return (this.grid[this.selected_w][this.selected_l] != '-');
    }

    getSelectedConstrainedLetters() {
        return this.constraints[this.grid[this.selected_w][this.selected_l]];
    }

    async handleLetterKeyPressed(key) {
        // if the currently selected letter is constrained, update all letters with that same constraint
        if (this.selectedIsConstrained()) {
            // if the letter is already in use, return
            for (let constraint in this.constraints_to_letters) {
                if (this.constraints_to_letters[constraint] == String.fromCharCode(key)) {
                    if (constraint != this.grid[this.selected_w][this.selected_l]) {
                        this.constraints[constraint].forEach(conflicting_letter => {
                            let w = conflicting_letter[0];
                            let l = conflicting_letter[1];
                            this.words[w].letters[l].element.classList.add('conflict');
                        });
                        setTimeout(() => {
                            this.constraints[constraint].forEach(conflicting_letter => {
                                let w = conflicting_letter[0];
                                let l = conflicting_letter[1];
                                this.words[w].letters[l].element.classList.remove('conflict');
                            });
                        }, 200);
                        return;
                    } // don't do anything about conflict, since it is in conflict with itself. not doing anything is the same as a self update
                    // do something visual to highlight all of the conflicting letters
                } // if we find that a symbol already is using that letter, return early
            } // go through the map mapping a constraint symbol to a letter
            let constrained_letters = this.getSelectedConstrainedLetters();
            constrained_letters.forEach(letter => {
                let w = letter[0];
                let l = letter[1];
                this.words[w].letters[l].updateLetter(String.fromCharCode(key));
            })
            this.constraints_to_letters[this.grid[this.selected_w][this.selected_l]] = String.fromCharCode(key);
        } else {
            // otherwise, just update the letter
            this.words[this.selected_w].letters[this.selected_l].updateLetter(String.fromCharCode(key));
        }
        if (this.isSolutionFound()) {
            document.getElementById('encouraging-message').textContent = "Way to go! 🎉 Keep finding more.";
            document.getElementById("copy-results-span").style.display = "inline-block";
            this.pauseTimer();
            this.timer_element.classList.add('end-timer');
            this.deselectAll();
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
            while (this.words[this.selected_w].letters[this.selected_l].current_letter != "" && this.selected_l < 4) {
                this.moveRight();
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
            let constrained_letters = this.getSelectedConstrainedLetters();
            constrained_letters.forEach(letter => {
                let w = letter[0];
                let l = letter[1];
                this.words[w].letters[l].updateLetter("");
                this.words[w].clearRed();
            })
            this.constraints_to_letters[this.grid[this.selected_w][this.selected_l]] = '';
        } else {
            this.words[this.selected_w].letters[this.selected_l].updateLetter("");
        }
        this.words[this.selected_w].clearRed();
        if (this.selected_w == 0 && this.selected_l == 0) {
            return;
        }
        if (is_on_blank_letter) {
            while (this.words[this.selected_w].letters[this.selected_l].current_letter == "" && this.selected_l > 0) {
                this.moveLeft();
            }
            this.toggleSelected();
        }
        
        // if (is_on_blank_letter) {
            
            
            
        // }
    }

    isSolutionFound() {
        let is_solution_found = true;
        
        // ensure all letters of the board are filled
        this.words.forEach(word => {
            // is_solution_found = is_solution_found && word.isAllLettersFilled();
            if (word.isAllLettersFilled()) {
                let is_valid_word = this.accepted_words.has(word.getWordString());
                if (!is_valid_word) {
                    // color the word red for a second
                    word.turnRed(this.selected_w, this.grid[this.selected_w][this.selected_l]);
                    is_solution_found = false;
                    return;
                } else {
                    word.clearRed();
                }
                is_solution_found = is_solution_found && is_valid_word;
            } else {
                is_solution_found = false;
                return;
            }
        });
        if (is_solution_found) {
            this.first_solution_found = true; // can overwrite this only once
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
        navigator.clipboard.writeText(message.trim());
        document.getElementById("copy-results-button").textContent = "copied!"
    }
}

document.addEventListener('DOMContentLoaded', () => {

    let board = null;

    const overlay = document.getElementById("how-to-play-overlay");
    // const overlay = document.getElementById("win-overlay");
    const howToPlayButton = document.getElementById("how-to-play-button");
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
            console.log(keyValue);
            triggerKeyEvent(keyValue);
        });
    });

    // Show the overlay when the "How to Play" button is clicked
    howToPlayButton.addEventListener("click", () => {
        overlay.style.visibility = 'visible';
        board.pause();
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

    fetch('/game')
    .then(response => response.json())
    .then(data => {
        board = new Board('board', 4, data);
        // document.getElementById("num-valid-constraint-assignments").textContent = data["num_valid_constraint_assignments"].toLocaleString();
        document.getElementById("num-possible-solutions").textContent = data["num_possible_solutions"].toLocaleString();
        document.getElementById("loading-text").style.display = "none";
    });

    document.getElementById("copy-results-button").addEventListener("click", () => {
        board.copyResults();
        setTimeout(() => {
            document.getElementById("copy-results-button").textContent = "copy results"
        }, 1000);
    });
    
});
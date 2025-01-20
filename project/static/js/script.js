class Letter {
    // w: index of word, l: index of letter
    constructor(w, l, constraint_symbol, click_handler) {
        // a Letter needs to know "who" is is. when clicked, it must
        // tell the board that it has been selected
        this.w = w;
        this.l = l;
        this.constraint_symbol = constraint_symbol;
        this.click_handler = click_handler;
        this.textElement = this.createTextElement();
        
        // the first letter of the first word will begin in the selected state
        this.is_selected = (w == 0 && l == 0);
        this.element = this.createLetterElement(this.textElement, this.is_selected);
        
        this.current_letter = null;
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
        if (letter) {
            this.textElement.textContent = letter;
            this.textElement.style.visibility = 'visible';
        } else {
            // no need to overwrite the letterElement.textContent, just hide it
            // it will be overwritten before it is made visible again
            this.textElement.style.visibility = 'hidden';
        }
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

    flashRed(w, constraint_symbol) {
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
            letter.element.classList.add('conflict');
        });
        setTimeout(() => {
            this.letters.forEach(letter => {
                letter.element.classList.remove('conflict');
            });
        }, 200);
    }
}

class Board {
    constructor(container_id, num_words, data) {
        this.element = document.getElementById(container_id);
        this.words = [];
        this.num_words = num_words;
        
        this.selected_w = 0;
        this.selected_l = 0;
        
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

        this.initBoard();

    }

    pause() {
        this.is_paused = true;
    }
    resume() {
        this.is_paused = false;
    }

    initBoard() {
        document.addEventListener('keydown', (event) => {
            this.keyPressed(event)
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
                    if (constraint == this.grid[this.selected_w][this.selected_l]) {
                        this.moveRight();
                        this.toggleSelected();
                        return;
                    } // don't do anything about conflict, since it is in conflict with itself. not doing anything is the same as a self update
                    // do something visual to highlight all of the conflicting letters
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
                    }, 100);
                    return;
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
            document.getElementById('encouraging-message').textContent = "Way to go! Keep finding more.";
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
        }
        this.moveRight();
        this.toggleSelected();
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
            })
            this.constraints_to_letters[this.grid[this.selected_w][this.selected_l]] = '';
        } else {
            this.words[this.selected_w].letters[this.selected_l].updateLetter("");
        }
        if (this.selected_w == 0 && this.selected_l == 0) {
            return;
        }
        if (is_on_blank_letter) {
            this.moveLeft();
            this.toggleSelected();
        }
    }

    isSolutionFound() {
        let is_solution_found = true;
        
        // ensure all letters of the board are filled
        this.words.forEach(word => {
            // is_solution_found = is_solution_found && word.isAllLettersFilled();
            if (word.isAllLettersFilled()) {
                let is_valid_word = this.accepted_words.has(word.getWordString());
                if (!is_valid_word) {
                    is_solution_found = false;
                    // color the word red for a second
                    word.flashRed(this.selected_w, this.grid[this.selected_w][this.selected_l]);
                    return is_solution_found = false;
                }
                is_solution_found = is_solution_found && is_valid_word;
            }
            return is_solution_found = false;
        });
        return is_solution_found;
    }
}

document.addEventListener('DOMContentLoaded', () => {

    let board = null;

    const overlay = document.getElementById("overlay");
    const howToPlayButton = document.getElementById("how-to-play-button");
    const closeButton = document.getElementById("close-button");
    console.log(closeButton);

    // Show the overlay when the "How to Play" button is clicked
    howToPlayButton.addEventListener("click", () => {
        overlay.style.visibility = 'visible';
        board.pause();
    });

    // Hide the overlay when the "X" button is clicked
    closeButton.addEventListener("click", () => {
        overlay.style.visibility = 'hidden';
        board.resume();
    });

    // Optional: Hide the overlay if the user clicks outside the popup
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.style.visibility = 'hidden';
            board.resume();
        }
    });
    fetch('/game')
    .then(response => response.json())
    .then(data => {
        board = new Board('board', 4, data);
        document.getElementById("num-valid-constraint-assignments").textContent = data["num_valid_constraint_assignments"].toLocaleString();
        document.getElementById("num-possible-solutions").textContent = data["num_possible_solutions"].toLocaleString();
    });
});
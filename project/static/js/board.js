import { BOARD_ID, NUM_WORDS, WORD_LENGTH, getWithDefault, delayedForEach } from './helpers.js';
export class Board {
    constructor(manager, data) {
        this.manager = manager;
        this.element = document.getElementById("board");
        this.words = []; // list of Word objects
        this.selectedLetter = null; // the currently selected letter (Letter object)
        
        // a 2d array of points
        // each index in the outer array represents a constraint, and each point in the inner array
        // represents a letter that is constrained by that constraint
        // 0 is a special constraint that represents black letters
        // indexes 1 - 4 represent the constraints that are colored tiles
        this.constraints = data["constraints"];
        
        // another 2d array of points, representing the same thing as constraints
        // this array is 4 x 5, representing the 4 words and 5 letters in each word
        // each position in the array is an integer representing the constraint that the 
        // letter is constrained to
        // again, 0 is a special constraint that represents black letters
        // numbers 1 - 4 represent the constraints that are colored tiles
        this.grid = data["grid"];
        this.num_possible_solutions = data["num_possible_solutions"];

        // sets up this.constraintAssignments and this.blackLetters
        this.initDataStructures();
        
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

    isEmpty() {
        const nonEmptyWordExists = this.words.some(word => {
            return !word.isBlank();
        });
        return !nonEmptyWordExists;
    }

    isFull() { 
        const nonFullWordExists = this.words.some(word => {
            return !word.isAllLettersFilled();
        });
        return !nonFullWordExists;
    }

    isListeningForInput() {
        return this.selectedLetter !== null;
    }

    initBoard() {
        this.constraints.forEach((letters, constraint) => {
            if (constraint === 0) {
                return;
            }
            letters.forEach((letter) => {
                this.words[letter[0]].letters[letter[1]].tileElement.classList.add(`c${constraint}`)
            });
        });
    }

    syncDataStructures() {
        // refil data structures
        this.constraints.forEach((positions, constraint) => {
            if (constraint === 0) {
                // black letters
                positions.forEach((position) => {
                    const value = this.words[position[0]].letters[position[1]].value;
                    if (value != '') {
                        this.blackLetters[value] = getWithDefault(this.blackLetters, value, 0) + 1;
                    }
                });
            } else {
                // constraints
                // only need one occurrence of the constraint letter to know its value
                const value = this.words[positions[0][0]].letters[positions[0][1]].value;
                this.constraintAssignments[constraint - 1] = value; // constraint 1 is at index 0 of constraintAssignments...
            }
        });
    }


    loadSavedGame(prefix) {
        for (let w = 0; w < NUM_WORDS; w++) {
            const word = JSON.parse(localStorage.getItem(`${prefix}Word${w}`)) || [];
            word.forEach((letter, l) => {
                this.words[w].updateLetter(l, letter);
            });
        }
        this.syncDataStructures();
        if (this.isInSolvedState()) {
            this.manager.showCopyButton();
        }
        // the SpeedBoard class will handle the timer, and the ScoreBoard class will handle the points
    }

    resetLocalStorage(prefix) {
        for (let w = 0; w < NUM_WORDS; w++) {
            localStorage.removeItem(`${prefix}Word${w}`);
        }
    }

    deselectAll() {
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.setIsSelected(false);
            });
        });
    }

    clearBoard() {  
        // clear all of the letters
        this.words.forEach((word) => {
            word.clear(true);
        });
        this.initDataStructures(); // reset the constraints and black letters
        this.manager.resetKeyboard();
        this.manager.hideCopyButton();
    }

    handleKeyPressed(key) {
        if (key === "ArrowLeft") {
            this.moveLeft();
        }
        if (key === "ArrowUp") {
            this.moveUp();
        }
        if (key === "ArrowRight" || key === " ") {
            this.moveRight();
        }
        if (key === "ArrowDown") {
            this.moveDown();
        }
        if ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(key.toUpperCase())) {
            this.handleLetterKeyPressed(key.toUpperCase());
            return;
        }
        if (key === "Backspace") {
            this.handleBackspacePressed();
            return;
        }
        if (key === "Clear") {
            this.clearBoard();
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
        this.selectedLetter.setIsSelected(false);
        this.selectedLetter = this.words[new_w].letters[new_l];
        this.selectedLetter.setIsSelected(true);
        this.manager.updateKeyboard();
    }

    moveUp() {
        let new_w = this.selectedLetter.w;
        new_w--;
        if (new_w < 0) {
            new_w = 3;
        }
        this.selectedLetter.setIsSelected(false);
        this.selectedLetter = this.words[new_w].letters[this.selectedLetter.l];
        this.selectedLetter.setIsSelected(true);
        this.manager.updateKeyboard();;
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
        this.selectedLetter.setIsSelected(false);
        this.selectedLetter = this.words[new_w].letters[new_l];
        this.selectedLetter.setIsSelected(true);
        this.manager.updateKeyboard();
    }

    moveDown() {
        let new_w = this.selectedLetter.w;
        new_w++;
        if (new_w > 3) {
            new_w = 0;
        }
        this.selectedLetter.setIsSelected(false);
        this.selectedLetter = this.words[new_w].letters[this.selectedLetter.l];
        this.selectedLetter.setIsSelected(true);
        this.manager.updateKeyboard();
    }

    // this is the callback that a Letter object will call when it is clicked
    handleLetterClicked(w, l) {
        let didClickCurrentlySelected = false;
        if (this.selectedLetter !== null) {
            didClickCurrentlySelected = (w == this.selectedLetter.w && l == this.selectedLetter.l);
            this.selectedLetter.setIsSelected(false);
            this.selectedLetter = null;
        }

        if (!didClickCurrentlySelected) {
            // toggle new on
            this.selectedLetter = this.words[w].letters[l];
            this.selectedLetter.setIsSelected(true);
        }
        this.manager.updateKeyboard();
    }

    // need two functions to answer two different questions
    // is the typed letter used by any constrained letters? (asked by wildcard tile)
    // if the typed letter used anywhere?

    flashLetters(positions) {
        positions.forEach(conflicting_letter => {
            let w = conflicting_letter[0];
            let l = conflicting_letter[1];
            this.words[w].letters[l].tileElement.classList.add('conflict');
        });
        setTimeout(() => {
            positions.forEach(conflicting_letter => {
                let w = conflicting_letter[0];
                let l = conflicting_letter[1];
                this.words[w].letters[l].tileElement.classList.remove('conflict');
            });
        }, 200);
    }

    flashConflictingConstrainedLetters(pressedLetter) {
        const flashed = this.constraintAssignments.some((letter, i) => {
            if (letter === pressedLetter) {
                let conflictingLetters = this.constraints[i + 1];
                this.flashLetters(conflictingLetters);
                return true;
            }
        });
        return flashed;
    }

    flashConflictingWildcardLetters(pressedLetter) {
        let conflictingLetters = [];
        this.constraints[0].forEach((letter) => {
            if (this.words[letter[0]].letters[letter[1]].value == pressedLetter) {
                conflictingLetters.push(letter);
            }
        });
        
        this.flashLetters(conflictingLetters);
        return conflictingLetters.length > 0;
    }
    

    handleLetterKeyPressed(letter) {
        // if the key is already the current letter, save a bunch of work and do nothing
        if (this.selectedLetter.value === letter) {
            return;
        }
        
        if (this.selectedLetter.isConstrained()) {
            // check if there are conflicts, and if so, flash the conflicting letters
            if (this.flashConflictingConstrainedLetters(letter)) {
                return;
            }
            if (this.flashConflictingWildcardLetters(letter)) {
                return;
            }
            // update all of the tiles of the same constraint of the selected tile
            this.constraints[this.selectedLetter.constraint].forEach(position => {
                this.words[position[0]].updateLetter(position[1], letter);
            });
            // update the constraint assignment
            this.constraintAssignments[this.selectedLetter.constraint - 1] = letter;
        } else {
            // only need to check if a constrained tile is using the letter
            if (this.flashConflictingConstrainedLetters(letter)) {
                return;
            }
            this.blackLetters[this.selectedLetter.value]--;
            this.blackLetters[letter] = getWithDefault(this.blackLetters, letter, 0) + 1;
            this.words[this.selectedLetter.w].updateLetter(this.selectedLetter.l, letter);
        }
        
        if (!this.words[this.selectedLetter.w].isValid && this.words[this.selectedLetter.w].isAllLettersFilled()) {
            // if the letter addition caused a word to be invalid, do not move to the next letter
            return;
        }
        if (this.isFull()) {
            this.moveRight();
        } else {
            while (!this.selectedLetter.isBlank()) {
                this.moveRight();
            }
        }
        
        this.check();
    }

    handleBackspacePressed() {
        // backspace only produces motion if the current letter is blank
        if (this.selectedLetter.isBlank()) {
            if (this.isEmpty()) {
                this.moveLeft();
            } else {
                while (this.selectedLetter.isBlank() && !this.selectedLetter.isTopLeft()) {
                    this.moveLeft();
                }
            }
            return;
        }

        // a non blank letter was deleted
        if (this.selectedLetter.isConstrained()) {
            this.constraints[this.selectedLetter.constraint].forEach(position => {
                this.words[position[0]].updateLetter(position[1], '');
            });
            this.constraintAssignments[this.selectedLetter.constraint - 1] = "";
        } else {
            this.blackLetters[this.selectedLetter.value]--;
            this.words[this.selectedLetter.w].updateLetter(this.selectedLetter.l, '');
        }
        // clear the red color from the word (if it was red) without resetting the letters
        this.words[this.selectedLetter.w].clear(false);
        
        // // update the report missing word button
        // let numInvalid = 0;
        // this.words.forEach(word => {        
        //     if (word.isInvalid) {
        //         numInvalid++;
        //     }
        // });
        // if (numInvalid) {
        //     if (numInvalid == 1) {
        //         this.reportMissingWordButton.textContent = "REPORT MISSING WORD";
        //     } else {
        //         this.reportMissingWordButton.textContent = "REPORT MISSING WORDS";
        //     }
        // } else {
        //     this.reportMissingWordButton.style.display = "none";
        //     if (this.first_solution_found) {
        //         this.copyButton.style.display = "inline-block";
        //     }
        // }
        this.manager.updateKeyboard();
        this.manager.hideCopyButton();
    }

    handleSolutionFound() {
        this.celebrate();
        this.manager.showCopyButton();
        this.selectedLetter.setIsSelected(false);
        this.selectedLetter = null;
        this.manager.updateKeyboard();
    }

    isInSolvedState() {
        return this.words.every(word => {
            return word.isValid;
        });
    }

    check() {
        let numInvalidWords = 0;

        let isSolutionFound = true;
        this.words.forEach((word) => {
            if (!word.isValid) {
                numInvalidWords++;
                isSolutionFound = false;
            }
        });
        if (!isSolutionFound) {
            return;
        }
        
        // a solution was found!
        this.handleSolutionFound();
        
        // else {
        //     if (num_invalid_words > 0) {
        //         if (num_invalid_words == 1) {
        //             this.reportMissingWordButton.textContent = "REPORT MISSING WORD";
                    
        //         } else {
        //             this.reportMissingWordButton.textContent = "REPORT MISSING WORDS";
        //         }
        //         this.reportMissingWordButton.style.display = "inline-block";
        //         this.copyButton.style.display = "none";
        //     } else {
        //         this.reportMissingWordButton.style.display = "none";
        //         if (this.first_solution_found) {
        //             this.copyButton.style.display = "inline-block";
        //         }
        //     }
        // }
    }

    async celebrate() {
        const delayTime = 100;
        // loop through the letters and add celebrate class
        await delayedForEach(this.words, (word) => {
            delayedForEach(word.letters, (letter) => {
                letter.celebrate()
            }, delayTime);
        }, delayTime);
        // loop through the letters and remove celebrate class
        await delayedForEach(this.words, (word) => {
            delayedForEach(word.letters, (letter) => {
                letter.stopCelebrating()
            }, delayTime);
        }, delayTime);
    }

    getEmojiBoard() {
        const emojis = ['⬛️', '🟥', '🟧', '🟨', '🟦'];
        let boardString = "";
        this.grid.forEach((word) => {
            word.forEach((constraint) => {
                boardString += emojis[constraint];
            });
            boardString += "\n";
        });
        return boardString;
    }

    copyResults() {
        if (this.copyResultsTimeout) {
            clearTimeout(this.copyResultsTimeout);
        }
        let message = "constrainbow.com\n";
        message += `${this.manager.getFormatedDate()} | ${this.getMetric()}\n`;
        message += this.getEmojiBoard();
        message += `${this.num_possible_solutions.toLocaleString()} solutions\n`;
        const doIncludeSolution = this.copyButton.textContent !== 'COPY RESULTS!';
        if (doIncludeSolution) {
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

    // the manager will use this function when reporting missing words
    getInvalidWords() {
        let invalid_words = [];
        this.words.forEach(word => {
            if (word.isInvalid) {
                invalid_words.push(word.getWordString());
            }
        });
        return invalid_words;
    }

    // pause is called in the callback for showing the overlay
    // ScoreBoard does not have a pause method, so it inherits the empty method from Board
    // and SpeedBoard overrides the pause method
    pause() {
        return;
    }
}
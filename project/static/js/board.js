import { BOARD_ID, NUM_WORDS, WORD_LENGTH, getWithDefault, launchConfetti } from './helpers.js';
export class Board {
    constructor(manager, data) {
        this.manager = manager;
        this.element = document.getElementById("board");
        this.words = []; // list of Word objects
        this.confettiEmoji = data["emoji"] || []; // themed SOLVE days: emojis that fall instead of confetti
        this.selectedLetter = null; // the currently selected letter (Letter object)
        
        // both SpeedBoard and ScoreBoard will inherit this
        // for both, it is used to know when to send a solved board to the server for logging
        // SpeedBoard will also use it to know when to stop the timer
        this.isSolutionFound = false;
        
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
        this.manager.hideReportMissingWordButton();
        this.showItems();
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
            // off the left edge: go to the end of the row above, and from the top-left tile
            // all the way around to the last tile (the mirror of moveRight)
            new_l = 4;
            this.moveUp();
            new_w = this.selectedLetter.w;
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
    // clicking the tile that is already selected keeps it selected (it used to deselect it,
    // which silently swallowed the next key presses)
    handleLetterClicked(w, l) {
        this.selectLetter(this.words[w].letters[l]);
    }

    selectLetter(letter) {
        if (this.selectedLetter !== null) {
            this.selectedLetter.setIsSelected(false);
        }
        this.selectedLetter = letter;
        this.selectedLetter.setIsSelected(true);
        this.manager.updateKeyboard();
    }

    // selects the first empty tile in reading order; returns false if the board is full
    selectFirstBlank() {
        for (const word of this.words) {
            for (const letter of word.letters) {
                if (letter.isBlank()) {
                    this.selectLetter(letter);
                    return true;
                }
            }
        }
        return false;
    }

    // need two functions to answer two different questions
    // is the typed letter used by any constrained letters? (asked by wildcard tile)
    // if the typed letter used anywhere?

    flashLetters(positions) {
        positions.forEach(conflicting_letter => {
            let w = conflicting_letter[0];
            let l = conflicting_letter[1];
            this.words[w].letters[l].tileElement.classList.add('conflict');
            this.words[w].letters[l].shake();
        });
        setTimeout(() => {
            positions.forEach(conflicting_letter => {
                let w = conflicting_letter[0];
                let l = conflicting_letter[1];
                this.words[w].letters[l].tileElement.classList.remove('conflict');
            });
        }, 400);
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
    

    // returns true if the state of the board was changed, false otherwise
    handleLetterKeyPressed(letter) {
        // if the key is already the current letter, save a bunch of work and do nothing
        if (this.selectedLetter.value === letter) {
            return false;
        }
        
        if (this.selectedLetter.isConstrained()) {
            // check if there are conflicts, and if so, flash the conflicting letters
            if (this.flashConflictingConstrainedLetters(letter)) {
                return false;
            }
            if (this.flashConflictingWildcardLetters(letter)) {
                return false;
            }
            // update all of the tiles of the same constraint of the selected tile
            this.constraints[this.selectedLetter.constraint].forEach(position => {
                this.words[position[0]].updateLetter(position[1], letter);
            });
            this.popConstraint(this.selectedLetter);
            // update the constraint assignment
            this.constraintAssignments[this.selectedLetter.constraint - 1] = letter;
        } else {
            // only need to check if a constrained tile is using the letter
            if (this.flashConflictingConstrainedLetters(letter)) {
                return false;
            }
            this.blackLetters[this.selectedLetter.value]--;
            this.blackLetters[letter] = getWithDefault(this.blackLetters, letter, 0) + 1;
            this.words[this.selectedLetter.w].updateLetter(this.selectedLetter.l, letter);
            this.selectedLetter.pop();
        }
        
        if (this.words[this.selectedLetter.w].isValid || !this.words[this.selectedLetter.w].isAllLettersFilled()) {
            // if the letter addition caused a word to be invalid, do not move to the next letter
            if (this.isFull()) {
                this.moveRight();
            } else {
                while (!this.selectedLetter.isBlank()) {
                    this.moveRight();
                }
            }
        }
        return true;
    }

    handleBackspacePressed() {

        // on an empty tile, delete works like the left arrow key: it moves back one tile
        // (wrapping from the top-left tile to the last tile); on a filled tile it deletes the letter
        if (this.selectedLetter.isBlank()) {
            this.moveLeft();
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
        
        const numInvalidWords = this.getNumInvalidWords()
        if (numInvalidWords > 0) {
            this.manager.showReportMissingWordButton(numInvalidWords);
        } else {
            this.manager.hideReportMissingWordButton();
            this.showItems();
        }
        
        this.manager.updateKeyboard();
        this.manager.hideCopyButton();
    }

    handleSolutionFound() {
        if (!this.isSolutionFound) {
            // sent a post request to the server to log the solution
            this.manager.logBoard();
        }
        this.isSolutionFound = true;
        this.manager.recordResult();
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

    getNumInvalidWords() {
        let numInvalidWords = 0;
        this.words.forEach((word) => {
            if (word.isAllLettersFilled() && !word.isValid) {
                numInvalidWords++;
            }
        });
        return numInvalidWords;
    }

    // if any full word is not in the word list, swap the timer/score for the report missing words button
    // returns true if the button is showing
    showReportIfInvalidWords() {
        const numInvalidWords = this.getNumInvalidWords();
        if (numInvalidWords > 0) {
            this.hideItems();
            this.manager.showReportMissingWordButton(numInvalidWords);
            return true;
        }
        return false;
    }

    check() {
        if (this.showReportIfInvalidWords()) {
            return;
        }
        this.manager.hideReportMissingWordButton();
        this.showItems();
        if (!this.isInSolvedState()) {
            return;
        }
        // a solution was found!
        this.handleSolutionFound();
    }

    // when a color gets a letter, every tile of that color pops in at the same moment
    // (a staggered ripple was tried, but it made typing feel laggy)
    popConstraint(typedLetter) {
        this.constraints[typedLetter.constraint].forEach(position => {
            this.words[position[0]].letters[position[1]].pop();
        });
    }

    // a diagonal wave: each tile jumps and flashes its color, then confetti
    celebrate() {
        const delayTime = 70;
        this.words.forEach((word, w) => {
            word.letters.forEach((letter, l) => {
                letter.celebrate((w + l) * delayTime);
            });
        });
        setTimeout(() => launchConfetti(this.confettiEmoji), 350);
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
        let message = `constrainbow.com/${this.manager.gameMode}\n`;
        message += `${this.manager.getFormatedDate()} | ${this.getMetric(true)}${this.manager.getStreakText()}\n`;
        message += this.getEmojiBoard();
        message += `${this.num_possible_solutions.toLocaleString()} solutions\n`;
        const doIncludeSolution = this.copyButton.textContent !== 'COPY RESULTS!';
        if (doIncludeSolution) {
            message += "\n"
            this.getShareWords().forEach((word) => {
                message += word.toUpperCase() + "\n";
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

    getWordsList() {
        let words = [];
        this.words.forEach(word => {
            words.push(word.getWordString());
        });
        return words;
    }

    // the words "include solution" shares: the board as it is (ScoreBoard shares the board that earned
    // the day's best score instead)
    getShareWords() {
        return this.words.map(word => word.getWordString());
    }

    // pause is called in the callback for showing the overlay
    // ScoreBoard does not have a pause method, so it inherits the empty method from Board
    // and SpeedBoard overrides the pause method
    pause() {
        return;
    }
}
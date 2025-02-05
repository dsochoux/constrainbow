import { Letter } from './letter.js';
import { WORD_LENGTH } from './helpers.js';

export class Word {
    // w: index of the word
    constructor(w, manager) {
        this.index = w;
        this.manager = manager;
        this.letters = [];
        this.numFilledLetters = 0;
        this.isValid = false;
    }

    appendWordElement(container) {
        this.letters.forEach((letter) => {
            container.appendChild(letter.tileElement);
        });
    }

    // some handy functions might live here,
    // like getting a word in string version from the letters
    isAllLettersFilled() {
        const emptyLetterExists = this.letters.some(letter => {
            return letter.isBlank();
        });
        return !emptyLetterExists;
    }

    isBlank() {
        const filledLetterExists = this.letters.some(letter => {
            return !letter.isBlank();
        });
        return !filledLetterExists;
    }

    getWordString() {
        let word = '';
        this.letters.forEach(letter => {
            if (letter.value == '') {
                word = word + '-';
                return;
            }
            word = word + letter.value;
        });
        return word.toLowerCase();
    }

    turnRed() {
        this.letters.forEach(letter => {
            letter.tileElement.classList.add('incorrect');
        });
    }
    
    clear(resetLetters) {
        this.letters.forEach(letter => {
            if (resetLetters) {
                this.updateLetter(letter.l, '');
            }
            letter.tileElement.classList.remove('incorrect');
        });
    }

    // the board will update a letter via this function, so that the word
    // can keep track of its own state
    updateLetter(l, letter){
        // l: index of the letter
        if (letter !== '' && this.letters[l].isBlank()) {
            this.numFilledLetters++;
        } else if (letter === '' && !this.letters[l].isBlank()) {
            this.numFilledLetters--;   
        }
        this.letters[l].update(letter);
        if (this.numFilledLetters === WORD_LENGTH) {
            // this letter is completing the word, must check if it is a valid word
            if (this.manager.isValidWord(this.getWordString())) {
                this.isValid = true;
                this.clear(false);
            } else {
                this.isValid = false;
                this.turnRed();
            }
        } else {
            this.isValid = false;
            this.clear(false);
        }
    }
}
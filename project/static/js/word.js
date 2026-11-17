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

    // each word sits on its own strip (a "rail"), so it's clear that only the rows are words
    // the rail turns green when the row is a real word, and red when it's full but not a word
    appendWordElement(container) {
        this.rowElement = document.createElement('div');
        this.rowElement.classList.add('word-row');
        this.letters.forEach((letter) => {
            this.rowElement.appendChild(letter.tileElement);
        });
        container.appendChild(this.rowElement);
    }

    // CHECK ROW's answer, drawn around the whole row (so it reads as "this word", not "these letters"):
    // a green outline while the tiles hop, or a red outline while the row shakes
    showCheck(isRight) {
        const row = this.rowElement;
        clearTimeout(this.checkTimeout);
        row.classList.remove('check-right', 'check-wrong');
        void row.offsetWidth; // restarts the animation when the same row is checked again
        row.classList.add(isRight ? 'check-right' : 'check-wrong');
        if (isRight) {
            this.letters.forEach((letter, l) => letter.playAnimation('hop', l * 70));
        }
        this.checkTimeout = setTimeout(() => row.classList.remove('check-right', 'check-wrong'), 1200);
    }

    setRowState(state) {
        // state is 'valid', 'invalid', or '' for neither
        if (!this.rowElement) {
            return;
        }
        this.rowElement.classList.toggle('valid', state === 'valid');
        this.rowElement.classList.toggle('invalid', state === 'invalid');
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

    getWordList() {
        return this.letters.map(letter => {
            return letter.value;
        });
    }

    turnRed() {
        this.setRowState('invalid');
        this.letters.forEach(letter => {
            letter.tileElement.classList.add('incorrect');
            letter.shake();
        });
    }
    
    clear(resetLetters) {
        this.letters.forEach(letter => {
            if (resetLetters) {
                this.updateLetter(letter.l, '');
            }
            letter.tileElement.classList.remove('incorrect');
        });
        this.setRowState(this.isValid ? 'valid' : '');
    }

    // the board will update a letter via this function, so that the word
    // can keep track of its own state
    updateLetter(l, letter, prefix){
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
                this.clear(false); // also turns the rail green
            } else {
                this.isValid = false;
                this.turnRed();
            }
        } else {
            this.isValid = false;
            this.clear(false);
        }
        // write the updated word to local storage
        localStorage.setItem(`${prefix}Word${this.index}`, JSON.stringify(this.getWordList()));
    }
}
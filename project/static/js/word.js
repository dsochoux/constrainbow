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

    setRowState(state) {
        // state is 'valid', 'invalid', or '' for neither
        if (!this.rowElement) {
            return;
        }
        this.rowElement.classList.toggle('valid', state === 'valid');
        this.rowElement.classList.toggle('invalid', state === 'invalid');
        // easter eggs, for as long as the word is there: a row that spells SLANT leans like italic type,
        // and a row that spells ASKEW knocks its tiles crooked
        const word = state === 'valid' ? this.getWordString() : '';
        this.rowElement.classList.toggle('slant', word === 'slant');
        this.rowElement.classList.toggle('askew', word === 'askew');
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
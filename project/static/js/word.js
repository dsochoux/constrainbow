import { Letter } from './letter.js';
import { WORD_LENGTH } from './helpers.js';

export class Word {
    // w: index of the word
    constructor(w) {
        this.index = w;
        this.letters = [];
        this.isInvalid = false; // true if the word is not full or is a valid word
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
            letter.tileElement.classList.remove('incorrect');
        });
        this.isInvalid = false;
    }
}
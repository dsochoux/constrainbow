import { Word } from './word.js';
import { SpeedLetter } from './speedLetter.js';
import { WORD_LENGTH } from './helpers.js';

export class SpeedWord extends Word {
    constructor(w, word, clickHandler, manager) {
        super(w, manager);
        this.initWord(word, clickHandler);
    }

    initWord(word, clickHandler) {
        for (let l = 0; l < WORD_LENGTH; l++) {
            const letter = new SpeedLetter(this.index, l, word[l], clickHandler);
            this.letters.push(letter);
        }
    }

    pause() {
        this.letters.forEach((letter) => {
            letter.pause();
        });
    }

    resume() {
        this.letters.forEach((letter) => {
            letter.resume();
        });
    }
}
import { Word } from './word.js';
import { SpeedWord } from './speedWord.js';
import { SolveLetter } from './solveLetter.js';
import { SolveBoard } from './solveBoard.js';
import { WORD_LENGTH } from './helpers.js';

// a SpeedWord made of SolveLetters, saved under the SOLVE board's own keys (see SolveBoard.storagePrefix)
// (SpeedWord saves under "speedWord0"..., which would overwrite the daily speed game)
export class SolveWord extends SpeedWord {
    initWord(word, clickHandler) {
        for (let l = 0; l < WORD_LENGTH; l++) {
            const letter = new SolveLetter(this.index, l, word[l], clickHandler);
            this.letters.push(letter);
        }
    }

    updateLetter(l, letter) {
        Word.prototype.updateLetter.call(this, l, letter, SolveBoard.storagePrefix(this.manager));
    }
}

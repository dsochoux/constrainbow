import { Word } from './word.js';
import { SpeedWord } from './speedWord.js';
import { SolveLetter } from './solveLetter.js';
import { WORD_LENGTH } from './helpers.js';

// a SpeedWord made of SolveLetters, saved per puzzle under "solve{NN}Word0"...
// (SpeedWord saves under "speedWord0"..., which would overwrite the daily speed game)
export class SolveWord extends SpeedWord {
    initWord(word, clickHandler) {
        for (let l = 0; l < WORD_LENGTH; l++) {
            const letter = new SolveLetter(this.index, l, word[l], clickHandler);
            this.letters.push(letter);
        }
    }

    updateLetter(l, letter) {
        Word.prototype.updateLetter.call(this, l, letter, `solve${this.manager.gameId}`);
    }
}

import { Word } from './word.js';
import { SpeedWord } from './speedWord.js';
import { PlaytestLetter } from './playtestLetter.js';
import { WORD_LENGTH } from './helpers.js';

// a SpeedWord made of PlaytestLetters, saved per puzzle under "playtest{NN}Word0"...
// (SpeedWord saves under "speedWord0"..., which would overwrite the daily speed game)
export class PlaytestWord extends SpeedWord {
    initWord(word, clickHandler) {
        for (let l = 0; l < WORD_LENGTH; l++) {
            const letter = new PlaytestLetter(this.index, l, word[l], clickHandler);
            this.letters.push(letter);
        }
    }

    updateLetter(l, letter) {
        Word.prototype.updateLetter.call(this, l, letter, `playtest${this.manager.gameId}`);
    }
}

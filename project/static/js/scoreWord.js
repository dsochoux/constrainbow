import { Word } from "./word.js";
import { ScoreLetter } from "./scoreLetter.js";
import { WORD_LENGTH } from "./helpers.js";

export class ScoreWord extends Word {
    constructor(w, word, clickHandler, manager) {
        super(w, manager);
        this.initWord(word, clickHandler);
    }

    initWord(word, clickHandler) {
        for (let l = 0; l < WORD_LENGTH; l++) {
            const letter = new ScoreLetter(this.index, l, word[l], clickHandler);
            this.letters.push(letter);
        }
    }

    getPointValue() {
        let points = 0;
        this.letters.forEach(letter => {
            points += letter.pointValue;
        });
        return points;
    }
}
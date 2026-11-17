import { SpeedLetter } from "./speedLetter.js";

// a SOLVE tile: a SpeedLetter that can also be "given", meaning it starts filled in
// (or was filled by REVEAL) and can't be changed
export class SolveLetter extends SpeedLetter {
    constructor(w, l, constraint, clickHandler) {
        super(w, l, constraint, clickHandler);
        this.isGiven = false;
    }

    // locked by CHECK: the player's own letter, proven right (a right row, or a color one proved).
    // It can't be changed either, but keeps its normal look with a small ✓ in the corner
    setChecked() {
        this.isGiven = true;
        this.tileElement.classList.add('checked');
        const mark = document.createElement('span');
        mark.classList.add('letter-check');
        mark.textContent = '✓';
        this.tileElement.appendChild(mark);
    }

    // wasRevealed is true when the player used REVEAL, false for the puzzle's own letters
    setGiven(wasRevealed) {
        this.isGiven = true;
        this.tileElement.classList.add('given');
        if (wasRevealed) {
            this.tileElement.classList.add('revealed');
        }
    }
}

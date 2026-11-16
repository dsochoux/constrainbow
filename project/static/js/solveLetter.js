import { SpeedLetter } from "./speedLetter.js";

// a SOLVE tile: a SpeedLetter that can also be "given", meaning it starts filled in
// (or was filled by REVEAL) and can't be changed
export class SolveLetter extends SpeedLetter {
    constructor(w, l, constraint, clickHandler) {
        super(w, l, constraint, clickHandler);
        this.isGiven = false;
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

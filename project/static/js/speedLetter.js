import { Letter } from "./letter.js";

export class SpeedLetter extends Letter {
    constructor(w, l, constraint, clickHandler) {
        super(w, l, constraint, clickHandler);
        this.pause(); // start in the paused state
    }
    pause() {
        this.tileElement.classList.add('paused');
        this.textElement.style.visibility = 'hidden';
    }
    resume() {
        this.tileElement.classList.remove('paused');
        this.textElement.style.visibility = 'visible';
    }
}
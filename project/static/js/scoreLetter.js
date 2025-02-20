import { Letter } from './letter.js';
import { LETTERS_TO_POINTS } from './helpers.js';

export class ScoreLetter extends Letter {
    constructor(w, l, constraint, clickHandler) {
        super(w, l, constraint, clickHandler);
        this.pointsElement = this.createPointsElement();
        this.pointValue = 0;
        this.tileElement.appendChild(this.pointsElement);
    }

    createPointsElement() {
        // the points element is a span that will hold the point value of the letter
        const pointSpan = document.createElement('span');
        pointSpan.classList.add('letter-points');
        pointSpan.textContent = '';
        return pointSpan;
    }

    update(letter) {
        // update the points element
        this.pointValue = LETTERS_TO_POINTS[letter];
        if (this.pointValue == 0) {
            this.pointsElement.textContent = '';
        } else {
            this.pointsElement.textContent = this.pointValue.toString();
        }
        super.update(letter);
    }
}


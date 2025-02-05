import { Board } from './board.js';
import { ScoreWord } from './scoreWord.js';
import { NUM_WORDS } from './helpers.js';
export class ScoreBoard extends Board {
    constructor(manager, data) {
        super(manager, data);
        this.score = 0;
        this.scoreElement = document.getElementById("score");
        this.numPossiblePoints = data['num_possible_points'];
        this.initBoard(manager);
    }

    updateScoreDisplay() {
        this.scoreElement.textContent = `${this.score.toLocaleString()}/${this.numPossiblePoints.toLocaleString()} POINTS`;
    }

    initBoard(manager) {
        for (let w = 0; w < NUM_WORDS; w++) {
            const word = new ScoreWord(w, this.grid[w], this.handleLetterClicked.bind(this), manager);
            this.words.push(word);
            word.appendWordElement(this.element);
        }
        this.scoreElement.style.display = 'inline-block';
        this.updateScoreDisplay();
        this.manager.resumeKeyboard();
        super.initBoard();
    }

    handleLetterKeyPressed(letter) {
        super.handleLetterKeyPressed(letter);
        this.score = 0;
        this.words.forEach(word => {
            this.score += word.getPointValue();
        });
        this.updateScoreDisplay();
    }

    handleBackspacePressed() {
        super.handleBackspacePressed();
        this.score = 0;
        this.words.forEach(word => {
            this.score += word.getPointValue();
        });
        this.updateScoreDisplay();
    }

    clearBoard() {
        super.clearBoard();
        this.score = 0;
        this.updateScoreDisplay();
    }
}
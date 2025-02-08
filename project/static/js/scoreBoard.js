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

    getPointsFraction() {
        return `${this.score.toLocaleString()}/${this.numPossiblePoints.toLocaleString()}`;
    }

    updateScoreDisplay() {
        this.scoreElement.textContent = `${this.getPointsFraction()} POSSIBLE POINTS`;
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
        if (JSON.parse(localStorage.getItem('scoreGameId')) == this.manager.gameId) {
            this.loadSavedGame();
        } else {
            this.resetLocalStorage();
            localStorage.setItem('scoreGameId', JSON.stringify(this.manager.gameId));
        }
    }

    isListeningForInput(key) {
        if (key == "Clear") {
            return true;
        }
        return super.isListeningForInput();
    }
    
    calculateScore() {
        this.score = 0;
        this.words.forEach(word => {
            this.score += word.getPointValue();
        });
        this.updateScoreDisplay();
    }

    loadSavedGame() {
        super.loadSavedGame('score');
        this.calculateScore();
    }

    resetLocalStorage() {
        super.resetLocalStorage('score');
        localStorage.removeItem('scoreIsSolutionFound');
    }

    handleLetterKeyPressed(letter) {
        super.handleLetterKeyPressed(letter);
        this.calculateScore();
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
    
    handleSolutionFound() {
        localStorage.setItem("scoreIsSolutionFound", JSON.stringify(true));
        super.handleSolutionFound();
    }

    getMetric(doIncludeEmoji) {
        if (doIncludeEmoji) {
            return `🏆 ${this.getPointsFraction()}`;
        }
        return `${this.getPointsFraction()}`;
    }
}
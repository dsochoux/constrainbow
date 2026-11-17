import { Board } from './board.js';
import { ScoreWord } from './scoreWord.js';
import { NUM_WORDS, LETTERS_TO_POINTS } from './helpers.js';
export class ScoreBoard extends Board {
    constructor(manager, data) {
        super(manager, data);
        this.score = 0;
        this.scoreElement = document.getElementById("score");
        this.numPossiblePoints = data['num_possible_points'];
        // where progress is saved: 'score' for today's puzzle, its own prefix for an archive puzzle
        this.prefix = manager.storagePrefix;

        // the best board finished today, {points, words}: what COPY RESULTS shares
        this.dayBest = null;
        // after SHOW BEST: {final: {points, words}, best: {points, words}}. Today's score is then final
        // (final is dayBest at that moment), and the player can switch between their board and the best
        this.revealed = null;
        this.isShowingBest = false;
        this.showBestButton = document.getElementById('show-best-button');
        this.boardToggle = document.getElementById('board-toggle');
        this.yourBoardButton = document.getElementById('your-board-button');
        this.bestBoardButton = document.getElementById('best-board-button');
        this.bestBoardElement = document.getElementById('best-board');
        this.bestOverlay = document.getElementById('best-overlay');

        this.initBoard(manager);
        this.setUpShowBest();
        if (this.revealed) {
            this.buildBestBoard();
        }
        this.updateBestControls();
    }

    // ---- the day's best board, and SHOW BEST ----

    setUpShowBest() {
        this.showBestButton.addEventListener('click', () => this.askToShowBest());
        document.getElementById('best-cancel-button').addEventListener('click', () => this.hideBestOverlay());
        document.getElementById('best-confirm-button').addEventListener('click', () => this.showBest());
        this.bestOverlay.addEventListener('click', (event) => {
            if (event.target === this.bestOverlay) {
                this.hideBestOverlay();
            }
        });
        this.yourBoardButton.addEventListener('click', () => this.showView(false));
        this.bestBoardButton.addEventListener('click', () => this.showView(true));
    }

    saveDayBest() {
        this.dayBest = { points: this.score, words: this.words.map(word => word.getWordString()) };
        localStorage.setItem(`${this.prefix}DayBest`, JSON.stringify(this.dayBest));
    }

    // after SHOW BEST, today's score can't change (the manager checks this before saving stats)
    isScoreFinal() {
        return this.revealed !== null;
    }

    // SHOW BEST asks first, so nobody thinks finding one solution ends the game; a perfect score has
    // nothing left to find, so it doesn't ask
    askToShowBest() {
        if (this.dayBest.points >= this.numPossiblePoints) {
            this.showBest();
            return;
        }
        document.getElementById('best-confirm-score').textContent = this.dayBest.points.toLocaleString();
        document.getElementById('best-confirm-max').textContent = this.numPossiblePoints.toLocaleString();
        this.bestOverlay.style.visibility = 'visible';
    }

    hideBestOverlay() {
        this.bestOverlay.style.visibility = 'hidden';
    }

    async showBest() {
        this.hideBestOverlay();
        // the best solution is only sent now, so it can't be read from the page beforehand
        const response = await fetch(`/best-solution?game-id=${this.manager.gameId}`);
        if (!response.ok) {
            return;
        }
        this.revealed = { final: this.dayBest, best: await response.json() };
        localStorage.setItem(`${this.prefix}Revealed`, JSON.stringify(this.revealed));
        this.buildBestBoard();
        this.showView(true);
    }

    // a read-only copy of the board with the best solution in it, made of the same tiles as the real one
    buildBestBoard() {
        this.bestBoardElement.innerHTML = '';
        this.revealed.best.words.forEach((word, w) => {
            const row = document.createElement('div');
            row.classList.add('word-row', 'valid');
            word.toUpperCase().split('').forEach((letter, l) => {
                const tile = document.createElement('div');
                tile.classList.add('letter');
                if (this.grid[w][l] > 0) {
                    tile.classList.add(`c${this.grid[w][l]}`);
                }
                tile.innerHTML = `<span class="letter-text">${letter}</span><span class="letter-points">${LETTERS_TO_POINTS[letter]}</span>`;
                row.appendChild(tile);
            });
            this.bestBoardElement.appendChild(row);
        });
    }

    // shows the best board (read-only) or the player's own board
    showView(isBest) {
        this.isShowingBest = isBest;
        this.element.style.display = isBest ? 'none' : 'flex';
        this.bestBoardElement.style.display = isBest ? 'flex' : 'none';
        this.updateScoreDisplay();
        if (isBest) {
            if (this.selectedLetter !== null) {
                this.selectedLetter.setIsSelected(false);
                this.selectedLetter = null;
            }
            this.manager.pauseKeyboard();
        } else {
            this.manager.resumeKeyboard();
        }
        this.manager.updateKeyboard();
        this.updateBestControls();
    }

    // SHOW BEST once today's puzzle has been finished; the YOURS / BEST switch after that
    updateBestControls() {
        this.showBestButton.style.display = (this.dayBest && !this.revealed) ? 'inline-block' : 'none';
        this.boardToggle.style.display = this.revealed ? 'flex' : 'none';
        if (this.revealed) {
            this.yourBoardButton.textContent = `YOURS: ${this.revealed.final.points}`;
            this.bestBoardButton.textContent = `BEST: ${this.revealed.best.points}`;
            this.yourBoardButton.classList.toggle('active', !this.isShowingBest);
            this.bestBoardButton.classList.toggle('active', this.isShowingBest);
        }
    }

    getPointsFraction() {
        return `${this.score.toLocaleString()}/${this.numPossiblePoints.toLocaleString()}`;
    }

    updateScoreDisplay() {
        if (this.isShowingBest) {
            // the best board's points, in the same pill, so the switch doesn't move anything
            this.scoreElement.textContent = `${this.revealed.best.points.toLocaleString()}/${this.numPossiblePoints.toLocaleString()} POSSIBLE POINTS`;
            this.scoreElement.classList.remove('over');
            return;
        }
        this.scoreElement.textContent = `${this.getPointsFraction()} POSSIBLE POINTS`;
        // every letter on the board counts, even in unfinished rows, so the score can go past
        // the maximum; when it does, the pill turns red as a hint that something is off
        const isOver = this.score > this.numPossiblePoints;
        if (isOver && !this.scoreElement.classList.contains('over')) {
            this.scoreElement.classList.remove('shake');
            void this.scoreElement.offsetWidth; // restart the animation
            this.scoreElement.classList.add('shake');
        }
        this.scoreElement.classList.toggle('over', isOver);
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
        if (JSON.parse(localStorage.getItem(`${this.prefix}GameId`)) == this.manager.gameId) {
            this.loadSavedGame();
        } else {
            this.resetLocalStorage();
            localStorage.setItem(`${this.prefix}GameId`, JSON.stringify(this.manager.gameId));
        }
    }

    isListeningForInput(key) {
        if (this.isShowingBest) {
            return false; // the best board is read-only
        }
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
        this.isSolutionFound = JSON.parse(localStorage.getItem(`${this.prefix}IsSolutionFound`)) || false;
        super.loadSavedGame(this.prefix);
        this.calculateScore();
        this.dayBest = JSON.parse(localStorage.getItem(`${this.prefix}DayBest`));
        this.revealed = JSON.parse(localStorage.getItem(`${this.prefix}Revealed`));
        // finished before the day's best board was saved (before 2026-11-16): the board on screen is
        // the best one known
        if (!this.dayBest && this.isSolutionFound && this.isInSolvedState()) {
            this.saveDayBest();
        }
        // a saved invalid word should bring back the report button, not just the red row
        this.showReportIfInvalidWords();
    }

    resetLocalStorage() {
        super.resetLocalStorage(this.prefix);
        localStorage.removeItem(`${this.prefix}IsSolutionFound`);
        localStorage.removeItem(`${this.prefix}DayBest`);
        localStorage.removeItem(`${this.prefix}Revealed`);
    }

    handleLetterKeyPressed(letter) {
        if (super.handleLetterKeyPressed(letter)) {
            this.calculateScore();
            this.check();
        }
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
        localStorage.setItem(`${this.prefix}IsSolutionFound`, JSON.stringify(true));
        // a better board than any before it today becomes the one to share, until SHOW BEST
        if (!this.revealed && (!this.dayBest || this.score > this.dayBest.points)) {
            this.saveDayBest();
        }
        super.handleSolutionFound();
        this.updateBestControls();
    }

    // the score that's shared: the day's best (final after SHOW BEST), not whatever is on the board
    getSharePoints() {
        if (this.revealed) {
            return this.revealed.final.points;
        }
        return this.dayBest ? this.dayBest.points : this.score;
    }

    // "include solution" shares the board that earned the shared score
    getShareWords() {
        if (this.revealed) {
            return this.revealed.final.words;
        }
        return this.dayBest ? this.dayBest.words : super.getShareWords();
    }

    // what the stats keep for a finished day (a better score later the same day replaces it)
    getStatsResult() {
        return { points: this.score, max: this.numPossiblePoints };
    }

    // with the emoji: the share text (the day's best score); without: what's logged when the
    // puzzle is first solved (the board on screen)
    getMetric(doIncludeEmoji) {
        if (doIncludeEmoji) {
            return `🎯 ${this.getSharePoints().toLocaleString()}/${this.numPossiblePoints.toLocaleString()}`;
        }
        return `${this.getPointsFraction()}`;
    }

    hideItems() {
        this.scoreElement.style.display = 'none';
        this.copyButton.style.display = 'none';
        this.showBestButton.style.display = 'none';
        this.boardToggle.style.display = 'none';
    }

    showItems() {
        // timer, play/pause button, copy results button, report missing words button
        this.scoreElement.style.display = 'inline-block';
        if (this.isInSolvedState()) {
            this.copyButton.style.display = 'inline-block';
        }
        this.updateBestControls();
    }
}
import { Board } from './board.js';
import { SpeedBoard } from './speedBoard.js';
import { SolveWord } from './solveWord.js';
import { NUM_WORDS, formatTime } from './helpers.js';

// a SOLVE puzzle: one with a single solution (puzzles come from scripts/generate_unique.py)
// it plays like speed mode (timer, pause), plus:
//   - "given" letters that start filled in and can't be changed
//   - a REVEAL button: on a black tile it fills in that tile, on a colored tile the whole color
// progress is saved under its own keys, never the speed game's: the daily puzzle uses
// solveWord0-3 and solveState (the saved answer tells a new day's puzzle to start fresh), and each
// test-batch puzzle uses solveTest{NN}Word0-3 and solveTest{NN}State, so testers can move between them
export class SolveBoard extends SpeedBoard {
    constructor(manager, data) {
        super(manager, data); // calls this.initBoard below
        this.solution = data["solution"].map(word => word.toUpperCase());
        this.lockedPositions = [];   // [w, l] of every tile that is given or was revealed
        this.revealedPositions = []; // [w, l] of every tile filled by REVEAL
        this.blackReveals = 0;   // black tiles revealed
        this.colorReveals = 0;   // colors revealed
        this.revealedTiles = 0;  // tiles revealed in all (a color counts once per tile)
        this.revealButton = document.getElementById("reveal-button");
        this.revealButton.addEventListener('click', () => this.reveal());
        // CHECK (on the check-row branch, being tried out): says whether the selected row is right
        this.checks = 0;          // rows checked (checking the same unchanged row again is free)
        this.lastChecked = {};    // row -> the letters it had when it was last checked
        this.checkButton = document.getElementById("check-button");
        this.checkButton.addEventListener('click', () => this.checkRow());
        this.isTestPuzzle = this.manager.gameMode === 'solve-test';
        this.prefix = SolveBoard.storagePrefix(this.manager);
        this.stateKey = `${this.prefix}State`;
        this.givenPositions = data["givens"].map(([w, l]) => [w, l]);

        const state = this.loadSavedLetters();
        data["givens"].forEach(([w, l]) => this.lock(w, l, false));
        state.revealed.forEach(([w, l]) => this.lock(w, l, true));
        this.revealedPositions = state.revealed;
        this.restoreLockedLetters();
        this.restoreState(state);
        this.saveState(); // so the saved letters always have an answer to be checked against
    }

    // also used by SolveWord, which saves its letters under the same prefix
    static storagePrefix(manager) {
        if (manager.gameMode === 'solve-test') {
            return `solveTest${manager.gameId}`;
        }
        // another day's puzzle (/solve/day, or the archive) is saved under its own date, so the daily
        // game is untouched
        return (manager.gameMode === 'solve-day' || manager.isArchive) ? `solveDay${manager.gameId}` : 'solve';
    }

    // puts the saved letters back on the board, and returns the rest of the saved state
    loadSavedLetters() {
        const fresh = {
            elapsedSeconds: 0, blackReveals: 0, colorReveals: 0, revealedTiles: 0, revealed: [], solved: false
        };
        let state = JSON.parse(localStorage.getItem(this.stateKey));
        // if the puzzle behind this number was regenerated, the saved progress belongs to another
        // puzzle: throw it away
        if (state === null || state.answer !== this.solution.join('')) {
            localStorage.removeItem(this.stateKey);
            for (let w = 0; w < NUM_WORDS; w++) {
                localStorage.removeItem(`${this.prefix}Word${w}`);
            }
            state = fresh;
        }
        if (localStorage.getItem(`${this.prefix}Word0`) !== null) {
            this.initDataStructures(); // Board.loadSavedGame adds to these, so start from empty
            Board.prototype.loadSavedGame.call(this, this.prefix);
        }
        return state;
    }

    restoreState(state) {
        this.elapsedSeconds = state.elapsedSeconds;
        this.blackReveals = state.blackReveals;
        this.colorReveals = state.colorReveals;
        this.revealedTiles = state.revealedTiles;
        this.checks = state.checks || 0; // saves from before CHECK have none
        this.updateTimerDisplay();
        if (state.solved) {
            this.isSolutionFound = true;
            this.playPauseButton.style.display = 'none';
            this.revealButton.style.display = 'none';
            this.checkButton.style.display = 'none';
            this.isPaused = false;
            this.resumeLetters();
            this.manager.showCopyButton();
        } else if (this.elapsedSeconds > 0) {
            this.playPauseButton.textContent = "RESUME";
        }
    }

    saveState() {
        localStorage.setItem(this.stateKey, JSON.stringify({
            answer: this.solution.join(''), // to notice if this puzzle number gets a new puzzle
            elapsedSeconds: this.elapsedSeconds,
            blackReveals: this.blackReveals,
            colorReveals: this.colorReveals,
            revealedTiles: this.revealedTiles,
            checks: this.checks,
            revealed: this.revealedPositions,
            solved: this.isSolutionFound,
        }));
    }

    // the button says how many tiles a reveal would fill: "REVEAL 3" on a color with 3 tiles
    updateRevealButton() {
        const target = this.selectedLetter;
        let numTiles = 1;
        if (target !== null && target.isConstrained() && !target.isGiven) {
            numTiles = this.constraints[target.constraint].length;
        }
        this.revealButton.textContent = numTiles > 1 ? `REVEAL ${numTiles}` : "REVEAL";
    }

    // like SpeedBoard.initBoard, but with SolveWords and without loading or resetting the speed
    // game's saved progress
    initBoard(manager) {
        for (let w = 0; w < NUM_WORDS; w++) {
            const word = new SolveWord(w, this.grid[w], this.handleLetterClicked.bind(this), manager);
            this.words.push(word);
            word.appendWordElement(this.element);
        }
        this.timerElement.style.display = 'inline-block';
        this.playPauseButton.textContent = "START GAME";
        this.playPauseButton.style.display = 'inline-block';
        this.playPauseButton.addEventListener('click', () => {
            this.handlePlayPauseClicked();
        });
        Board.prototype.initBoard.call(this); // colors the tiles
    }

    lock(w, l, wasRevealed) {
        this.lockedPositions.push([w, l]);
        this.words[w].letters[l].setGiven(wasRevealed);
    }

    // puts the correct letter back on every locked tile (at the start, and after CLEAR)
    restoreLockedLetters() {
        this.lockedPositions.forEach(([w, l]) => {
            const letter = this.words[w].letters[l];
            const value = this.solution[w][l];
            if (letter.value === value) {
                return;
            }
            this.words[w].updateLetter(l, value);
            if (letter.isConstrained()) {
                this.constraintAssignments[letter.constraint - 1] = value;
            } else {
                this.blackLetters[value] = (this.blackLetters[value] || 0) + 1;
            }
        });
    }

    // the speed timer saves elapsedSeconds under the speed game's key; this one saves it with
    // the rest of this puzzle's state, so the daily speed game's timer is left alone
    startTimer() {
        this.intervalId = setInterval(() => {
            this.elapsedSeconds++;
            this.updateTimerDisplay();
            this.saveState();
        }, 1000);
    }

    pause() {
        super.pause();
        this.saveState();
    }

    handleLetterKeyPressed(letter) {
        if (this.selectedLetter.isGiven) {
            this.selectedLetter.shake();
            return false;
        }
        return super.handleLetterKeyPressed(letter);
    }

    handleBackspacePressed() {
        // a given letter can't be deleted, so delete just moves back one tile, like the left arrow
        if (this.selectedLetter.isGiven) {
            this.moveLeft();
            return;
        }
        super.handleBackspacePressed();
    }

    clearBoard() {
        super.clearBoard();
        this.restoreLockedLetters();
        this.manager.updateKeyboard();
    }

    // empties every tile holding letter, except locked ones and the tile at skip
    // (used before a reveal, so the revealed letter can't clash with anything)
    clearLetterElsewhere(letter, skip) {
        this.constraintAssignments.forEach((assigned, i) => {
            if (assigned === letter && i + 1 !== skip.constraint) {
                this.constraints[i + 1].forEach(([w, l]) => this.words[w].updateLetter(l, ''));
                this.constraintAssignments[i] = '';
            }
        });
        if (skip.isConstrained()) {
            // a color's letter can't be on any black tile either (black tiles may share letters
            // with each other, so revealing a black tile never needs this)
            this.constraints[0].forEach(([w, l]) => {
                const tile = this.words[w].letters[l];
                if (tile.value === letter && !tile.isGiven) {
                    this.blackLetters[letter]--;
                    this.words[w].updateLetter(l, '');
                }
            });
        }
    }

    // CHECK: whether the selected tile's row is exactly right, without saying which letters are wrong.
    // The row has to be full. Right: the row jumps; wrong: it flashes and shakes
    checkRow() {
        const target = this.selectedLetter;
        const word = target === null ? null : this.words[target.w];
        if (this.isPaused || this.isSolutionFound || word === null || !word.isAllLettersFilled()) {
            this.checkButton.classList.add('shake');
            setTimeout(() => this.checkButton.classList.remove('shake'), 400);
            return;
        }
        const letters = word.getWordString().toUpperCase();
        if (this.lastChecked[target.w] !== letters) {
            this.lastChecked[target.w] = letters;
            this.checks++;
            this.saveState();
        }
        if (letters === this.solution[target.w]) {
            word.letters.forEach((letter, l) => letter.celebrate(l * 70));
        } else {
            this.flashLetters(word.letters.map((letter) => [target.w, letter.l]));
        }
    }

    reveal() {
        const target = this.selectedLetter;
        if (this.isPaused || this.isSolutionFound || target === null || target.isGiven) {
            this.revealButton.classList.add('shake');
            setTimeout(() => this.revealButton.classList.remove('shake'), 400);
            return;
        }
        const value = this.solution[target.w][target.l];
        this.clearLetterElsewhere(value, target);
        if (target.isConstrained()) {
            this.constraints[target.constraint].forEach(([w, l]) => {
                this.words[w].updateLetter(l, value);
                this.lock(w, l, true);
                this.revealedPositions.push([w, l]);
            });
            this.constraintAssignments[target.constraint - 1] = value;
            this.popConstraint(target);
            this.colorReveals++;
            this.revealedTiles += this.constraints[target.constraint].length;
        } else {
            if (target.value !== '') {
                this.blackLetters[target.value]--;
            }
            this.blackLetters[value] = (this.blackLetters[value] || 0) + 1;
            this.words[target.w].updateLetter(target.l, value);
            this.lock(target.w, target.l, true);
            this.revealedPositions.push([target.w, target.l]);
            target.pop();
            this.blackReveals++;
            this.revealedTiles++;
        }
        this.saveState();
        this.check();
        if (!this.isSolutionFound) {
            this.selectFirstBlank();
            this.manager.updateKeyboard();
        }
    }

    // like SpeedBoard's, without writing speedIsSolutionFound
    handleSolutionFound() {
        this.playPauseButton.style.display = 'none';
        this.revealButton.style.display = 'none';
        this.checkButton.style.display = 'none';
        this.pauseTimer();
        Board.prototype.handleSolutionFound.call(this);
        this.saveState();
    }

    // what the stats keep for a finished day
    getStatsResult() {
        return { seconds: this.elapsedSeconds, reveals: this.revealedTiles, checks: this.checks };
    }

    // what the manager sends to /log-solve
    getSolveResult() {
        // remembers the answers this browser has solved, to flag a second solve of the same puzzle
        const key = `${this.prefix}Solved`;
        const answer = this.solution.join('');
        const replay = localStorage.getItem(key) === answer;
        localStorage.setItem(key, answer);
        return {
            'puzzle': this.manager.gameId,
            'mode': this.manager.gameMode,
            'seconds': this.elapsedSeconds,
            'black_reveals': this.blackReveals,
            'color_reveals': this.colorReveals,
            'revealed_tiles': this.revealedTiles,
            'checks': this.checks,
            'replay': replay ? 1 : 0,
            'words': this.getWordsList(),
        };
    }

    // the layout, plus where this player started and where they needed help:
    // ⬜ given letters (the same for everyone), 💡 tiles they revealed, colors and ⬛️ for the rest
    getEmojiBoard() {
        const emojis = ['⬛️', '🟥', '🟧', '🟨', '🟦'];
        const isAt = (positions, w, l) => positions.some(([pw, pl]) => pw === w && pl === l);
        let boardString = "";
        this.grid.forEach((word, w) => {
            word.forEach((constraint, l) => {
                if (isAt(this.givenPositions, w, l)) {
                    boardString += '⬜';
                } else if (isAt(this.revealedPositions, w, l)) {
                    boardString += '💡';
                } else {
                    boardString += emojis[constraint];
                }
            });
            boardString += "\n";
        });
        return boardString;
    }

    copyResults() {
        if (this.copyResultsTimeout) {
            clearTimeout(this.copyResultsTimeout);
        }
        const reveals = this.revealedTiles;
        const label = this.isTestPuzzle ? `SOLVE #${parseInt(this.manager.gameId, 10)}` : this.manager.getFormatedDate();
        const link = this.isTestPuzzle ? `constrainbow.com/solve/test?p=${parseInt(this.manager.gameId, 10)}` : this.manager.getShareLink();
        let message = `${link}\n`;
        message += `${label} | 🔑 ${formatTime(this.elapsedSeconds)} | ${reveals === 0 ? 'no reveals' : `${reveals} reveal${reveals === 1 ? '' : 's'}`}${this.checks > 0 ? ` | ${this.checks} check${this.checks === 1 ? '' : 's'}` : ''}${this.manager.getStreakText()}\n`;
        message += this.getEmojiBoard();
        navigator.clipboard.writeText(message.trim()).then(() => {
            this.copyButton.textContent = "COPIED!";
            this.copyResultsTimeout = setTimeout(() => {
                this.copyButton.textContent = "COPY RESULTS!";
            }, 2000);
        });
    }
}

import { Board } from './board.js';
import { SpeedWord } from './speedWord.js';
import { formatTime } from './helpers.js';
import { NUM_WORDS } from './helpers.js';

export class SpeedBoard extends Board {
    constructor(manager, data) {
        super(manager, data);
        this.isPaused = true; // timer runs while this is false
        this.elapsedSeconds = 0;
        this.intervalId = null;
        this.timerElement = document.getElementById("timer");
        this.playPauseButton = document.getElementById("play-pause-button");
        // where progress is saved: 'speed' for today's puzzle, its own prefix for an archive puzzle
        // (today's timer key has always been plain 'elapsedSeconds')
        this.prefix = manager.storagePrefix;
        this.elapsedKey = this.prefix === 'speed' ? 'elapsedSeconds' : `${this.prefix}ElapsedSeconds`;
        this.initBoard(manager);
    }

    initBoard(manager) {
        for (let w = 0; w < NUM_WORDS; w++) {
            const word = new SpeedWord(w, this.grid[w], this.handleLetterClicked.bind(this), manager)
            this.words.push(word);
            word.appendWordElement(this.element);
        }
        this.timerElement.style.display = 'inline-block';
        this.playPauseButton.textContent = "START GAME";
        this.playPauseButton.style.display = 'inline-block';
        this.playPauseButton.addEventListener('click', () => {
            this.handlePlayPauseClicked();
        });
        super.initBoard();
        // look into local storage for a saved game
        if (JSON.parse(localStorage.getItem(`${this.prefix}GameId`)) == this.manager.gameId) {
            this.loadSavedGame();
        } else {
            this.resetLocalStorage();
            localStorage.setItem(`${this.prefix}GameId`, JSON.stringify(this.manager.gameId));
        }
    }

    loadSavedGame() {
        super.loadSavedGame(this.prefix);
        // load timer and other things
        this.elapsedSeconds = JSON.parse(localStorage.getItem(this.elapsedKey)) || 0;
        this.updateTimerDisplay();
        this.isSolutionFound = JSON.parse(localStorage.getItem(`${this.prefix}IsSolutionFound`)) || false;
        if (this.isSolutionFound) {
            this.playPauseButton.style.display = 'none';
            this.isPaused = false;
        } else {
            if (this.elapsedSeconds === 0) {
                this.playPauseButton.textContent = "START GAME";
            } else {
                this.playPauseButton.textContent = "RESUME";
            }
            this.playPauseButton.style.display = 'inline-block';
        }
        if (this.isSolutionFound) {
            this.resumeLetters();
            this.manager.resumeKeyboard();
        }
    }

    resetLocalStorage() {
        super.resetLocalStorage(this.prefix);
        localStorage.removeItem(this.elapsedKey);
        localStorage.removeItem(`${this.prefix}IsSolutionFound`);
    }

    handleLetterClicked(w, l) {
        super.handleLetterClicked(w, l);
        if (this.isPaused) {
            this.resume();
        }
    }

    isListeningForInput(key) {
        // does not matter if a letter is selected, clearing can always be done when not paused
        if (key === "Clear") {
            return !this.isPaused;
        }
        return !this.isPaused && super.isListeningForInput();
    }

    updateTimerDisplay() {
        this.timerElement.textContent = formatTime(this.elapsedSeconds);
    }

    startTimer() {
        this.intervalId = setInterval(() => {
            this.elapsedSeconds++;
            // total_seconds cookie
            localStorage.setItem(this.elapsedKey, JSON.stringify(this.elapsedSeconds));
            this.updateTimerDisplay();
        }, 1000);
    }

    pauseTimer() {
        clearInterval(this.intervalId);
    }

    pause() {
        if (this.isPaused || this.isSolutionFound) {
            return;
        }
        this.pauseTimer();
        this.playPauseButton.textContent = "RESUME";
        this.isPaused = true;
        // add the paused class to all of the letters
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.pause();
            });
        });
        this.manager.pauseKeyboard();
    }
    resumeLetters() {
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.resume();
            });
        });
    }
    resume() {
        if (!this.isPaused || this.isSolutionFound) {
            return;
        }
        if (this.elapsedSeconds === 0) {
            this.manager.logEvent('start'); // the first START (SOLVE too, which inherits this)
        }
        this.startTimer();
        this.playPauseButton.textContent = "PAUSE";
        this.isPaused = false;
        this.resumeLetters();
        this.manager.resumeKeyboard();
        // a reloaded game starts paused with its letters hidden, so a saved invalid word
        // only brings back the report button once the letters are visible again
        this.showReportIfInvalidWords();
    }

    handleLetterKeyPressed(letter) {
        if (super.handleLetterKeyPressed(letter)) {
            this.check();
        }
    }

    handlePlayPauseClicked() {
        if (this.isSolutionFound) {
            return;
        }
        if (this.isPaused) {
            // if there is no currently selected letter, select the first empty tile
            if (this.selectedLetter === null && !this.selectFirstBlank()) {
                this.selectLetter(this.words[0].letters[0]);
            }
            this.resume();
        } else {
            this.pause();
        }
    }

    handleSolutionFound() {
        localStorage.setItem(`${this.prefix}IsSolutionFound`, JSON.stringify(true));
        this.playPauseButton.style.display = 'none';
        this.pauseTimer();
        super.handleSolutionFound();
    }


    // what the stats keep for a finished day
    getStatsResult() {
        return { seconds: this.elapsedSeconds };
    }

    // faster than every earlier daily speed puzzle in the stats (so never on the first one; archive
    // puzzles aren't in the stats, so they don't count)
    getTitleMessage() {
        const manager = this.manager;
        if (manager.isArchive || !manager.statsPopup) {
            return null;
        }
        const earlier = manager.stats.results('speed')
            .filter((result) => result.gameId !== manager.gameId)
            .map((result) => result.seconds);
        return earlier.length > 0 && this.elapsedSeconds < Math.min(...earlier) ? "QUICKESTTIME" : null;
    }

    // the same for the share text and the log (the mode's emoji is on the share text's first line)
    getMetric(isForShare) {
        return `${formatTime(this.elapsedSeconds)}`;
    }

    hideItems() {
        this.timerElement.style.display = 'none';
        this.playPauseButton.style.display = 'none';
        this.copyButton.style.display = 'none';
    }

    showItems() {
        // timer, play/pause button, copy results button, report missing words button
        this.timerElement.style.display = 'inline-block';
        if (!this.isSolutionFound) {
            this.playPauseButton.style.display = 'inline-block';
        } else if (this.isInSolvedState()) {
            this.copyButton.style.display = 'inline-block';
        }
    }
}
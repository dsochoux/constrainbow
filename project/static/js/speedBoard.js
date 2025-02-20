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
        if (JSON.parse(localStorage.getItem('speedGameId')) == this.manager.gameId) {
            this.loadSavedGame();
        } else {
            this.resetLocalStorage();
            localStorage.setItem('speedGameId', JSON.stringify(this.manager.gameId));
        }
    }

    loadSavedGame() {
        super.loadSavedGame('speed');
        // load timer and other things
        this.elapsedSeconds = JSON.parse(localStorage.getItem('elapsedSeconds')) || 0;
        this.updateTimerDisplay();
        this.isSolutionFound = JSON.parse(localStorage.getItem('speedIsSolutionFound')) || false;
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
        super.resetLocalStorage('speed');
        localStorage.removeItem('elapsedSeconds');
        localStorage.removeItem('speedIsSolutionFound');
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
            localStorage.setItem(`elapsedSeconds`, JSON.stringify(this.elapsedSeconds));
            this.updateTimerDisplay();
        }, 1000);
    }

    pauseTimer() {
        clearInterval(this.intervalId);
    }

    pause() {
        if (this.is_paused || this.isSolutionFound) {
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
        this.startTimer();
        this.playPauseButton.textContent = "PAUSE";
        this.isPaused = false;
        this.resumeLetters();
        this.manager.resumeKeyboard();
    }

    handleLetterKeyPressed(letter) {
        super.handleLetterKeyPressed(letter);
        this.check();
    }

    handlePlayPauseClicked() {
        if (this.isSolutionFound) {
            return;
        }
        if (this.isPaused) {
            // if there is no currently selected letter, select the first letter of the first word
            if (this.selectedLetter === null) {
                this.selectedLetter = this.words[0].letters[0];
                this.selectedLetter.setIsSelected(true);
            }
            this.resume();
        } else {
            this.pause();
        }
    }

    handleSolutionFound() {
        localStorage.setItem("speedIsSolutionFound", JSON.stringify(true));
        this.playPauseButton.style.display = 'none';
        this.pauseTimer();
        super.handleSolutionFound();
    }


    getMetric(doIncludeEmoji) {
        if (doIncludeEmoji) {
            return `⏱️ ${formatTime(this.elapsedSeconds)}`;
        }
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
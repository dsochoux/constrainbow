import { Board } from './board.js';
import { SpeedWord } from './speedWord.js';
import { formatTime } from './helpers.js';
import { NUM_WORDS } from './helpers.js';

export class SpeedBoard extends Board {
    constructor(manager, data) {
        super(manager, data);
        this.isPaused = true;
        this.hasStarted = false;
        this.isFirstSolutionFound = false; // timer runs while this is false
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
    }

    isListeningForInput() {
        return !this.isPaused && super.isListeningForInput();
    }

    updateTimerDisplay() {
        this.timerElement.textContent = formatTime(this.elapsedSeconds);
    }

    startTimer() {
        this.intervalId = setInterval(() => {
            this.elapsedSeconds++;
            // total_seconds cookie
            console.log("updating elapsed seconds in local storage");
            this.updateTimerDisplay();
        }, 1000);
    }

    pauseTimer() {
        clearInterval(this.intervalId);
    }

    pause() {
        if (this.is_paused || this.isFirstSolutionFound) {
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
    resume() {
        if (!this.isPaused || this.isFirstSolutionFound) {
            return;
        }
        this.startTimer();
        this.playPauseButton.textContent = "PAUSE";
        this.isPaused = false;
        // remove the paused class from all of the letters
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.resume();
            });
        });
        this.manager.resumeKeyboard();
    }

    handlePlayPauseClicked() {
        if (this.isFirstSolutionFound) {
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
        this.isFirstSolutionFound = true;
        this.playPauseButton.style.display = 'none';
        this.pauseTimer();
        super.handleSolutionFound();
    }


    getMetric() {
        return formatTime(this.elapsedSeconds);
    }
}
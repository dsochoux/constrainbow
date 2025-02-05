import { Board } from './board.js';
import { SpeedWord } from './speedWord.js';
import { formatTime } from './helpers.js';
import { NUM_WORDS } from './helpers.js';

export class SpeedBoard extends Board {
    constructor(manager, data) {
        super(manager, data);
        this.isPaused = false;
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
        super.initBoard();
    }

    isListeningForInput() {
        return !this.isPause && super.isListeningForInput();
    }

    updateTimerDisplay() {
        let minutes = Math.floor(this.total_seconds / 60).toString().padStart(2, '0');
        let seconds = (this.total_seconds % 60).toString().padStart(2, '0');
        this.timer_element.textContent = `${minutes}:${seconds}`;
    }

    startTimer() {
        this.interval_id = setInterval(() => {
            this.total_seconds++;
            // total_seconds cookie
            document.cookie = `total_seconds=${this.total_seconds};path=/;max-age=${60 * 60 * 24}`;
            this.updateTimerDisplay();
        }, 1000);
    }

    pauseTimer() {
        clearInterval(this.interval_id);
    }

    pause(initial = false) {
        if (this.is_paused || this.first_solution_found) {
            return;
        }
        this.timer_element.style.display = 'none';
        this.dateElement.style.display = 'inline-block';
        this.pauseTimer();
        if (initial) {
            this.playPauseButton.textContent = "START GAME";
        } else {
            this.playPauseButton.textContent = "RESUME";
        }
        this.is_paused = true;
        // add the paused class to all of the letters
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.pause();
            });
        });
        for (let i = 65; i <= 90; i++) {
            let key_element = document.getElementById(`key-${String.fromCharCode(i)}`);
            if (key_element) {
                key_element.classList.add('paused-key');
            }
        }
        document.getElementById("refresh-key").classList.add('paused-key');
        document.getElementById("delete-key").classList.add('paused-key');
    }
    resume() {
        if (!this.is_paused || this.first_solution_found) {
            return;
        }
        this.timer_element.style.display = 'inline-block';
        this.dateElement.style.display = 'none'
        this.startTimer();
        this.playPauseButton.textContent = "PAUSE";
        this.is_paused = false;
        // remove the paused class from all of the letters
        this.words.forEach((word) => {
            word.letters.forEach((letter) => {
                letter.resume();
            });
        });
        if (!this.game_has_started) {
            this.game_has_started = true;
            // need to switch the start message for the timer and get it rolling
        }
        for (let i = 65; i <= 90; i++) {
            let key_element = document.getElementById(`key-${String.fromCharCode(i)}`);
            if (key_element) {
                key_element.classList.remove('paused-key');
            }
        }
        document.getElementById("refresh-key").classList.remove('paused-key');
        document.getElementById("delete-key").classList.remove('paused-key');
    }

    handlePlayPauseClicked() {
        if (this.first_solution_found) {
            return;
        }
        if (this.is_paused) {
            // if there is no currently selected letter, select the first letter of the first word
            if (this.selectedLetter === null) {
                this.selectedLetter = this.words[0].letters[0];
                this.toggleSelected();
            }
            this.resume();
        } else {
            this.pause();
        }
    }

    handleSolutionFound() {
        this.celebrate();
        // stop timer...
    }


    getMetric() {
        return formatTime(this.elapsedSeconds);
    }
}
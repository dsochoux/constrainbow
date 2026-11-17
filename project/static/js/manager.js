import { SpeedBoard } from "./speedBoard.js";
import { ScoreBoard } from "./scoreBoard.js";
import { SolveBoard } from "./solveBoard.js";
import { Stats } from "./stats.js";
import { StatsPopup } from "./statsPopup.js";
import { deleteAllCookies } from "./helpers.js";

export class Manager {
    constructor() {
        this.board = null;
        this.pauseKeyboard();
        this.setUpHowToPlay(); // set up before the game loads, so the popup always works
        this.stats = new Stats();
        // the daily puzzles have a 📊 button and keep stats (the SOLVE test batch and /solve/day don't)
        this.statsPopup = document.getElementById('stats-button') ? new StatsPopup(this) : null;
        this.showHowToPlayIfFirstTime();
        this.fetchGame().then(() => {
            this.addEventListeners();
        });
        this.dateElement = document.getElementById('date');
        this.reportMissingWordButton = document.getElementById('report-missing-word-button');
        this.copyButton = document.getElementById('copy-results-button');
        this.loadingText = document.getElementById('loading-text');
    }
    
    async fetchGame() {
        this.gameId = document.getElementById('game-id').value;
        this.gameMode = document.getElementById('game-mode').value;
        // a past puzzle from the archive: its progress is saved under its own keys, and it isn't logged
        // or counted in the stats. The daily puzzles keep their original keys ('speed', 'score')
        this.isArchive = document.getElementById('is-archive').value === 'true';
        const modeName = this.gameMode.charAt(0).toUpperCase() + this.gameMode.slice(1);
        this.storagePrefix = this.isArchive ? `archive${modeName}${this.gameId}` : this.gameMode;
        const response = await fetch(`/game?game-id=${this.gameId}&game-mode=${this.gameMode}`);
        if (response.status === 404) {
            console.log("forgot to make game");
            this.loadingText.textContent = "SORRY, I FORGOT TO MAKE TODAY'S GAME 😭"
            return;
        }
        const data = await response.json();

        this.accepted_words = new Set(data['words']);
        this.num_possible_solutions = data['num_possible_solutions'];
        this.num_possible_points = data['num_possible_points'];
        
        // update some DOM elements after receiving the data
        if (this.gameMode === 'score') {
            document.querySelectorAll('.key-points').forEach((element) => {
                element.style.display = 'block';
            });
        }
        // the SOLVE page describes its puzzle in the template instead
        const solutionsElement = document.getElementById('num-possible-solutions');
        if (solutionsElement) {
            solutionsElement.textContent = this.num_possible_solutions.toLocaleString();
        }
        this.loadingText.style.display = 'none';
        
        if(this.gameMode === 'speed') {
            this.board = new SpeedBoard(this, data);
        } else if (['solve', 'solve-test', 'solve-day'].includes(this.gameMode)) {
            this.board = new SolveBoard(this, data);
        } else { // game_mode === "score"
            this.board = new ScoreBoard(this, data);
            // score mode has no start button, so start with the first empty tile selected
            // (otherwise typing does nothing until a tile is tapped)
            if (!this.board.isSolutionFound) {
                this.board.selectFirstBlank();
            }
        }
    }

    addEventListeners() {
        // keyboard events
        document.addEventListener('keydown', (e) => {
            // ignore keystrokes if the user is holding down the meta key, control key, 
            // or if the board is not listening for input
            if (e.metaKey || e.ctrlKey || !this.board.isListeningForInput(e.key)) {
                return;
            }
            this.board.handleKeyPressed(e.key);
        });

        // virtual keys
        document.querySelectorAll('.key').forEach((key) => {
            key.addEventListener('click', (e) => {
                const key = e.target.getAttribute('data-key');
                document.dispatchEvent(
                    new KeyboardEvent('keydown', { key })
                );
            });
        });

        // report missing word
        document.getElementById('report-missing-word-button').addEventListener('click', () => {
            this.reportMissingWords();
        });

        // copy results button
        document.getElementById('copy-results-button').addEventListener('click', () => {
            this.board.copyResults();
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.board.pause();
            }
        });
    }

    // the how-to-play popup is a short series of steps with BACK / NEXT buttons
    setUpHowToPlay() {
        this.howToPlayOverlay = document.getElementById('how-to-play-overlay');
        this.steps = document.querySelectorAll('.step');
        this.stepDots = document.querySelectorAll('.step-dots span');
        this.stepBackButton = document.getElementById('step-back');
        this.stepNextButton = document.getElementById('step-next');

        document.getElementById('how-to-play-button').addEventListener('click', () => this.showHowToPlay());
        document.getElementById('close-button').addEventListener('click', () => this.hideHowToPlay());
        this.howToPlayOverlay.addEventListener('click', (event) => {
            if (event.target === this.howToPlayOverlay) {
                this.hideHowToPlay();
            }
        });
        this.stepBackButton.addEventListener('click', () => this.showStep(this.stepIndex - 1));
        this.stepNextButton.addEventListener('click', () => {
            if (this.stepIndex === this.steps.length - 1) {
                this.hideHowToPlay();
            } else {
                this.showStep(this.stepIndex + 1);
            }
        });
        this.showStep(0);
    }

    showStep(index) {
        this.stepIndex = Math.max(0, Math.min(index, this.steps.length - 1));
        this.steps.forEach((step, i) => step.classList.toggle('active', i === this.stepIndex));
        this.stepDots.forEach((dot, i) => dot.classList.toggle('active', i === this.stepIndex));
        this.stepBackButton.classList.toggle('hidden', this.stepIndex === 0);
        this.stepNextButton.textContent = this.stepIndex === this.steps.length - 1 ? "LET'S PLAY" : "NEXT";
    }

    showHowToPlay() {
        this.showStep(0);
        this.howToPlayOverlay.style.visibility = 'visible';
        if (this.board) {
            this.board.pause();
        }
    }

    hideHowToPlay() {
        this.howToPlayOverlay.style.visibility = 'hidden';
    }

    showHowToPlayIfFirstTime() {
        if (!localStorage.getItem('visited')) {
            this.showHowToPlay(); // Show instructions
            localStorage.setItem('visited', 'true'); // Mark as visited
        }
    }

    // called when a puzzle is finished: saves today's result to the stats, and shows the stats the
    // first time today's puzzle is finished (after the celebration)
    recordResult() {
        if (this.isArchive) {
            this.markArchiveFinished();
            return;
        }
        // no stats page, or score mode after SHOW BEST (today's score is final)
        if (!this.statsPopup || (this.board.isScoreFinal && this.board.isScoreFinal())) {
            return;
        }
        // finishing again only replaces the saved result if it's a better score (score mode)
        const isBetter = (old, result) => result.points > old.points;
        const isFirst = this.stats.record(this.gameMode, this.gameId, this.board.getStatsResult(), isBetter);
        if (isFirst) {
            setTimeout(() => this.statsPopup.show(), 1800);
        }
    }

    // the archive calendar marks the past puzzles finished in this browser with ✓
    // localStorage "archive" = {"speed": {"02102025": true}, ...}; the daily stats count as finished too
    markArchiveFinished() {
        let finished = {};
        try {
            finished = JSON.parse(localStorage.getItem('archive')) || {};
        } catch (e) {
            finished = {};
        }
        finished[this.gameMode] = finished[this.gameMode] || {};
        finished[this.gameMode][this.gameId] = true;
        localStorage.setItem('archive', JSON.stringify(finished));
    }

    // the first line of the share text: today's mode page, or this past puzzle's archive page
    getShareLink() {
        if (this.isArchive) {
            const id = this.gameId;
            return `constrainbow.com/archive/${this.gameMode}/${id.substring(4)}-${id.substring(0, 2)}-${id.substring(2, 4)}`;
        }
        return `constrainbow.com/${this.gameMode}`;
    }

    // " | 🔥 5" for the share text, once a streak is at least 2 days
    getStreakText() {
        if (!this.statsPopup) {
            return "";
        }
        const { current } = this.stats.getStreaks(this.gameMode, this.gameId);
        return current >= 2 ? ` | 🔥 ${current}` : "";
    }

    showCopyButton() {
        this.copyButton.style.display = "inline-block";
    }
    hideCopyButton() {
        this.copyButton.style.display = "none";
    }

    showReportMissingWordButton(numInvalidWords) {
        const text = numInvalidWords > 1 ? "REPORT MISSING WORDS" : "REPORT MISSING WORD";
        this.reportMissingWordButton.textContent = text;
        this.reportMissingWordButton.style.display = 'inline-block';
    }
    hideReportMissingWordButton() {
        this.reportMissingWordButton.style.display = 'none';
    }

    resetKeyboard() {
        for (let i = 65; i <= 90; i++) {
            document.getElementById(`key-${String.fromCharCode(i)}`).classList.remove('unavailable');
        }
    }

    pauseKeyboard() {
        for (let i = 65; i <= 90; i++) {
            document.getElementById(`key-${String.fromCharCode(i)}`).classList.add('paused-key');
        }
        document.getElementById("refresh-key").classList.add('paused-key');
        document.getElementById("delete-key").classList.add('paused-key');
    }

    resumeKeyboard() {
        for (let i = 65; i <= 90; i++) {
            document.getElementById(`key-${String.fromCharCode(i)}`).classList.remove('paused-key');
        }
        document.getElementById("refresh-key").classList.remove('paused-key');
        document.getElementById("delete-key").classList.remove('paused-key');
    }

    updateKeyboard() {
        this.resetKeyboard();
        // the SOLVE REVEAL button shows how many tiles it would fill for the selected tile
        if (this.board.updateRevealButton) {
            this.board.updateRevealButton();
        }
        
        if (this.board.selectedLetter === null) {
            return;
        }
        
        let unavailableLetters = [];
        if(this.board.selectedLetter.isConstrained()) {
            // must add the black letters too
            for (let letter in this.board.blackLetters) {
                if (this.board.blackLetters[letter] > 0) {
                    unavailableLetters.push(letter);
                }
            }
        }
        this.board.constraintAssignments.forEach((letter) => {
            if (letter != "") {
                unavailableLetters.push(letter);
            }
        });
        
        // for each of these letters, except the current letter if there if one, get the key element from the dom
        // and add the unavailable class to the key
        unavailableLetters.forEach(letter => {
            if (this.board.selectedLetter.value != letter) {
                document.getElementById(`key-${letter}`).classList.add('unavailable');
            }
        });
    }
    
    resetCookie() {
        deleteAllCookies();
        document.cookie = `game_id=${this.gameId};path=/;max-age=${60 * 60 * 24}`;
    }

    isValidWord(word) {
        return this.accepted_words.has(word);
    }

    // MM/DD, with the year for an archive puzzle (the archive goes back to 2025)
    getFormatedDate() {
        if (this.isArchive) {
            return `${this.gameId.substring(0, 2)}/${this.gameId.substring(2, 4)}/${this.gameId.substring(4)}`;
        }
        return `${this.gameId[0]}${this.gameId[1]}/${this.gameId[2]}${this.gameId[3]}`;
    }

    logBoard() {
        if (this.isArchive) {
            return; // only today's puzzles are logged
        }
        if (this.gameMode === 'solve-day') {
            return; // trying out another day's puzzle: not a real solve
        }
        if (this.gameMode === 'solve' || this.gameMode === 'solve-test') {
            this.logSolve();
            return;
        }
        fetch('/log-solution', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                'game_id': this.gameId,
                'mode': this.gameMode,
                'metric': this.board.getMetric(false),
                'words': this.board.getWordsList(),
            })
        });
    }

    // SOLVE results are logged with a random id per browser, so one tester's solves can be
    // grouped without knowing who they are
    logSolve() {
        let tester = localStorage.getItem('solveTester');
        if (!tester) {
            tester = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
            localStorage.setItem('solveTester', tester);
        }
        fetch('/log-solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'tester': tester, ...this.board.getSolveResult() })
        });
    }

    reportMissingWords() {
        let incorrectWords = [];
        this.board.words.forEach(word => {
            if (word.isAllLettersFilled() && !this.isValidWord(word.getWordString())) {
                // if a word is full and not in the word list, report it
                incorrectWords.push(word.getWordString());
            }
        });
        this.reportMissingWordButton.textContent = "REPORTING...";
        fetch('/report-missing-word', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'words': incorrectWords
            })
        }).then(() => {
            this.reportMissingWordButton.textContent = "REPORTED!";
            setTimeout(() => {
                this.reportMissingWordButton.textContent = "REPORT MISSING WORD";
                this.hideReportMissingWordButton();
                this.board.showItems();
            }, 1000);
        })
    }
}
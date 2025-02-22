import { SpeedBoard } from "./speedBoard.js";
import { ScoreBoard } from "./scoreBoard.js";
import { deleteAllCookies } from "./helpers.js";

export class Manager {
    constructor() {
        this.pauseKeyboard();
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
        document.getElementById('num-possible-solutions').textContent = this.num_possible_solutions.toLocaleString();
        this.loadingText.style.display = 'none';
        
        if(this.gameMode === 'speed') {
            this.board = new SpeedBoard(this, data);
        } else { // game_mode === "score"
            this.board = new ScoreBoard(this, data);
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

        // how to play overlay
        const howToPlayOverlay = document.getElementById('how-to-play-overlay');
        const showOverlay = () => {
            howToPlayOverlay.style.visibility = 'visible';
            this.board.pause();
        }
        document.getElementById('how-to-play-button').addEventListener('click', showOverlay);
        const closeOverlay = () => {
            howToPlayOverlay.style.visibility = 'hidden';
        }
        document.getElementById('close-button').addEventListener('click', closeOverlay);
        document.getElementById('got-it-button').addEventListener('click', closeOverlay);
        howToPlayOverlay.addEventListener('click', (event) => {
            if (event.target === howToPlayOverlay) {
                closeOverlay();
            }
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

    showHowToPlayIfFirstTime() {
        if (!localStorage.getItem('visited')) {
            document.getElementById('how-to-play-overlay').style.visibility = 'visible'; // Show instructions
            localStorage.setItem('visited', 'true'); // Mark as visited
        }
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

    getFormatedDate() {
        return `${this.gameId[0]}${this.gameId[1]}/${this.gameId[2]}${this.gameId[3]}`;
    }

    logBoard() {
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

    reportMissingWords() {
        let incorrectWords = [];
        this.board.words.forEach(word => {
            if (word.isAllLettersFilled() && !word.isValidWord) {
                // a full word not in the invalid state is one we should report
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
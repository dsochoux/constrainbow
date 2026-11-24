import { SpeedBoard } from "./speedBoard.js";
import { ScoreBoard } from "./scoreBoard.js";
import { SolveBoard } from "./solveBoard.js";
import { Stats } from "./stats.js";
import { StatsPopup } from "./statsPopup.js";
import { Feedback } from "./feedback.js";
import { Account } from "./account.js";
import { FriendsPopup } from "./friendsPopup.js";
import { deleteAllCookies, launchConfetti } from "./helpers.js";

const TITLE = "CONSTRAINBOW"; // the wordmark's letters, one per span in game.html
// each mode's emoji, which starts the share text (the same ones as the mode switch)
const MODE_EMOJIS = { solve: "🔑", speed: "⏱️", score: "🎯" };

export class Manager {
    constructor() {
        // checked before the how-to-play popup marks this browser as visited (see logVisit)
        this.isNewPlayer = Manager.isNewPlayer();
        this.board = null;
        this.pauseKeyboard();
        this.setUpHowToPlay(); // set up before the game loads, so the popup always works
        this.feedback = new Feedback(this);
        this.stats = new Stats();
        // the daily puzzles have a 📊 button and keep stats (the SOLVE test batch and /solve/day don't)
        this.statsPopup = document.getElementById('stats-button') ? new StatsPopup(this) : null;
        // the optional account: stats and archive ✓s follow a signed-in player to every device, and the
        // daily puzzles have a 👥 button with today's scoreboard among their friends
        this.account = new Account(this);
        this.friendsPopup = document.getElementById('friends-button') ? new FriendsPopup(this) : null;
        this.account.sync().then(() => {
            if (this.friendsPopup) {
                this.friendsPopup.afterSync();
            }
        });
        this.showHowToPlayIfFirstTime();
        this.fetchGame().then(() => {
            this.addEventListeners();
        });
        this.logVisit();
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
        // a puzzle finished earlier keeps the rainbow wordmark (no animation)
        if (this.board.isSolutionFound) {
            this.showRainbow(false);
        }
    }

    addEventListeners() {
        // keyboard events
        document.addEventListener('keydown', (e) => {
            // ignore keystrokes if the user is holding down the meta key, control key, 
            // or if the board is not listening for input
            // or if the user is typing in a text box (the feedback form)
            if (e.metaKey || e.ctrlKey || (e.target instanceof Element && e.target.closest('input, textarea'))) {
                return;
            }
            if (!this.board.isListeningForInput(e.key)) {
                this.listenForSecretWord(e.key);
                return;
            }
            this.secretWordTyped = '';
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

        // copy results button (a click while it offers to include the solution copies that too)
        document.getElementById('copy-results-button').addEventListener('click', () => {
            const withSolution = this.copyButton.textContent !== 'COPY RESULTS!' && this.gameMode !== 'solve';
            this.board.copyResults();
            this.logEvent('share', { solution: withSolution });
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

    // the wordmark turns into a full rainbow (green joins the four colors) when the puzzle
    // is finished; animate plays the hop-and-fill wave, which replays (from the rainbow colors) on every
    // win, like the board's wave. Returns where and when each letter hops, for the confetti it drops
    // (empty when not animating)
    // message (optional, 12 letters): the letters turn into it as the wave passes, hold it for a few
    // seconds, then a second wave turns them back into CONSTRAINBOW
    showRainbow(animate, message = null) {
        const wordmark = document.querySelector('.wordmark');
        if (!wordmark) {
            return [];
        }
        wordmark.classList.toggle('rainbow-again', wordmark.classList.contains('rainbow'));
        wordmark.classList.add('rainbow');
        if (!animate) {
            return [];
        }
        const letters = this.playTitleWave(wordmark, message || TITLE);
        if (message) {
            const holdUntil = letters[letters.length - 1].delay + 650 + 3000; // the wave's end, then 3 s
            this.titleRevertTimeout = setTimeout(() => {
                wordmark.classList.add('rainbow-again');
                this.playTitleWave(wordmark, TITLE);
            }, holdUntil);
        }
        return letters;
    }

    // easter egg: typing R-A-I-N-B-O-W while the board isn't taking keys (no tile selected, or paused)
    // plays the title's wave and drops confetti. Before the day's win the title keeps its four colors,
    // so green stays the reward for winning
    listenForSecretWord(key) {
        if (key.length !== 1 || !/[a-z]/i.test(key)) {
            this.secretWordTyped = '';
            return;
        }
        this.secretWordTyped = ((this.secretWordTyped || '') + key.toUpperCase()).slice(-7);
        if (this.secretWordTyped === 'RAINBOW') {
            this.secretWordTyped = '';
            const wordmark = document.querySelector('.wordmark');
            if (!wordmark) {
                return;
            }
            const isWon = wordmark.classList.contains('rainbow');
            wordmark.classList.toggle('rainbow-again', isWon);
            wordmark.classList.toggle('four-colors', !isWon);
            launchConfetti(this.board.confettiEmoji, this.playTitleWave(wordmark));
        }
    }

    // plays the title's hop-and-fill wave (left to right) and returns where and when each letter hops,
    // for the confetti it drops. Each letter becomes text's letter at the top of its hop (text is
    // CONSTRAINBOW, or a 12-letter win message; a space leaves the tile empty)
    playTitleWave(wordmark, text = TITLE) {
        clearTimeout(this.titleRevertTimeout);
        (this.titleLetterTimeouts || []).forEach(clearTimeout);
        wordmark.classList.remove('rainbow-in');
        void wordmark.offsetWidth; // forces the browser to notice the removal, so the wave restarts
        wordmark.classList.add('rainbow-in');
        clearTimeout(this.rainbowTimeout);
        this.rainbowTimeout = setTimeout(() => {
            wordmark.classList.remove('rainbow-in', 'rainbow-again', 'four-colors');
        }, 1600);
        const stagger = 55; // ms between letters; the CSS reads it from --rainbow-stagger
        wordmark.style.setProperty('--rainbow-stagger', `${stagger}ms`);
        const spans = [...wordmark.querySelectorAll('span')];
        // 260 ms in is the top of a letter's hop (40% of the 650 ms rainbow-in animation)
        this.titleLetterTimeouts = spans.map((span, i) => setTimeout(() => {
            span.textContent = text[i] || '';
        }, i * stagger + 260));
        return spans.map((span, i) => {
            const rect = span.getBoundingClientRect();
            return {
                left: rect.left,
                width: rect.width,
                top: rect.bottom,
                color: getComputedStyle(span).getPropertyValue('--r').trim(),
                delay: i * stagger,
            };
        });
    }

    // called when a puzzle is finished: saves today's result to the stats, and shows the stats the
    // first time today's puzzle is finished (after the celebration)
    recordResult() {
        Manager.keepStorage();
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
        const result = this.board.getStatsResult();
        const isFirst = this.stats.record(this.gameMode, this.gameId, result, isBetter);
        this.account.recordResult(this.gameMode, this.gameId, result); // the server keeps the better score too
        if (isFirst) {
            // as the board's wave finishes; the confetti keeps falling behind the popup (the overlay sits
            // above it) and a title message changes back behind it too
            setTimeout(() => this.statsPopup.show(), 2000);
        }
    }

    // asks the browser not to clear this site's storage (stats, streaks, archive ✓s) when the device
    // runs low on space. Chrome and Safari decide on their own without asking anyone; Firefox would
    // show the player a permission popup, so it's skipped there. Called when a puzzle is finished.
    // It doesn't stop Safari clearing everything after 7 days of using Safari without visiting the site
    static keepStorage() {
        try {
            if (!navigator.storage || !navigator.storage.persist || /Firefox\//.test(navigator.userAgent)) {
                return;
            }
            navigator.storage.persisted().then((isKept) => {
                if (!isKept) {
                    return navigator.storage.persist();
                }
            }).catch(() => {});
        } catch (e) {
            // optional
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
        this.account.recordArchive(this.gameMode, this.gameId);
    }

    // the first line of the share text: today's mode page, or this past puzzle's archive page
    getShareLink() {
        if (this.isArchive) {
            const id = this.gameId;
            return `constrainbow.com/archive/${this.gameMode}/${id.substring(4)}-${id.substring(0, 2)}-${id.substring(2, 4)}`;
        }
        return `constrainbow.com/${this.gameMode}`;
    }

    // "🔑 constrainbow.com/solve", the first line of the share text
    // (the emoji up front says which mode it is before anyone reads the numbers)
    getShareHeader(link = this.getShareLink()) {
        return `${MODE_EMOJIS[this.gameMode]} ${link}`;
    }

    // "🔥 5-day streak" on its own line at the end of the share text, once a streak is at least 2 days
    // (it used to end the stats line, which made that line wrap in iMessage)
    getStreakText() {
        if (!this.statsPopup) {
            return "";
        }
        const { current } = this.stats.getStreaks(this.gameMode, this.gameId);
        return current >= 2 ? `🔥 ${current}-day streak\n` : "";
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

    // a random id for this browser, so one player's visits and solves can be grouped without knowing
    // who they are. It began as SOLVE's "solveTester" id, which is reused so old solves still match
    getPlayerId() {
        let player = localStorage.getItem('playerId') || localStorage.getItem('solveTester');
        if (!player) {
            player = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
        }
        localStorage.setItem('playerId', player);
        return player;
    }

    // ---- analytics: small events for the dashboard (/dashboard), one line each in logs/events/ ----
    // event: visit, start, finish, share, show_best, report; extra: that event's numbers (see
    // EVENT_FIELDS in app.py). Never blocks or breaks the game if it fails
    logEvent(event, extra = {}) {
        if (this.gameMode === 'solve-test' || this.gameMode === 'solve-day') {
            return; // play-tests and previews of other days aren't real play
        }
        try {
            fetch('/log-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify({
                    event,
                    player: this.getPlayerId(),
                    mode: this.gameMode,
                    game: this.gameId,
                    archive: this.isArchive,
                    ...extra,
                }),
            }).catch(() => {});
        } catch (e) {
            // analytics are optional
        }
    }

    // a browser that has never opened the game: no player id, and no "visited" flag (which the
    // how-to-play popup has set on everyone's first visit since long before the player id existed)
    static isNewPlayer() {
        return ['playerId', 'solveTester', 'visited'].every((key) => localStorage.getItem(key) === null);
    }

    // a page view: whether this browser is new, and where it came from (another site, or a link with
    // ?utm_source=..., e.g. in a video description)
    logVisit() {
        const isNew = this.isNewPlayer;
        let ref = '';
        try {
            const host = new URL(document.referrer).hostname;
            ref = host === location.hostname ? '' : host;
        } catch (e) {
            ref = '';
        }
        const utm = new URLSearchParams(location.search).get('utm_source') || '';
        this.logEvent('visit', { new: isNew, ref, utm });
    }

    // SOLVE results are logged with the player id, so one player's solves can be grouped
    logSolve() {
        fetch('/log-solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'tester': this.getPlayerId(), ...this.board.getSolveResult() })
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
        this.logEvent('report', { count: incorrectWords.length });
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
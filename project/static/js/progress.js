// a signed-in player's daily game in progress, carried between devices (see project/accounts.py,
// "saved_games"). Each mode already keeps its game in a few localStorage keys (the board, the timer,
// SOLVE's reveals...), so a saved game is just those keys' values: sent to the server on pause, when
// the page is hidden (switching apps, locking the phone, closing the tab) and on a finish, and written
// back into this browser's storage before the board loads when the server's is newer. The most
// recently saved game wins, except that a finished game is never replaced by an unfinished one.
// Only the daily puzzles take part (not the archive, /solve/day or the SOLVE test batch)

// the browser keys a saved game is made of, per mode (the same lists as SAVED_GAME_KEYS in accounts.py)
export const SAVED_GAME_KEYS = {
    solve: ['solveWord0', 'solveWord1', 'solveWord2', 'solveWord3', 'solveState'],
    speed: ['speedGameId', 'speedWord0', 'speedWord1', 'speedWord2', 'speedWord3', 'elapsedSeconds', 'speedIsSolutionFound'],
    score: ['scoreGameId', 'scoreWord0', 'scoreWord1', 'scoreWord2', 'scoreWord3', 'scoreIsSolutionFound', 'scoreDayBest', 'scoreRevealed'],
};

// localStorage "savedGameAt" = {"solve": {"gameId": "11242026", "user": "danny", "updated": 1795500000.5},
// ...}: when the server saved the game this browser last sent or took in (server time, so clocks don't
// matter), and for which account (another account's time says nothing about this one's game)
const SAVED_AT_KEY = 'savedGameAt';

export class Progress {
    constructor(manager) {
        this.manager = manager;
        this.lastSent = null; // the game as last sent or loaded, so an unchanged game isn't sent again
        this.isReloading = false; // see reloadWith
    }

    // the page's daily game: {mode, gameId}, or null on any other page (read from the page itself, as
    // this is needed before the game has loaded)
    static pageGame() {
        const mode = document.getElementById('game-mode').value;
        const isArchive = document.getElementById('is-archive').value === 'true';
        if (isArchive || !(mode in SAVED_GAME_KEYS) || !document.getElementById('stats-button')) {
            return null;
        }
        return { mode, gameId: document.getElementById('game-id').value };
    }

    get game() {
        return Progress.pageGame();
    }

    isActive() {
        return this.game !== null && this.manager.account.signedIn;
    }

    // this browser's saved game for the page's mode, as {key: stored text or null}
    snapshot() {
        const snapshot = {};
        SAVED_GAME_KEYS[this.game.mode].forEach((key) => {
            snapshot[key] = localStorage.getItem(key);
        });
        return snapshot;
    }

    // the same snapshot always gives the same text, whatever order its keys come in
    static asText(snapshot) {
        return JSON.stringify(Object.keys(snapshot).sort().map((key) => [key, snapshot[key]]));
    }

    isFinished(snapshot) {
        const mode = this.game.mode;
        if (mode === 'solve') {
            try {
                return Boolean((JSON.parse(snapshot.solveState) || {}).solved);
            } catch (e) {
                return false;
            }
        }
        return snapshot[`${mode}IsSolutionFound`] === 'true';
    }

    savedAt() {
        try {
            const entry = (JSON.parse(localStorage.getItem(SAVED_AT_KEY)) || {})[this.game.mode];
            const isThis = entry && entry.gameId === this.game.gameId && entry.user === this.manager.account.info.username;
            return isThis ? entry.updated : 0;
        } catch (e) {
            return 0;
        }
    }

    setSavedAt(updated) {
        let all = {};
        try {
            all = JSON.parse(localStorage.getItem(SAVED_AT_KEY)) || {};
        } catch (e) {
            all = {};
        }
        all[this.game.mode] = { gameId: this.game.gameId, user: this.manager.account.info.username, updated };
        localStorage.setItem(SAVED_AT_KEY, JSON.stringify(all));
    }

    // whether the server's saved game ({snapshot, updated}, from the sync or a check) should replace
    // this browser's: saved later than this browser's last, different, and not unfinished over finished
    isNewer(saved) {
        if (!this.game || !saved || !saved.snapshot || saved.updated <= this.savedAt()) {
            return false;
        }
        const mine = this.snapshot();
        if (Progress.asText(saved.snapshot) === Progress.asText(mine)) {
            this.setSavedAt(saved.updated); // the same game (this browser's own, sent as it was hidden)
            return false;
        }
        return !(this.isFinished(mine) && !this.isFinished(saved.snapshot));
    }

    // writes the server's saved game into this browser's storage (the board then loads it as its own)
    takeIn(saved) {
        Object.entries(saved.snapshot).forEach(([key, value]) => {
            if (value === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, value);
            }
        });
        this.setSavedAt(saved.updated);
    }

    // takes in another device's game on a page whose board has already loaded, and reloads to show
    // it. Reloading hides the page, which normally pauses the board (saving its own state over the
    // game just taken in) and sends it: isReloading stops both (see Manager's visibilitychange)
    reloadWith(saved) {
        this.isReloading = true;
        this.takeIn(saved);
        location.reload();
    }

    // once the board has loaded: the game as it is now counts as sent, so only changes are sent
    markLoaded() {
        if (this.game) {
            this.lastSent = Progress.asText(this.snapshot());
        }
    }

    // sends the game if it changed since it was last sent or loaded (the promise settles once it's
    // sent). keepalive lets the request finish as the page is hidden or closed
    send(keepalive = false) {
        if (!this.isActive() || !this.manager.board || this.isReloading) {
            return Promise.resolve();
        }
        const snapshot = this.snapshot();
        const text = Progress.asText(snapshot);
        if (text === this.lastSent) {
            return Promise.resolve();
        }
        this.lastSent = text;
        const { mode, gameId } = this.game;
        return fetch('/account/saved-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, gameId, snapshot }),
            keepalive,
        }).then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (data && data.kept) {
                    // the account already has this game finished (on another device): show that one
                    this.checkForNewer();
                } else if (data) {
                    this.setSavedAt(data.updated);
                }
            })
            .catch(() => {
                this.lastSent = null; // try again next time
            });
    }

    // signing out: the account keeps the daily games, so this browser forgets them (all three modes)
    // and reloads to a fresh board, as on a first visit. isReloading stops the reload from saving the
    // board on screen back into storage
    forgetGamesAndReload() {
        this.isReloading = true;
        Object.values(SAVED_GAME_KEYS).flat().forEach((key) => localStorage.removeItem(key));
        localStorage.removeItem(SAVED_AT_KEY);
        location.reload();
    }

    // after a pause or a finish: the board saves its own storage first, then this sends it
    sendSoon() {
        setTimeout(() => this.send(), 0);
    }

    // when the page comes back into view, or after signing in: if another device saved a newer game,
    // reload the page, which then loads it
    async checkForNewer() {
        if (!this.isActive()) {
            return;
        }
        try {
            const { mode, gameId } = this.game;
            const response = await fetch(`/account/saved-game/${mode}/${gameId}`);
            if (!response.ok) {
                return;
            }
            const { savedGame } = await response.json();
            if (this.isNewer(savedGame)) {
                this.reloadWith(savedGame);
            }
        } catch (e) {
            // offline: keep playing this device's game
        }
    }
}

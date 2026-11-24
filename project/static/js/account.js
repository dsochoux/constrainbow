import { STATS_MODES } from './stats.js';
import { Progress } from './progress.js';

// localStorage: set while this browser is signed in, so the next visit knows to wait for the account's
// saved game before drawing the board (see Manager.fetchGame)
const SIGNED_IN_KEY = 'signedIn';

// the optional account (see project/accounts.py): signing up and in, and keeping this browser's stats
// and archive ✓s in step with the server, so they follow a signed-in player to every device
export class Account {
    constructor(manager) {
        this.manager = manager;
        this.info = { signedIn: false }; // {signedIn, username, friendLink} once the server answers
        this.listeners = [];
        this.savedGame = null; // the page's daily game as saved from any device ({snapshot, updated}), from the sync
    }

    get signedIn() {
        return this.info.signedIn;
    }

    // called when the sign-in state changes (the friends popup and button redraw)
    onChange(listener) {
        this.listeners.push(listener);
    }

    setInfo(data) {
        this.info = data.signedIn
            ? { signedIn: true, username: data.username, friendLink: data.friendLink }
            : { signedIn: false };
        if (data.signedIn) {
            localStorage.setItem(SIGNED_IN_KEY, 'true');
        } else {
            localStorage.removeItem(SIGNED_IN_KEY);
        }
        this.listeners.forEach((listener) => listener());
    }

    // signed in on this browser's last visit (the server's answer can say otherwise)
    static wasSignedIn() {
        return localStorage.getItem(SIGNED_IN_KEY) === 'true';
    }

    async post(url, body = {}) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        let data = {};
        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }
        return { ok: response.ok, status: response.status, data };
    }

    // on every page load: sends this browser's recent results and ✓s (in case one didn't reach the
    // server), and takes in the account's, so a finish on another device shows here too. Also asks for
    // the page's daily game as saved from any device (see progress.js)
    async sync() {
        try {
            const { ok, data } = await this.post('/account/sync', {
                stats: this.recentStats(7),
                archive: Account.readArchive(),
                savedGameFor: Progress.pageGame(),
            });
            if (ok) {
                if (data.signedIn) {
                    this.takeIn(data);
                    this.savedGame = data.savedGame || null;
                }
                this.setInfo(data);
            }
        } catch (e) {
            // offline: the game works without the account
        }
    }

    // signing up or in adds everything this browser has to the account, then takes in the account's
    async signUp(username, password) {
        return this.signInOrUp('/account/signup', username, password);
    }

    async signIn(username, password) {
        return this.signInOrUp('/account/signin', username, password);
    }

    async signInOrUp(url, username, password) {
        const { ok, data } = await this.post(url, {
            username,
            password,
            stats: this.manager.stats.data,
            archive: Account.readArchive(),
        });
        if (ok) {
            this.takeIn(data);
            this.setInfo(data);
            this.manager.progress.checkForNewer(); // a game saved on another device: reloads to show it
            return null;
        }
        return data.error || 'Something went wrong. Try again.';
    }

    // signing out leaves this browser as on a first visit, so a new account made here doesn't take in
    // the last one's results: the daily game in progress goes to the account first (everything else is
    // already there), then this browser forgets its stats, archive ✓s and daily games and reloads to
    // fresh boards (see Progress.forgetGamesAndReload). Signing back in brings them all back
    async signOut() {
        await this.manager.progress.send().catch(() => {});
        await this.post('/account/signout');
        this.setInfo({ signedIn: false });
        localStorage.removeItem('stats');
        localStorage.removeItem('archive');
        this.manager.progress.forgetGamesAndReload();
    }

    // a finished daily puzzle (called after the stats saved it; score mode calls it for every better score)
    recordResult(mode, gameId, result) {
        if (this.signedIn) {
            this.post('/account/result', { mode, game_id: gameId, result }).catch(() => {});
        }
    }

    recordArchive(mode, gameId) {
        if (this.signedIn) {
            this.post('/account/archive', { mode, game_id: gameId }).catch(() => {});
        }
    }

    // the account's results and ✓s join this browser's: a day missing here is added, and in score
    // mode a higher score replaces a lower one
    takeIn(data) {
        const stats = this.manager.stats;
        let changed = false;
        STATS_MODES.forEach((mode) => {
            Object.entries((data.stats || {})[mode] || {}).forEach(([gameId, result]) => {
                const mine = stats.data[mode][gameId];
                if (!mine || (mode === 'score' && result.points > mine.points)) {
                    stats.data[mode][gameId] = result;
                    changed = true;
                }
            });
        });
        if (changed) {
            stats.save();
        }
        const archive = Account.readArchive();
        STATS_MODES.forEach((mode) => {
            archive[mode] = { ...(archive[mode] || {}), ...((data.archive || {})[mode] || {}) };
        });
        localStorage.setItem('archive', JSON.stringify(archive));
    }

    // this browser's results from the last few days, per mode
    recentStats(days) {
        const recent = {};
        const cutoff = Date.now() - days * 86400000;
        STATS_MODES.forEach((mode) => {
            recent[mode] = {};
            Object.entries(this.manager.stats.data[mode]).forEach(([gameId, result]) => {
                const day = Date.UTC(+gameId.substring(4), +gameId.substring(0, 2) - 1, +gameId.substring(2, 4));
                if (day >= cutoff) {
                    recent[mode][gameId] = result;
                }
            });
        });
        return recent;
    }

    static readArchive() {
        try {
            return JSON.parse(localStorage.getItem('archive')) || {};
        } catch (e) {
            return {};
        }
    }
}

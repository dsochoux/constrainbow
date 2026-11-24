// a player's results, kept only in this browser: one entry per daily puzzle finished, per mode
// localStorage "stats" = {"solve": {"11162026": {seconds, reveals}}, "speed": {"11162026": {seconds}},
//                         "score": {"11162026": {points, max}}}
// since 2026-11-23 each result also has the finished board, for the friends scoreboard: words (and
// SOLVE's revealed, [w, l] per revealed tile). A signed-in player's stats are kept on the server too
// (see account.js), so they follow them to other devices
// only the daily puzzles count (not the SOLVE test batch or /solve/day)
export const STATS_MODES = ['solve', 'speed', 'score'];

// a game id (MMDDYYYY) as a day number, so consecutive days differ by exactly 1
function dayNumber(gameId) {
    const month = parseInt(gameId.substring(0, 2), 10);
    const day = parseInt(gameId.substring(2, 4), 10);
    const year = parseInt(gameId.substring(4), 10);
    return Math.round(Date.UTC(year, month - 1, day) / 86400000);
}

export class Stats {
    constructor() {
        this.data = {};
        try {
            this.data = JSON.parse(localStorage.getItem('stats')) || {};
        } catch (e) {
            this.data = {}; // unreadable stats start over rather than break the game
        }
        STATS_MODES.forEach((mode) => {
            if (typeof this.data[mode] !== 'object' || this.data[mode] === null) {
                this.data[mode] = {};
            }
        });
    }

    save() {
        localStorage.setItem('stats', JSON.stringify(this.data));
    }

    // saves a finished game; isBetter(old, new) decides whether a second finish of the same day
    // replaces the first (score mode keeps the best score). Returns true the first time a day is
    // finished, so the caller knows to show the stats
    record(mode, gameId, result, isBetter = () => false) {
        const days = this.data[mode];
        const isFirst = !(gameId in days);
        if (isFirst || isBetter(days[gameId], result)) {
            days[gameId] = result;
            this.save();
        }
        return isFirst;
    }

    hasResult(mode, gameId) {
        return gameId in this.data[mode];
    }

    // every result for a mode, oldest first
    results(mode) {
        return Object.keys(this.data[mode])
            .sort((a, b) => dayNumber(a) - dayNumber(b))
            .map((gameId) => ({ gameId, ...this.data[mode][gameId] }));
    }

    // current: days in a row up to today, or up to yesterday while today isn't finished yet
    // (the streak isn't lost until a whole day goes by); best: the longest run ever
    getStreaks(mode, todayId) {
        const days = this.results(mode).map((result) => dayNumber(result.gameId));
        let best = 0;
        let run = 0;
        days.forEach((day, i) => {
            run = (i > 0 && day === days[i - 1] + 1) ? run + 1 : 1;
            best = Math.max(best, run);
        });
        const today = dayNumber(todayId);
        const last = days[days.length - 1];
        const current = (last === today || last === today - 1) ? run : 0;
        return { current, best };
    }
}

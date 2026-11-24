import { formatTime } from './helpers.js';

// what each mode shows: extra numbers next to played / streaks, and a histogram of results
// (columns(results) gives its columns, see Column below)
const MODE_DETAILS = {
    solve: {
        title: '🔑 SOLVE',
        extras: [
            // a non-breaking hyphen, so a narrow box wraps as "No-reveal / solves"
            ['No‑reveal solves', (results) => results.filter((result) => result.reveals === 0).length.toLocaleString()],
            // tiles revealed per day, to one decimal place
            ['Avg reveals', (results) => results.length
                ? (results.reduce((sum, result) => sum + result.reveals, 0) / results.length).toFixed(1).replace(/\.0$/, '')
                : '–'],
        ],
        chartTitle: 'Solve times',
        columns: (results) => timeColumns(results),
        // each column shows its days with 💡 reveals striped, on top of the days without
        splitByReveals: true,
    },
    speed: {
        title: '⏱️ SPEED',
        extras: [
            ['Best time', (results) => results.length ? formatTime(Math.min(...results.map((result) => result.seconds))) : '–'],
        ],
        chartTitle: 'Times',
        columns: (results) => timeColumns(results),
    },
    score: {
        title: '🎯 SCORE',
        extras: [
            ['Perfect scores', (results) => results.filter((result) => result.points >= result.max).length.toLocaleString()],
        ],
        chartTitle: 'Share of the max score',
        columns: (results) => scoreColumns(results),
    },
};

// a histogram column: holds(result) says if a result falls in it, label is drawn under the axis at
// its left edge (where its range starts; '' for none), and range is shown on hover
class Column {
    constructor(holds, label, range) {
        this.holds = holds;
        this.label = label;
        this.range = range;
    }
}

// score mode: a column for every 5% of the max score, from 50% (or the lowest score, if lower) up
// to a column of its own for 100%
function scoreColumns(results) {
    const fifth = (result) => Math.min(20, Math.floor((result.points / result.max) * 20)); // 20 = 100%
    const first = Math.min(10, ...results.map(fifth));
    const columns = [];
    for (let i = first; i <= 20; i++) {
        const label = i % 2 === 0 ? `${i * 5}${i === 20 ? '%' : ''}` : '';
        columns.push(new Column((result) => fifth(result) === i, label, i === 20 ? '100%' : `${i * 5}–${i * 5 + 4}%`));
    }
    return columns;
}

// the column widths a time histogram can use, and the gaps between its labels
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const LABEL_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
const MAX_TIME_COLUMNS = 18;
const MIN_TIME_COLUMNS = 8;
const MAX_TIME_LABELS = 6;

// solve and speed: columns fitted to this player's own times, so fast and slow players both see a
// shape. They run from the fastest time to the 90th-percentile time, in the smallest step that keeps
// to about 2 × √(days played) columns (8 to 18): few days get broad columns, and the shape gets finer
// as days add up. A player who always finishes in under a minute gets steps of a few seconds, a slower
// one steps of minutes. Anything slower than the 90th percentile goes in one last "8m+" column, so a
// single slow day doesn't squash the rest
function timeColumns(results) {
    const times = results.map((result) => result.seconds).sort((a, b) => a - b);
    const fastest = times[0];
    const typical = times[Math.floor(0.9 * (times.length - 1))];
    const most = Math.min(MAX_TIME_COLUMNS, Math.max(MIN_TIME_COLUMNS, Math.round(2 * Math.sqrt(times.length))));
    const step = TIME_STEPS.find((s) => Math.floor(typical / s) - Math.floor(fastest / s) + 1 <= most)
        || TIME_STEPS[TIME_STEPS.length - 1];
    let first = Math.floor(fastest / step);
    let last = Math.floor(typical / step);
    // with only a few days, widen to at least 8 columns around them (never below 0)
    const missing = MIN_TIME_COLUMNS - (last - first + 1);
    if (missing > 0) {
        first = Math.max(0, first - Math.floor(missing / 2));
        last = first + MIN_TIME_COLUMNS - 1;
    }
    const labelStep = LABEL_STEPS.find((l) => l % step === 0 && (last - first + 1) / (l / step) <= MAX_TIME_LABELS)
        || LABEL_STEPS[LABEL_STEPS.length - 1];
    // when some days are slower, end on a labeled time ("5m+", not "4:45+") if that adds at most 3 columns
    const roundLast = Math.ceil(((last + 1) * step) / labelStep) * (labelStep / step) - 1;
    if (times[times.length - 1] >= (last + 1) * step && roundLast - last <= 3) {
        last = roundLast;
    }
    const end = (last + 1) * step; // where the "slower" column starts
    const hasSlower = times[times.length - 1] >= end;

    const columns = [];
    for (let i = first; i <= last; i++) {
        const start = i * step;
        // the "8m+" label needs the room of the column before it (two, when the columns are thin)
        const crowded = hasSlower && (i === last || (i === last - 1 && last - first > 12));
        const isLabeled = start % labelStep === 0 && !crowded;
        columns.push(new Column(
            (result) => result.seconds >= start && result.seconds < start + step,
            isLabeled ? shortTime(start) : '',
            step === 1 ? formatTime(start) : `${formatTime(start)}–${formatTime(start + step - 1)}`,
        ));
    }
    if (hasSlower) {
        columns.push(new Column((result) => result.seconds >= end, `${shortTime(end)}+`, `${formatTime(end)} or more`));
    }
    return columns;
}

// a time for the axis: 0, 45s, 2m, 1:30
function shortTime(seconds) {
    if (seconds === 0) {
        return '0';
    }
    if (seconds < 60) {
        return `${seconds}s`;
    }
    return seconds % 60 === 0 ? `${seconds / 60}m` : formatTime(seconds);
}

// the stats popup: opened by the 📊 button, and after finishing today's puzzle
export class StatsPopup {
    constructor(manager) {
        this.manager = manager;
        this.overlay = document.getElementById('stats-overlay');
        this.content = document.getElementById('stats-content');
        // the popup's COPY RESULTS button works the page's button, so both copy the same way (in speed
        // and score, a second click includes the solution) and show the same text
        this.pageCopyButton = document.getElementById('copy-results-button');
        new MutationObserver(() => {
            const copyButton = document.getElementById('stats-copy-button');
            if (copyButton) {
                copyButton.textContent = this.pageCopyButton.textContent;
            }
        }).observe(this.pageCopyButton, { childList: true, characterData: true, subtree: true });
        document.getElementById('stats-button').addEventListener('click', () => this.show());
        // score mode: the "Yesterday's best" link next to the description opens the stats, which show it
        const yesterdayLink = document.getElementById('yesterday-best-link');
        if (yesterdayLink) {
            yesterdayLink.addEventListener('click', (event) => {
                event.preventDefault();
                this.show();
            });
        }
        document.getElementById('stats-close-button').addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', (event) => {
            if (event.target === this.overlay) {
                this.hide();
            }
        });
    }

    show() {
        this.render();
        this.overlay.style.visibility = 'visible';
        if (this.manager.board) {
            this.manager.board.pause();
        }
    }

    hide() {
        this.overlay.style.visibility = 'hidden';
    }

    // the columns side by side, each as tall as its share of the tallest, with its count on top;
    // today's column is highlighted. In solve, the days with reveals are striped on top of the rest
    histogram(details, results, today) {
        const split = Boolean(details.splitByReveals);
        const columns = details.columns(results).map((column) => {
            const days = results.filter(column.holds);
            return {
                column,
                count: days.length,
                revealed: split ? days.filter((result) => result.reveals > 0).length : 0,
                isToday: Boolean(today) && column.holds(today),
            };
        });
        const most = Math.max(1, ...columns.map(({ count }) => count));
        const drawn = columns.map(({ column, count, revealed, isToday }) => {
            const clean = count - revealed;
            const range = `${column.range}: ${count} day${count === 1 ? '' : 's'}${revealed ? `, ${revealed} with reveals` : ''}`;
            return `
                <div class="histogram-column" title="${range}">
                    <b>${count || ''}</b>
                    <span class="histogram-bar${isToday ? ' today' : ''}${count ? '' : ' empty'}" style="--fill: ${count / most}">
                        ${revealed ? `<i class="revealed" style="flex-grow: ${revealed}"></i>` : ''}
                        ${clean ? `<i style="flex-grow: ${clean}"></i>` : ''}
                    </span>
                    <small>${column.label}</small>
                </div>`;
        });
        const legend = columns.some(({ revealed }) => revealed)
            ? '<p class="histogram-legend"><span class="swatch"></span>no reveals <span class="swatch revealed"></span>with 💡 reveals</p>'
            : '';
        return `<div class="stats-histogram" style="--columns: ${columns.length}">${drawn.join('')}</div>${legend}`;
    }

    render() {
        const mode = this.manager.gameMode;
        const details = MODE_DETAILS[mode];
        const stats = this.manager.stats;
        const results = stats.results(mode);
        const { current, best } = stats.getStreaks(mode, this.manager.gameId);
        const today = results.find((result) => result.gameId === this.manager.gameId);


        const numbers = [
            [results.length.toLocaleString(), 'Played'],
            [`${current}${current > 0 ? '<small>🔥</small>' : ''}`, 'Current streak'],
            [best.toLocaleString(), 'Best streak'],
            ...details.extras.map(([label, value]) => [value(results), label]),
        ];
        this.content.innerHTML = `
            <h2 id="stats-title">${details.title} stats</h2>
            <div class="stats-numbers" style="--columns: ${numbers.length}">
                ${numbers.map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}
            </div>
            <h3>${details.chartTitle}</h3>
            ${results.length === 0 ? '<p class="fine-print">Finish today\'s puzzle to start your stats.</p>'
                : this.histogram(details, results, today)}
            ${this.getYesterdayBest()}
            <p class="fine-print">A day counts once you finish it${mode === 'solve' ? ', reveals or not' : ''}. ${this.manager.account && this.manager.account.signedIn ? 'Stats are saved to your account.' : 'Stats are kept in this browser only (👥 to keep them on every device).'}</p>
            ${this.canCopyResults() ? `<div class="stats-share"><button id="stats-copy-button" class="pill primary">${this.pageCopyButton.textContent}</button>${this.manager.friendsPopup ? '<button id="stats-scoreboard-button" class="pill">FRIENDS</button>' : ''}</div>` : ''}`;
        const copyButton = document.getElementById('stats-copy-button');
        if (copyButton) {
            copyButton.addEventListener('click', () => this.pageCopyButton.click());
        }
        // after a win: straight on to today's results among friends (the 👥 popup)
        const scoreboardButton = document.getElementById('stats-scoreboard-button');
        if (scoreboardButton) {
            scoreboardButton.addEventListener('click', () => {
                this.hide();
                this.manager.friendsPopup.show();
            });
        }
    }

    // score mode: the line the page shows about yesterday's best solution, repeated here
    getYesterdayBest() {
        const line = document.getElementById('yesterday-best');
        return line ? `<h3>Yesterday's best</h3><p>${line.innerHTML}</p>` : '';
    }

    // only once today's puzzle is solved: whenever the page shows its COPY RESULTS button
    canCopyResults() {
        return getComputedStyle(this.pageCopyButton).display !== 'none';
    }
}

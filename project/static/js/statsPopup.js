import { formatTime } from './helpers.js';

// what each mode shows: extra numbers next to played / streaks, and a bar chart of results
// (bucket(result) gives a result's bar, so today's bar can be highlighted)
const MODE_DETAILS = {
    solve: {
        title: '🔑 SOLVE',
        extras: [
            // a non-breaking hyphen, so a narrow box wraps as "No-reveal / solves"
            ['No\u2011reveal solves', (results) => results.filter((result) => result.reveals === 0).length.toLocaleString()],
            // tiles revealed per day, to one decimal place
            ['Avg reveals', (results) => results.length
                ? (results.reduce((sum, result) => sum + result.reveals, 0) / results.length).toFixed(1).replace(/\.0$/, '')
                : '–'],
        ],
        chartTitle: 'Solve times',
        bars: ['under 2m', '2–5m', '5–10m', '10m+'],
        bucket: (result) => timeBucket(result.seconds, [120, 300, 600]),
    },
    speed: {
        title: '⏱️ SPEED',
        extras: [
            ['Best time', (results) => results.length ? formatTime(Math.min(...results.map((result) => result.seconds))) : '–'],
        ],
        chartTitle: 'Times',
        bars: ['under 1m', '1–2m', '2–3m', '3–5m', '5m+'],
        bucket: (result) => timeBucket(result.seconds, [60, 120, 180, 300]),
    },
    score: {
        title: '🎯 SCORE',
        extras: [
            ['Perfect scores', (results) => results.filter((result) => result.points >= result.max).length.toLocaleString()],
        ],
        chartTitle: 'Share of the max score',
        bars: ['100%', '90–99%', '75–89%', 'under 75%'],
        bucket: (result) => {
            const percent = result.points / result.max;
            return percent >= 1 ? 0 : percent >= 0.9 ? 1 : percent >= 0.75 ? 2 : 3;
        },
    },
};

// which bar a time falls in, given the upper limits of every bar but the last
function timeBucket(seconds, limits) {
    const i = limits.findIndex((limit) => seconds < limit);
    return i === -1 ? limits.length : i;
}

// the stats popup: opened by the 📊 button, and after finishing today's puzzle
export class StatsPopup {
    constructor(manager) {
        this.manager = manager;
        this.overlay = document.getElementById('stats-overlay');
        this.content = document.getElementById('stats-content');
        document.getElementById('stats-button').addEventListener('click', () => this.show());
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

    render() {
        const mode = this.manager.gameMode;
        const details = MODE_DETAILS[mode];
        const stats = this.manager.stats;
        const results = stats.results(mode);
        const { current, best } = stats.getStreaks(mode, this.manager.gameId);
        const today = results.find((result) => result.gameId === this.manager.gameId);

        const counts = details.bars.map(() => 0);
        results.forEach((result) => counts[details.bucket(result)]++);
        const most = Math.max(1, ...counts);
        const todayBar = today ? details.bucket(today) : -1;

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
            ${results.length === 0 ? '<p class="fine-print">Finish today\'s puzzle to start your stats.</p>' : `
            <div class="stats-chart">
                ${details.bars.map((label, i) => `
                    <span class="stats-bar-label">${label}</span>
                    <span class="stats-bar${i === todayBar ? ' today' : ''}" style="--fill: ${Math.max(counts[i] / most, 0.06)}"><b>${counts[i]}</b></span>
                `).join('')}
            </div>`}
            <p class="fine-print">A day counts once you finish it${mode === 'solve' ? ', reveals or not' : ''}. Stats are kept in this browser only.</p>`;
    }
}

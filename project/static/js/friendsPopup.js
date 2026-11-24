import { formatTime } from './helpers.js';

const MODES = ['solve', 'speed', 'score'];
const MODE_TITLES = { solve: '🔑 SOLVE', speed: '⏱️ SPEED', score: '🎯 SCORE' };
const MODE_EMOJIS = { solve: '🔑', speed: '⏱️', score: '🎯' };

// how each mode ranks results: a negative number puts a first
const COMPARE = {
    solve: (a, b) => a.reveals - b.reveals || a.seconds - b.seconds, // fewer reveals, then faster
    speed: (a, b) => a.seconds - b.seconds,
    score: (a, b) => b.points - a.points,
};

// usernames are only letters, numbers and _ (the server checks), but never trust text in HTML
function escape(text) {
    return String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

// the 👥 popup: sign up / sign in, then today's scoreboard among your friends, your friend link, and
// signing in on another device. A friend link (constrainbow.com/friend/CODE) opens the game with
// ?friend=CODE; the code waits in localStorage until this player is signed in, then makes them friends
export class FriendsPopup {
    constructor(manager) {
        this.manager = manager;
        this.account = manager.account;
        this.overlay = document.getElementById('friends-overlay');
        this.content = document.getElementById('friends-content');
        this.button = document.getElementById('friends-button');
        this.view = 'main';       // 'main', or 'board' (a person's finished board)
        this.formMode = 'signup'; // which form a signed-out player sees
        this.sortMode = null;     // a tapped column; null: the default
        this.message = '';        // a note at the top, like "You and Sam are now friends"
        this.invite = null;       // {code, username} of a friend link waiting for this player to sign in
        this.scoreboard = null;

        this.button.addEventListener('click', () => this.show());
        // while a person's board is open, ×, a click outside and the browser's back all go back to the table
        document.getElementById('friends-close-button').addEventListener('click', () => this.closeOrGoBack());
        this.overlay.addEventListener('click', (event) => {
            if (event.target === this.overlay) {
                this.closeOrGoBack();
            }
        });
        // opening a board adds a step to the browser's history (see renderBoard), so a phone's back
        // gesture returns to the table instead of leaving the page
        window.addEventListener('popstate', () => {
            if (this.view === 'board') {
                this.view = 'main';
                this.render();
            }
        });
        this.account.onChange(() => {
            this.updateButton();
            if (this.isOpen()) {
                this.render();
                if (this.account.signedIn && !this.scoreboard) {
                    this.loadScoreboard();
                }
            }
        });
        this.readLinkFromAddress();
    }

    isOpen() {
        return this.overlay.style.visibility === 'visible';
    }

    async show() {
        this.view = 'main';
        this.overlay.style.visibility = 'visible';
        if (this.manager.board) {
            this.manager.board.pause();
        }
        this.render();
        if (this.account.signedIn) {
            await this.loadScoreboard();
        }
    }

    hide() {
        this.overlay.style.visibility = 'hidden';
        this.message = '';
    }

    closeOrGoBack() {
        if (this.view === 'board') {
            this.backToTable();
        } else {
            this.hide();
        }
    }

    // undoes the history step the board added; the popstate listener then draws the table
    backToTable() {
        if (history.state && history.state.friendsBoard) {
            history.back();
        } else {
            this.view = 'main';
            this.render();
        }
    }

    // a dot on the 👥 button while a friend link waits for this player to sign up
    updateButton() {
        this.button.classList.toggle('has-invite', Boolean(this.invite) && !this.account.signedIn);
    }

    // ?friend=CODE (a friend link) and ?signin=ok|expired (a "sign in on another device" link)
    readLinkFromAddress() {
        const params = new URLSearchParams(location.search);
        const code = params.get('friend');
        const signin = params.get('signin');
        if (code || signin) {
            params.delete('friend');
            params.delete('signin');
            const rest = params.toString();
            history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : ''));
        }
        if (code) {
            localStorage.setItem('friendInvite', code);
        }
        // opened once the page has heard from the server (afterSync), so it knows who's signed in
        if (signin === 'expired') {
            this.message = 'That sign-in link has expired or was already used. Make a new one on your other device.';
        } else if (signin === 'ok') {
            this.message = 'Signed in on this device.';
        }
        this.openSigninOnLoad = Boolean(signin);
        this.openInviteOnLoad = Boolean(code);
    }

    // after the page's own sync with the server: open for a sign-in link, and deal with a waiting friend link
    async afterSync() {
        if (this.openSigninOnLoad) {
            this.openSoon();
        }
        const code = localStorage.getItem('friendInvite');
        if (!code) {
            this.updateButton();
            return;
        }
        if (code === 'bad') {
            localStorage.removeItem('friendInvite');
            this.message = "That friend link doesn't work. Ask for a new one.";
            this.openSoon();
            return;
        }
        if (this.account.signedIn) {
            await this.acceptInvite(code);
            if (this.openInviteOnLoad) {
                this.openSoon();
            }
            return;
        }
        try {
            const response = await fetch(`/account/friend-code/${encodeURIComponent(code)}`);
            if (!response.ok) {
                localStorage.removeItem('friendInvite');
                this.message = "That friend link doesn't work any more. Ask for a new one.";
                if (this.openInviteOnLoad) {
                    this.openSoon();
                }
                return;
            }
            const data = await response.json();
            this.invite = { code, username: data.username };
        } catch (e) {
            return;
        }
        this.updateButton();
        if (this.openInviteOnLoad) {
            this.openSoon();
        }
    }

    // opens the popup now, or once the how-to-play popup (a new player's first visit) is closed
    openSoon() {
        const howToPlay = document.getElementById('how-to-play-overlay');
        if (howToPlay && howToPlay.style.visibility === 'visible') {
            const watcher = new MutationObserver(() => {
                if (howToPlay.style.visibility !== 'visible') {
                    watcher.disconnect();
                    this.show();
                }
            });
            watcher.observe(howToPlay, { attributes: true, attributeFilter: ['style'] });
        } else {
            this.show();
        }
    }

    async acceptInvite(code) {
        localStorage.removeItem('friendInvite');
        this.invite = null;
        this.updateButton();
        try {
            const { ok, data } = await this.account.post('/account/befriend', { code });
            if (!ok) {
                this.message = data.error || "That friend link didn't work.";
            } else if (data.status === 'self') {
                this.message = "That's your own friend link. Send it to a friend!";
            } else if (data.status === 'friends') {
                this.message = `You and ${escape(data.username)} are already friends.`;
            } else {
                this.message = `You and ${escape(data.username)} are now friends.`;
            }
        } catch (e) {
            this.message = "That friend link didn't work. Try opening it again.";
        }
    }

    async loadScoreboard() {
        try {
            const response = await fetch('/account/scoreboard');
            if (response.status === 401) {
                this.account.setInfo({ signedIn: false });
                return;
            }
            this.scoreboard = await response.json();
        } catch (e) {
            this.scoreboard = null;
        }
        if (this.isOpen() && this.view === 'main') {
            this.render();
        }
    }

    render() {
        if (this.view === 'board') {
            return; // the board view draws itself (renderBoard)
        }
        const note = this.message ? `<p class="friends-message">${this.message}</p>` : '';
        if (!this.account.signedIn) {
            this.content.innerHTML = `<h2 id="friends-title">Friends</h2>${note}${this.signInForm()}${this.privacyNote()}`;
            this.setUpForm();
            return;
        }
        this.content.innerHTML = `
            <h2 id="friends-title">Friends</h2>
            ${note}
            ${this.scoreboard ? this.table() : '<p class="fine-print">Loading…</p>'}
            ${this.linkSection()}
            <p class="fine-print friends-account">Signed in as <strong>${escape(this.account.info.username)}</strong>. <button id="sign-out-button" class="text-button">Sign out</button></p>
            ${this.privacyNote()}`;
        this.setUpSignedIn();
    }

    // what an account stores and who sees it (the first personal data the site keeps)
    privacyNote() {
        return `
            <details class="fine-print privacy-note">
                <summary>Privacy</summary>
                <p>Accounts are optional. With one, the game keeps your username, your password in scrambled form (a hash, so not even I can read it), your result and finished board for each puzzle, the past puzzles you've finished, and who your friends are. A cookie keeps you signed in. No email, no ads, and nothing is sold or shared.</p>
                <p>Your friends see your username and today's results. Nobody else does.</p>
                <p>Whether or not you have an account, the game also counts plays anonymously (a random number for each browser, no IP addresses) so I can see how it's doing.</p>
                <p>To delete your account, send feedback from the how-to-play popup (the ? button) with your username.</p>
            </details>`;
    }

    // ---- signed out ----

    signInForm() {
        const isSignUp = this.formMode === 'signup';
        const invite = this.invite
            ? `<p class="friends-invite"><strong>${escape(this.invite.username)}</strong> sent you a friend link. ${isSignUp ? 'Make an account' : 'Sign in'} and you'll be friends.</p>`
            : `<p>Sign in to keep your stats on every device and see how your friends did today.</p>`;
        return `
            ${invite}
            <div class="pill-toggle friends-tabs" role="group" aria-label="Sign up or sign in">
                <button id="signup-tab" class="${isSignUp ? 'active' : ''}">NEW ACCOUNT</button>
                <button id="signin-tab" class="${isSignUp ? '' : 'active'}">SIGN IN</button>
            </div>
            <form id="account-form" class="account-form" novalidate>
                <label>Username
                    <input id="account-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="16" required>
                </label>
                <label>Password
                    <input id="account-password" name="password" type="password" autocomplete="${isSignUp ? 'new-password' : 'current-password'}" maxlength="200" required>
                </label>
                <p id="account-error" class="account-error" role="alert"></p>
                <button type="submit" class="pill primary">${isSignUp ? 'MAKE ACCOUNT' : 'SIGN IN'}</button>
            </form>
            ${isSignUp ? `<p class="fine-print">No email needed, so there's <strong>no password reset</strong>: write your password down. Usernames are 3–16 letters, numbers or _, and your friends see yours. They must be unique, except I don't have many players yet, so you can probably have your first name if you want it.</p>` : ''}`;
    }

    setUpForm() {
        document.getElementById('signup-tab').addEventListener('click', () => { this.formMode = 'signup'; this.render(); });
        document.getElementById('signin-tab').addEventListener('click', () => { this.formMode = 'signin'; this.render(); });
        const form = document.getElementById('account-form');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('account-username').value.trim();
            const password = document.getElementById('account-password').value;
            const error = document.getElementById('account-error');
            const submit = form.querySelector('button[type="submit"]');
            submit.disabled = true;
            error.textContent = '';
            let problem;
            try {
                problem = this.formMode === 'signup'
                    ? await this.account.signUp(username, password)
                    : await this.account.signIn(username, password);
            } catch (e) {
                problem = "Couldn't reach the server. Try again.";
            }
            if (problem) {
                error.textContent = problem;
                submit.disabled = false;
                return;
            }
            // signed in: a waiting friend link goes through now
            const code = localStorage.getItem('friendInvite');
            this.message = '';
            if (code) {
                await this.acceptInvite(code);
            }
            this.manager.statsPopup.render(); // stats may have grown from the account
            await this.loadScoreboard();
        });
    }

    // ---- signed in ----

    // today's results: one row per person, a column per mode. A mode you haven't finished today shows
    // 🔒 for your friends (the server doesn't send their results until yours is in)
    table() {
        const board = this.scoreboard;
        const unlocked = board.unlocked;
        const sortMode = this.sortMode || unlocked[0] || null; // default: the leftmost mode you've finished
        const rows = this.sortRows(board.rows, sortMode);
        const crowns = this.crowns(board.rows, unlocked);
        const header = MODES.map((mode) => `
            <th scope="col"><button class="sort-button${mode === sortMode ? ' sorted' : ''}" data-mode="${mode}"${unlocked.includes(mode) ? '' : ' disabled'}><span aria-hidden="true">${MODE_EMOJIS[mode]}</span>${mode.toUpperCase()}</button></th>`).join('');
        const body = rows.map((row) => `
            <tr${row.isYou ? ' class="you"' : ''}>
                <th scope="row">${escape(row.username)}${row.isYou ? '<span class="visually-hidden"> (you)</span>' : ''}</th>
                ${MODES.map((mode) => this.cell(row, mode, crowns[mode])).join('')}
                <td class="remove-cell">${row.isYou ? '' : `<button class="remove-friend" data-username="${escape(row.username)}" aria-label="Remove ${escape(row.username)}">🗑</button>`}</td>
            </tr>`).join('');
        const lonely = board.rows.length === 1
            ? '<p class="fine-print">No friends yet. Send someone your friend link below.</p>'
            : '';
        return `
            <div class="scoreboard-wrap">
                <table class="scoreboard">
                    <thead><tr><th scope="col"><span class="visually-hidden">Player</span></th>${header}<th scope="col"><span class="visually-hidden">Remove</span></th></tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
            ${lonely}
            <p class="fine-print">Today's results. Finish today's puzzle to drop the 🔒 lock on that game mode. Fewest 💡 reveals wins for SOLVE, ties are broken by time. Click a friend's result to see their finished board.</p>`;
    }

    cell(row, mode, crowned) {
        const result = row.results[mode];
        if (result === 'locked') {
            return '<td class="locked">🔒</td>';
        }
        if (!result) {
            return '<td class="not-played">-</td>';
        }
        const crown = crowned.includes(row) ? ' 👑' : '';
        const tappable = Array.isArray(result.words);
        const label = `${this.formatResult(mode, result)}${crown}`;
        return `<td>${tappable
            ? `<button class="result-button" data-mode="${mode}" data-username="${escape(row.username)}">${label}</button>`
            : label}</td>`;
    }

    formatResult(mode, result) {
        if (mode === 'score') {
            return `${result.points}`;
        }
        const time = formatTime(result.seconds);
        return mode === 'solve' && result.reveals > 0 ? `${time} <small>💡${result.reveals}</small>` : time;
    }

    // people with a result in the sorted mode come first, best first; everyone else after, A to Z
    sortRows(rows, mode) {
        const byName = (a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
        if (!mode) {
            return [...rows].sort(byName);
        }
        const has = (row) => row.results[mode] && row.results[mode] !== 'locked';
        return [...rows].sort((a, b) => {
            if (has(a) !== has(b)) {
                return has(a) ? -1 : 1;
            }
            return (has(a) ? COMPARE[mode](a.results[mode], b.results[mode]) : 0) || byName(a, b);
        });
    }

    // the 👑 in each unlocked mode: everyone tied for the best result, once at least two people have one
    crowns(rows, unlocked) {
        const crowns = {};
        MODES.forEach((mode) => {
            crowns[mode] = [];
            const played = rows.filter((row) => row.results[mode] && row.results[mode] !== 'locked');
            if (!unlocked.includes(mode) || played.length < 2) {
                return;
            }
            const best = played.reduce((a, b) => (COMPARE[mode](b.results[mode], a.results[mode]) < 0 ? b : a));
            crowns[mode] = played.filter((row) => COMPARE[mode](row.results[mode], best.results[mode]) === 0);
        });
        return crowns;
    }

    linkSection() {
        return `
            <h3>Add a friend</h3>
            <p>Send this link to a friend. When they open it and sign in, you'll be friends.</p>
            <div class="link-row">
                <input id="friend-link" class="link-box" readonly value="${escape(this.account.info.friendLink)}" aria-label="Your friend link">
                <button id="copy-friend-link" class="pill primary">COPY</button>
            </div>
            <p class="fine-print">Posted it somewhere public by mistake? <button id="new-friend-link" class="text-button">Make a new link</button> (the old one stops working; friends stay friends).</p>
            <h3>Sign in on another device</h3>
            <div id="device-link-area">
                <button id="device-link-button" class="pill">MAKE A SIGN-IN LINK</button>
            </div>`;
    }

    setUpSignedIn() {
        this.content.querySelectorAll('.sort-button').forEach((button) => {
            button.addEventListener('click', () => {
                this.sortMode = button.dataset.mode;
                this.render();
            });
        });
        this.content.querySelectorAll('.result-button').forEach((button) => {
            button.addEventListener('click', () => this.renderBoard(button.dataset.username, button.dataset.mode));
        });
        this.content.querySelectorAll('.remove-friend').forEach((button) => {
            button.addEventListener('click', () => this.removeFriend(button.dataset.username));
        });
        document.getElementById('copy-friend-link').addEventListener('click', (event) => {
            this.copy(this.account.info.friendLink, event.target);
        });
        document.getElementById('new-friend-link').addEventListener('click', async () => {
            if (!confirm('Make a new friend link? The old one will stop working. Your friends stay your friends.')) {
                return;
            }
            const { ok, data } = await this.account.post('/account/new-friend-link');
            if (ok) {
                this.account.setInfo(data);
            }
        });
        document.getElementById('device-link-button').addEventListener('click', () => this.makeDeviceLink());
        document.getElementById('sign-out-button').addEventListener('click', async () => {
            await this.account.signOut();
            this.scoreboard = null;
            this.message = 'Signed out. Your stats stay in this browser.';
            this.render();
        });
    }

    async removeFriend(username) {
        if (!confirm(`Remove ${username}? You'll no longer be friends.`)) {
            return;
        }
        await this.account.post('/account/unfriend', { username });
        this.message = '';
        await this.loadScoreboard();
    }

    async makeDeviceLink() {
        const area = document.getElementById('device-link-area');
        const { ok, data } = await this.account.post('/account/device-link');
        if (!ok) {
            area.innerHTML = '<p class="account-error">Couldn\'t make a link. Try again.</p>';
            return;
        }
        area.innerHTML = `
            <p>Open this link on your other device within ${data.minutes} minutes. It works once.</p>
            <div class="link-row">
                <input class="link-box" readonly value="${escape(data.url)}" aria-label="Sign-in link">
                <button id="copy-device-link" class="pill primary">COPY</button>
            </div>`;
        document.getElementById('copy-device-link').addEventListener('click', (event) => this.copy(data.url, event.target));
    }

    copy(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            button.textContent = 'COPIED!';
            setTimeout(() => { button.textContent = 'COPY'; }, 2000);
        });
    }

    // ---- one person's finished board ----

    // drawn like the how-to-play example board: SOLVE marks the tiles they revealed with 💡
    renderBoard(username, mode) {
        const row = this.scoreboard.rows.find((r) => r.username === username);
        const result = row && row.results[mode];
        const grid = this.scoreboard.grids[mode];
        if (!result || !grid || !Array.isArray(result.words)) {
            return;
        }
        this.view = 'board';
        history.pushState({ friendsBoard: true }, '');
        const revealed = result.revealed || [];
        const isRevealed = (w, l) => revealed.some(([rw, rl]) => rw === w && rl === l);
        const rows = grid.map((colors, w) => `
            <div class="example-row valid">
                ${colors.map((color, l) => `<div class="example-letter${color ? ` c${color}` : ''}${isRevealed(w, l) ? ' revealed-tile' : ''}">${result.words[w][l].toUpperCase()}</div>`).join('')}
            </div>`).join('');
        const summary = mode === 'score'
            ? `${result.points} of ${result.max} points`
            : mode === 'solve'
                ? `${formatTime(result.seconds)}, ${result.reveals === 0 ? 'no reveals' : `${result.reveals} tile${result.reveals === 1 ? '' : 's'} revealed 💡`}`
                : formatTime(result.seconds);
        this.content.innerHTML = `
            <button id="board-back-button" class="text-button">‹ Back</button>
            <h2 id="friends-title">${escape(username)}${row.isYou ? ' (you)' : ''}</h2>
            <p>${MODE_TITLES[mode]} · ${summary}</p>
            <div class="example-board friend-board">${rows}</div>`;
        document.getElementById('board-back-button').addEventListener('click', () => this.backToTable());
    }
}

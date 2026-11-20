import { Letter } from './letter.js';
import { WORD_LENGTH } from './helpers.js';

export class Word {
    // w: index of the word
    constructor(w, manager) {
        this.index = w;
        this.manager = manager;
        this.letters = [];
        this.numFilledLetters = 0;
        this.isValid = false;
    }

    // each word sits on its own strip (a "rail"), so it's clear that only the rows are words
    // the rail turns green when the row is a real word, and red when it's full but not a word
    appendWordElement(container) {
        this.rowElement = document.createElement('div');
        this.rowElement.classList.add('word-row');
        this.letters.forEach((letter) => {
            this.rowElement.appendChild(letter.tileElement);
        });
        container.appendChild(this.rowElement);
    }

    setRowState(state) {
        // state is 'valid', 'invalid', or '' for neither
        if (!this.rowElement) {
            return;
        }
        this.rowElement.classList.toggle('valid', state === 'valid');
        this.rowElement.classList.toggle('invalid', state === 'invalid');
        // easter eggs, for as long as the word is there: a row that spells SLANT leans like italic type,
        // one that spells ASKEW knocks its tiles crooked, one that spells ROUND turns them into circles,
        // one that spells CUBIC turns them into blocks, one that spells WACKY jumbles its letters, one that
        // spells SHAKE rattles, one that spells QUAKE sets off an earthquake, one that spells BLINK blinks,
        // one that spells FLOAT lets its letters drift weightless, one that spells DIZZY gets dizzy, one
        // that spells DROOP sags, one that spells JUMPY hops like jumping beans, one that spells AVOID
        // has letters that dodge the pointer (see startAvoiding), one that spells CRAZY goes wild, one that
        // spells DISCO turns into a light-up dance floor, one that spells BEEFY bulks up its letters, one
        // that spells BATTY hangs its letters upside down like bats, one that spells PIANO plays itself, one
        // that spells PLUCK twangs like a plucked guitar string (see pluck), one that spells BUGGY glitches,
        // one that spells GLASS turns its tiles to glass, one that spells CLONE clones its letters, and one
        // that spells CRASH piles up like cars on a highway (see crash)
        const word = state === 'valid' ? this.getWordString() : '';
        this.rowElement.classList.toggle('slant', word === 'slant');
        this.rowElement.classList.toggle('askew', word === 'askew');
        this.rowElement.classList.toggle('round', word === 'round');
        this.rowElement.classList.toggle('cubic', word === 'cubic');
        this.rowElement.classList.toggle('wacky', word === 'wacky');
        this.rowElement.classList.toggle('shake', word === 'shake');
        this.rowElement.classList.toggle('quake', word === 'quake');
        this.rowElement.classList.toggle('blink', word === 'blink');
        this.rowElement.classList.toggle('float', word === 'float');
        this.rowElement.classList.toggle('dizzy', word === 'dizzy');
        this.rowElement.classList.toggle('droop', word === 'droop');
        this.rowElement.classList.toggle('jumpy', word === 'jumpy');
        this.rowElement.classList.toggle('avoid', word === 'avoid');
        this.rowElement.classList.toggle('crazy', word === 'crazy');
        this.rowElement.classList.toggle('disco', word === 'disco');
        this.rowElement.classList.toggle('beefy', word === 'beefy');
        this.rowElement.classList.toggle('batty', word === 'batty');
        this.rowElement.classList.toggle('piano', word === 'piano');
        this.rowElement.classList.toggle('buggy', word === 'buggy');
        this.rowElement.classList.toggle('glass', word === 'glass');
        this.rowElement.classList.toggle('clone', word === 'clone');
        const wasPluck = this.rowElement.classList.contains('pluck');
        this.rowElement.classList.toggle('pluck', word === 'pluck');
        const wasCrash = this.rowElement.classList.contains('crash');
        this.rowElement.classList.toggle('crash', word === 'crash');
        if (word === 'avoid') {
            this.startAvoiding();
        } else {
            this.stopAvoiding();
        }
        if (word === 'pluck' && !wasPluck) {
            this.pluck();
        } else if (word !== 'pluck') {
            this.stopPlucking();
        }
        if (word === 'crash' && !wasCrash) {
            this.crash();
        } else if (word !== 'crash') {
            this.stopCrashing();
        }
    }

    // easter egg: a row that spells PLUCK is a guitar string (the ink link bar), plucked once from the middle:
    // the middle tile pulls the string up into a bow, holds, and lets go, and the string vibrates and dies away.
    // It moves like a real string: its main bow swinging, with the faster third harmonic shimmering on top
    // (the ends move least, the middle most), and each tile tilts along the curve. While it plays, the bar is
    // swapped for four short links, one per gap (each tile's .letter-extra), which stretch and turn to stay
    // joined to the tiles either side
    pluck() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        this.stopPlucking();
        const tiles = this.letters.map((letter) => letter.tileElement);
        const size = tiles[0].offsetWidth;
        const gap = parseFloat(getComputedStyle(this.rowElement).columnGap) || 0;
        const step = size + gap; // from one tile's center to the next
        const height = size * 0.3; // how far the middle is pulled
        const pullTime = 350, holdTime = 100, ringTime = 2000;
        const duration = pullTime + holdTime + ringTime;

        // the string's shape at a time t (ms) after it's let go, at the five tiles: a plucked string's first and
        // third harmonics (the others are small), each fading, the third faster
        const positions = [1, 2, 3, 4, 5].map((k) => k / 6); // the string's ends are a tile past the row's ends
        const shapeAt = (t) => positions.map((x) => {
            const first = 0.811 * Math.sin(Math.PI * x) * Math.cos(2 * Math.PI * 7 * t / 1000) * Math.exp(-t / 500);
            const third = -0.090 * Math.sin(3 * Math.PI * x) * Math.cos(2 * Math.PI * 21 * t / 1000) * Math.exp(-t / 250);
            return -height * (first + third) / 0.901;
        });

        // a frame for each 16 ms: the pull (eased), the hold, then the ringing
        const frames = [];
        for (let t = 0; t <= duration; t += 16) {
            let heights;
            if (t < pullTime) {
                const eased = 1 - Math.pow(1 - t / pullTime, 3);
                heights = shapeAt(0).map((y) => y * eased);
            } else if (t < pullTime + holdTime) {
                heights = shapeAt(0);
            } else {
                heights = shapeAt(t - pullTime - holdTime);
            }
            frames.push({ offset: t / duration, heights });
        }
        frames.push({ offset: 1, heights: [0, 0, 0, 0, 0] });

        // each tile tilts along the string (a little less than the string's slope, so it reads as a tile)
        const tiltsOf = (heights) => heights.map((y, k) => {
            const before = k > 0 ? heights[k - 1] : 0;
            const after = k < 4 ? heights[k + 1] : 0;
            return 0.6 * Math.atan((after - before) / (2 * step));
        });

        this.rowElement.classList.add('plucking');
        const timing = { duration, easing: 'linear' };
        this.pluckAnimations = tiles.map((tile, k) => tile.animate(frames.map((frame) => ({
            offset: frame.offset,
            translate: `0px ${frame.heights[k].toFixed(2)}px`,
            rotate: `${tiltsOf(frame.heights)[k].toFixed(4)}rad`,
        })), timing));

        // the links: from the right edge of tile k to the left edge of tile k + 1, wherever they've moved
        tiles.slice(0, 4).forEach((tile, k) => {
            const link = tile.querySelector('.letter-extra');
            this.pluckAnimations.push(link.animate(frames.map((frame) => {
                const tilts = tiltsOf(frame.heights);
                const startX = k * step + size / 2 * Math.cos(tilts[k]);
                const startY = frame.heights[k] + size / 2 * Math.sin(tilts[k]);
                const endX = (k + 1) * step - size / 2 * Math.cos(tilts[k + 1]);
                const endY = frame.heights[k + 1] - size / 2 * Math.sin(tilts[k + 1]);
                const angle = Math.atan2(endY - startY, endX - startX) - tilts[k]; // the tile's own tilt turns it too
                const length = Math.hypot(endX - startX, endY - startY);
                return {
                    offset: frame.offset,
                    rotate: `${angle.toFixed(4)}rad`,
                    scale: `${(length / gap).toFixed(3)} 1`,
                };
            }), timing));
        });
        this.pluckAnimations[0].finished.then(() => this.stopPlucking(), () => {});
    }

    stopPlucking() {
        if (!this.pluckAnimations) {
            return;
        }
        this.pluckAnimations.forEach((animation) => animation.cancel());
        this.pluckAnimations = null;
        this.rowElement.classList.remove('plucking');
    }

    // easter egg: a row that spells CRASH piles up like cars on a highway, once: the first tile backs up, floors
    // it and slams into the second, which lurches into the third, and so on down the row, each hit squashing
    // both tiles a little and losing some energy, until the last tile skids to a stop; then the row eases back
    // into place. The letters obey the same physics: a letter stays put while its tile starts to move, until
    // the tile's inner left wall reaches it and shoves it along, and when its tile stops short the letter
    // keeps going and smacks into the inner right wall. A small simulation works this out (simulateCrash),
    // and its result plays as an animation of each tile's and letter's translate
    crash() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        this.stopCrashing();
        const tiles = this.letters.map((letter) => letter.tileElement);
        const texts = this.letters.map((letter) => letter.textElement);
        const size = tiles[0].offsetWidth;
        const gap = parseFloat(getComputedStyle(this.rowElement).columnGap) || 0;
        // how far each letter can slide before it touches a wall of its tile
        const room = texts.map((text, k) => Math.max(0, (tiles[k].clientWidth - text.offsetWidth) / 2 - 1));
        const frames = this.simulateCrash(size, gap, room);
        const duration = frames[frames.length - 1].t;
        const timing = { duration, easing: 'linear' };
        this.crashAnimations = [];
        tiles.forEach((tile, k) => {
            this.crashAnimations.push(tile.animate(frames.map((frame) => ({
                offset: frame.t / duration,
                translate: `${frame.tiles[k].toFixed(2)}px 0px`,
                scale: `${frame.squash[k].toFixed(3)} ${(2 - frame.squash[k]).toFixed(3)}`,
            })), timing));
            this.crashAnimations.push(texts[k].animate(frames.map((frame) => ({
                offset: frame.t / duration,
                translate: `${frame.letters[k].toFixed(2)}px 0px`,
            })), timing));
        });
        this.crashAnimations[0].finished.then(() => this.stopCrashing(), () => {});
    }

    // the physics for CRASH, in one dimension, a frame every 16 ms. Tiles are equal masses sliding with friction;
    // when two touch while closing in they collide, keeping their momentum and losing some energy (restitution
    // 0.3); the first tile keeps accelerating a moment after its first hit, crunching the pile together. Each letter slides freely inside its tile between walls `room` px either side of center, bouncing
    // softly off them. Returns, per frame, each tile's offset from its place, its squash (from the hits), and
    // each letter's offset inside its tile
    simulateCrash(size, gap, room) {
        const dt = 1 / 240; // seconds per physics step (4 per frame, so fast hits don't pass through each other)
        const backUp = size * 0.45, backUpTime = 0.35, pause = 0.12; // the first tile reverses, then waits
        const throttle = 4200; // px/s², the first tile's acceleration
        const pushOn = 0.2; // seconds the first driver keeps the gas down after the first hit, crunching the pile
        const friction = 2200; // px/s², how fast a sliding tile slows down (the others are braking)
        const bounce = 0.3, letterBounce = 0.4;
        const settleBy = 1.7, returnTime = 0.6; // when the row starts easing back, and how long that takes
        const x = [0, 0, 0, 0, 0], v = [0, 0, 0, 0, 0]; // tiles: offset and velocity
        const y = [0, 0, 0, 0, 0], u = [0, 0, 0, 0, 0]; // letters: offset inside the tile, and velocity in the world
        const hits = []; // [time, tile, strength] for the squash
        let driveUntil = Infinity; // set at the first hit
        const frames = [];
        const squashAt = (t, k) => hits.reduce((sum, [when, tile, strength]) => {
            const age = t - when;
            return tile === k && age >= 0 && age < 0.25 ? sum + strength * Math.sin(Math.PI * age / 0.25) : sum;
        }, 0);
        let endState = null;
        for (let step = 0, t = 0; t <= settleBy + returnTime + 1e-9; step++, t = step * dt) {
            if (t < settleBy) {
                const start = x.slice(); // where the tiles were at the start of this step, for the letters
                // the first tile: reverse (eased), pause, then accelerate until it hits the second
                const before = x[0];
                if (t < backUpTime) {
                    x[0] = -backUp * (1 - Math.cos(Math.PI * t / backUpTime)) / 2;
                    v[0] = (x[0] - before) / dt;
                } else if (t < backUpTime + pause) {
                    v[0] = 0;
                } else if (t < driveUntil) {
                    v[0] += throttle * dt;
                    x[0] += v[0] * dt;
                }
                // everything else slides, slowing down
                const driving = t >= backUpTime && t < driveUntil;
                for (let k = driving || t < backUpTime + pause ? 1 : 0; k < 5; k++) {
                    if (v[k] !== 0) {
                        const slowed = v[k] - Math.sign(v[k]) * friction * dt;
                        v[k] = Math.sign(slowed) === Math.sign(v[k]) ? slowed : 0;
                        x[k] += v[k] * dt;
                    }
                }
                // collisions between neighbors: the gap between them closes at gap + x[k+1] - x[k]
                for (let pass = 0; pass < 3; pass++) {
                    for (let k = 0; k < 4; k++) {
                        const overlap = -(gap + x[k + 1] - x[k]);
                        if (overlap >= 0 && v[k] > v[k + 1]) {
                            const a = v[k], b = v[k + 1];
                            v[k] = ((1 - bounce) * a + (1 + bounce) * b) / 2;
                            v[k + 1] = ((1 + bounce) * a + (1 - bounce) * b) / 2;
                            if (a - b > 80) { // a real impact, not the steady shove of the pile
                                const strength = Math.min(0.14, (a - b) / 4000);
                                hits.push([t, k, strength], [t, k + 1, strength]);
                            }
                            if (k === 0 && driveUntil === Infinity) {
                                driveUntil = t + pushOn;
                            }
                        }
                        if (overlap > 0) {
                            x[k] -= overlap / 2;
                            x[k + 1] += overlap / 2;
                        }
                    }
                }
                // letters: no friction, so each keeps its own speed until a wall of its tile reaches it
                for (let k = 0; k < 5; k++) {
                    const world = start[k] + y[k] + u[k] * dt;
                    y[k] = world - x[k];
                    u[k] *= Math.exp(-0.8 * dt); // a little drag, so they come to rest
                    if (y[k] < -room[k]) { // the left wall caught up with it (or it slid back into the left wall)
                        y[k] = -room[k];
                        if (u[k] < v[k]) {
                            u[k] = v[k] + letterBounce * (v[k] - u[k]);
                        }
                    } else if (y[k] > room[k]) { // it ran into the right wall
                        y[k] = room[k];
                        if (u[k] > v[k]) {
                            u[k] = v[k] - letterBounce * (u[k] - v[k]);
                        }
                    }
                }
            } else {
                // the scene is cleared: everything eases back to where it belongs
                if (!endState) {
                    endState = { x: x.slice(), y: y.slice() };
                }
                const p = Math.min(1, (t - settleBy) / returnTime);
                const left = 1 - (1 - Math.cos(Math.PI * p)) / 2;
                for (let k = 0; k < 5; k++) {
                    x[k] = endState.x[k] * left;
                    y[k] = endState.y[k] * left;
                }
            }
            if (step % 4 === 0) {
                frames.push({
                    t: t * 1000,
                    tiles: x.slice(),
                    letters: y.slice(),
                    squash: [0, 1, 2, 3, 4].map((k) => 1 - Math.min(0.15, squashAt(t, k))),
                });
            }
        }
        const last = frames[frames.length - 1];
        last.tiles = [0, 0, 0, 0, 0];
        last.letters = [0, 0, 0, 0, 0];
        return frames;
    }

    stopCrashing() {
        if (!this.crashAnimations) {
            return;
        }
        this.crashAnimations.forEach((animation) => animation.cancel());
        this.crashAnimations = null;
    }

    // easter egg: while the row spells AVOID, each letter is pushed away from the pointer (harder the closer it
    // gets, starting a little before it reaches the tile) and stops at the edge of its tile. On a phone there's
    // no hovering, so a tap makes the letters flinch away from the finger, and they drift back when it lifts
    startAvoiding() {
        if (this.avoidHandler) {
            return;
        }
        this.avoidHandler = (e) => this.dodge(e.clientX, e.clientY);
        this.avoidEndHandler = (e) => {
            if (e.pointerType !== 'mouse') {
                setTimeout(() => this.letters.forEach((letter) => letter.textElement.style.translate = ''), 400);
            }
        };
        document.addEventListener('pointermove', this.avoidHandler);
        document.addEventListener('pointerdown', this.avoidHandler);
        document.addEventListener('pointerup', this.avoidEndHandler);
        document.addEventListener('pointercancel', this.avoidEndHandler);
    }

    stopAvoiding() {
        if (!this.avoidHandler) {
            return;
        }
        document.removeEventListener('pointermove', this.avoidHandler);
        document.removeEventListener('pointerdown', this.avoidHandler);
        document.removeEventListener('pointerup', this.avoidEndHandler);
        document.removeEventListener('pointercancel', this.avoidEndHandler);
        this.avoidHandler = null;
        this.letters.forEach((letter) => letter.textElement.style.translate = '');
    }

    dodge(x, y) {
        this.letters.forEach((letter) => {
            const tile = letter.tileElement.getBoundingClientRect();
            const text = letter.textElement;
            // how far the letter can move before it touches its tile's edge (offsetWidth ignores the move)
            const border = parseFloat(getComputedStyle(letter.tileElement).borderTopWidth) || 0;
            const maxX = Math.max(0, (tile.width - 2 * border - text.offsetWidth) / 2);
            const maxY = Math.max(0, (tile.height - 2 * border - text.offsetHeight) / 2);
            const dx = tile.left + tile.width / 2 - x;
            const dy = tile.top + tile.height / 2 - y;
            const distance = Math.hypot(dx, dy);
            const reach = tile.width * 1.2; // the pointer starts to scare the letter from this far away
            if (distance >= reach) {
                text.style.translate = '';
                return;
            }
            const push = (reach - distance) / reach * 2 * Math.max(maxX, maxY);
            const [ux, uy] = distance > 0.5 ? [dx / distance, dy / distance] : [0, 1]; // dead center: duck down
            const moveX = Math.max(-maxX, Math.min(maxX, ux * push));
            const moveY = Math.max(-maxY, Math.min(maxY, uy * push));
            text.style.translate = `${moveX.toFixed(1)}px ${moveY.toFixed(1)}px`;
        });
    }

    // some handy functions might live here,
    // like getting a word in string version from the letters
    isAllLettersFilled() {
        const emptyLetterExists = this.letters.some(letter => {
            return letter.isBlank();
        });
        return !emptyLetterExists;
    }

    isBlank() {
        const filledLetterExists = this.letters.some(letter => {
            return !letter.isBlank();
        });
        return !filledLetterExists;
    }

    getWordString() {
        let word = '';
        this.letters.forEach(letter => {
            if (letter.value == '') {
                word = word + '-';
                return;
            }
            word = word + letter.value;
        });
        return word.toLowerCase();
    }

    getWordList() {
        return this.letters.map(letter => {
            return letter.value;
        });
    }

    turnRed() {
        this.setRowState('invalid');
        this.letters.forEach(letter => {
            letter.tileElement.classList.add('incorrect');
            letter.shake();
        });
    }
    
    clear(resetLetters) {
        this.letters.forEach(letter => {
            if (resetLetters) {
                this.updateLetter(letter.l, '');
            }
            letter.tileElement.classList.remove('incorrect');
        });
        this.setRowState(this.isValid ? 'valid' : '');
    }

    // the board will update a letter via this function, so that the word
    // can keep track of its own state
    updateLetter(l, letter, prefix){
        // l: index of the letter
        if (letter !== '' && this.letters[l].isBlank()) {
            this.numFilledLetters++;
        } else if (letter === '' && !this.letters[l].isBlank()) {
            this.numFilledLetters--;   
        }
        this.letters[l].update(letter);
        if (this.numFilledLetters === WORD_LENGTH) {
            // this letter is completing the word, must check if it is a valid word
            if (this.manager.isValidWord(this.getWordString())) {
                this.isValid = true;
                this.clear(false); // also turns the rail green
            } else {
                this.isValid = false;
                this.turnRed();
            }
        } else {
            this.isValid = false;
            this.clear(false);
        }
        // write the updated word to local storage
        localStorage.setItem(`${prefix}Word${this.index}`, JSON.stringify(this.getWordList()));
    }
}
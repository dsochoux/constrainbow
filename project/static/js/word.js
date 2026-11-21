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
        // one that spells GLASS turns its tiles to glass, one that spells CLONE clones its letters, one
        // that spells REPEL pushes the rows around it away like magnets, and one that spells CYCLE runs once
        // around like a bike chain (see cycle)
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
        this.rowElement.classList.toggle('repel', word === 'repel');
        const wasPluck = this.rowElement.classList.contains('pluck');
        this.rowElement.classList.toggle('pluck', word === 'pluck');
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
        const wasCycle = this.rowElement.classList.contains('cycle');
        this.rowElement.classList.toggle('cycle', word === 'cycle');
        if (word === 'cycle' && !wasCycle) {
            this.cycle();
        } else if (word !== 'cycle') {
            this.stopCycling();
        }
    }

    // easter egg: a row that spells CYCLE runs once around like a bike chain. The tiles move together along a
    // loop: right along the row one slot per step, and the tile at the end goes around a "gear" down under the
    // row, back along the bottom (upside down, like a chain link) and up around the front gear into the first
    // slot. Five steps take every tile all the way around and home again; it starts slowly, picks up speed
    // like someone pedaling, and settles with a little bounce
    cycle() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        this.stopCycling();
        const tiles = this.letters.map((letter) => letter.tileElement);
        const size = tiles[0].offsetWidth;
        const gap = parseFloat(getComputedStyle(this.rowElement).columnGap) || 0;
        const step = size + gap; // from one tile's center to the next
        const radius = size * 0.55; // the gears: the loop's bottom run is two radii below the row
        const duration = 2400;

        // a point on the loop, by distance along it: 0 is slot 1, the top run goes to slot 5 (4 steps), then
        // half a circle down around the back gear, the bottom run back to slot 1, and half a circle up
        const curve = Math.PI * radius, top = 4 * step;
        const length = 2 * top + 2 * curve;
        const pointAt = (d) => {
            d = ((d % length) + length) % length;
            if (d <= top) {
                return { x: d, y: 0, angle: 0 };
            }
            if (d <= top + curve) { // around the back gear
                const a = (d - top) / radius;
                return { x: top + radius * Math.sin(a), y: radius - radius * Math.cos(a), angle: a };
            }
            if (d <= 2 * top + curve) { // the bottom run, upside down
                return { x: top - (d - top - curve), y: 2 * radius, angle: Math.PI };
            }
            const a = Math.PI + (d - 2 * top - curve) / radius; // up around the front gear
            return { x: -radius * Math.sin(a - Math.PI), y: radius + radius * Math.cos(a - Math.PI), angle: a };
        };

        // how far along the loop each tile is: the top run is one step per slot, so tile k starts at k * step.
        // The tile leaving the last slot has to cover the whole loop's other side (from slot 5 back to slot 1)
        // in the time the others move one slot, so the distance it travels is stretched to fit
        const slotsToDistance = (s) => { // s: a position in slots, 0 to 5 (5 is all the way around)
            s = ((s % 5) + 5) % 5;
            return s <= 4 ? s * step : top + (s - 4) * (length - top);
        };

        // the chain's progress in slots over time (0 to 5): it eases in like someone starting to pedal, then
        // rolls a little past home and springs back (an ease-out-back). The part past home moves the whole
        // row together, without sending another tile around a gear
        const progressAt = (t) => {
            if (t < 0.5) {
                return 5 * 4 * t * t * t;
            }
            const u = 2 * t - 1, back = 1.2;
            return 5 * (0.5 + 0.5 * (1 + (back + 1) * Math.pow(u - 1, 3) + back * Math.pow(u - 1, 2)));
        };

        const frames = [];
        for (let t = 0; t <= duration; t += 16) {
            frames.push({ offset: t / duration, progress: progressAt(t / duration) });
        }
        frames.push({ offset: 1, progress: 5 });

        this.rowElement.classList.add('cycling');
        const timing = { duration, easing: 'linear' };
        this.cycleAnimations = tiles.map((tile, k) => {
            let turned = 0; // the tile's total turn so far, so a tile coming up from under keeps turning forward
            return tile.animate(frames.map((frame) => {
                const extra = frame.progress - Math.min(frame.progress, 5); // past home: the whole row shifts
                const point = pointAt(slotsToDistance(k + frame.progress - extra));
                point.x += extra * step;
                // the loop gives an angle from 0 to 2 pi; take whichever full turn is closest to the last frame
                turned = point.angle + 2 * Math.PI * Math.round((turned - point.angle) / (2 * Math.PI));
                return {
                    offset: frame.offset,
                    translate: `${(point.x - k * step).toFixed(2)}px ${point.y.toFixed(2)}px`,
                    rotate: `${turned.toFixed(4)}rad`,
                };
            }), timing);
        });
        this.cycleAnimations[0].finished.then(() => this.stopCycling(), () => {});
    }

    stopCycling() {
        if (!this.cycleAnimations) {
            return;
        }
        this.cycleAnimations.forEach((animation) => animation.cancel());
        this.cycleAnimations = null;
        this.rowElement.classList.remove('cycling');
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
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
        // has letters that dodge the pointer (see startAvoiding), one that spells CRAZY goes wild, and one
        // that spells DISCO turns into a light-up dance floor
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
        if (word === 'avoid') {
            this.startAvoiding();
        } else {
            this.stopAvoiding();
        }
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
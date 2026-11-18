export class Letter {
    constructor(w, l, constraint, clickHandler) {
        this.w = w; // index of word
        this.l = l; // index of letter
        this.constraint = constraint; // int representing the constraint
        this.clickHandler = clickHandler;
        this.textElement = this.createTextElement();
        this.tileElement = this.createTileElement(this.textElement);
        this.value = '';
        this.isSelected = false;
    }

    createTextElement() {
        // the text element is a span that will hold the letter
        const letterSpan = document.createElement('span');
        letterSpan.classList.add('letter-text');
        letterSpan.textContent = '';
        return letterSpan;
    }

    createTileElement(textElement) {
        // the tile element is the thing that is square, colored, clickable, and holds the text element
        const div = document.createElement('div');
        // add the letter span to the div
        div.appendChild(textElement);
        div.classList.add('letter');
        div.addEventListener('click', () => {
            // call the click handler with its identity
            this.clickHandler(this.w, this.l);
        });
        return div;
    }

    toggle() {
        this.setIsSelected(!this.isSelected);
    }

    setIsSelected(value) {
        this.isSelected = value;
        if (value) {
            this.tileElement.classList.add('selected');
        } else {
            this.tileElement.classList.remove('selected');
        }
    }

    update(letter) {
        this.value = letter;
        this.textElement.textContent = letter;
    }

    isConstrained() {
        return this.constraint > 0;
    }

    isTopLeft() {
        return this.w === 0 && this.l === 0;
    }

    isBlank() {
        return this.value === '';
    }

    // plays a one-shot CSS animation (pop, shake, celebrate) on the tile, after delay milliseconds
    // the class is removed again when the animation ends, so it can be played again later
    // each animation has its own delay variable (--pop-delay, --celebrate-delay): with a shared one,
    // the win cascade's delay also pushed back the last letter's pop-in, hiding it until the wave arrived
    playAnimation(className, delay = 0) {
        const tile = this.tileElement;
        tile.style.setProperty(`--${className}-delay`, `${delay}ms`);
        tile.classList.remove(className);
        void tile.offsetWidth; // forces the browser to notice the removal, so the animation restarts
        tile.classList.add(className);
        const onEnd = (e) => {
            if (e.target === tile) {
                tile.classList.remove(className);
                tile.removeEventListener('animationend', onEnd);
            }
        };
        tile.addEventListener('animationend', onEnd);
    }

    pop(delay = 0) {
        this.playAnimation('pop', delay);
    }

    shake() {
        this.playAnimation('shake');
    }

    celebrate(delay = 0) {
        this.playAnimation('celebrate', delay);
    }
}
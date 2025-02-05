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
}
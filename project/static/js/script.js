class Letter {
    // w: index of word, l: index of letter
    constructor(w, l, click_handler) {
        // a Letter needs to know "who" is is. when clicked, it must
        // tell the board that it has been selected
        this.w = w;
        this.l = l;
        this.click_handler = click_handler;
        this.textElement = this.createTextElement();
        
        // the first letter of the first word will begin in the selected state
        this.is_selected = (w == 0 && l == 0);
        this.element = this.createLetterElement(this.textElement, this.is_selected);
        
        this.current_letter = null;
    }

    createTextElement() {
        const span = document.createElement('span');
        span.classList.add('text');
        span.style.visibility = 'visible';
        span.textContent = 'Z';
        return span;
    }

    createLetterElement(text_element, is_selected) {
        const div = document.createElement('div');
        div.appendChild(text_element);
        div.classList.add('letter');
        
        if (is_selected) {
            div.classList.add('selected');
        }

        div.addEventListener('click', () => {
            this.click_handler(this.w, this.l);
        });

        return div;
    }

    appendLetterElement(container) {
        container.appendChild(this.element);
    }

    toggleIsSelected() {
        this.is_selected = !this.is_selected;
        if (this.is_selected) {
            this.element.classList.add('selected');
        } else {
            this.element.classList.remove('selected');
        }
    }

    updateLetter(letter) {
        this.current_letter = letter;
        if (letter) {
            this.textElement.textContent = letter;
            this.textElement.style.visibility = 'visible';
        } else {
            // no need to overwrite the letterElement.textContent, just hide it
            // it will be overwritten before it is made visible again
            this.textElement.style.visibility = 'hidden';
        }
    }
}

class Word {
    // w: index of the word
    constructor(w, click_handler) {
        this.index = w;
        this.letters = [];
        this.initWord(click_handler);
    }

    initWord(click_handler) {
        for (let l = 0; l < 5; l++) {
            const letter = new Letter(this.index, l, click_handler);
            this.letters.push(letter);
        }
    }

    appendWordElement(container) {
        this.letters.forEach((letter) => {
            letter.appendLetterElement(container);
        });
    }

    // some handy functions might live here,
    // like getting a word in string version from the letters
}

class Board {
    constructor(container_id, num_words) {
        this.element = document.getElementById(container_id);
        this.words = [];
        this.num_words = num_words;
        this.selected_w = 0;
        this.selected_l = 0;
        this.initBoard();

    }

    initBoard() {
        document.addEventListener('keydown', (event) => {
            this.keyPressed(event)
        });
        for (let w = 0; w < this.num_words; w++) {
            const word = new Word(w, this.handleLetterClicked.bind(this))
            this.words.push(word);
            word.appendWordElement(this.element);
        }
    }

    keyPressed(event) {
        if (event.keyCode >= 37 && event.keyCode <= 40) {
            this.handleArrowKeyPressed(event.keyCode);
            return;
        }
        if (event.keyCode >= 65 && event.keyCode <= 90) {
            console.log("letter pressed!")
            return;
        }
    }

    moveLeft() {
        let new_w = this.selected_w;
        let new_l = this.selected_l;

        new_l--;
        if (new_l < 0) {
            new_l = 4;
            new_w = this.moveUp();
        }
        return [new_w, new_l];
    }

    moveUp() {
        let new_w = this.selected_w;
        new_w--;
        if (new_w < 0) {
            new_w = 3;
        }
        return new_w;
    }

    moveRight() {
        let new_w = this.selected_w;
        let new_l = this.selected_l;
        new_l++;
        if (new_l > 4) {
            new_l = 0;
            new_w = this.moveDown();
        }
        return [new_w, new_l];
    }

    moveDown() {
        let new_w = this.selected_w;
        new_w++;
        if (new_w > 3) {
            new_w = 0;
        }
        return new_w;
    }

    handleArrowKeyPressed(key) {
        let new_w = this.selected_w;
        let new_l = this.selected_l;
        
        switch (key) {
            case 37:
                [new_w, new_l] = this.moveLeft();
                break;
            case 38:
                new_w = this.moveUp();
                break;
            case 39:
                [new_w, new_l] = this.moveRight();
                break;
            case 40:
                new_w = this.moveDown();
                break;
        }
        // toggle current off
        this.words[this.selected_w].letters[this.selected_l].toggleIsSelected();
        // toggle new on
        this.words[new_w].letters[new_l].toggleIsSelected();
        
        this.selected_w = new_w;
        this.selected_l = new_l;
    }

    handleLetterClicked(w, l) {
        // toggle current off
        this.words[this.selected_w].letters[this.selected_l].toggleIsSelected();
        // toggle new on
        this.words[w].letters[l].toggleIsSelected();

        this.selected_w = w;
        this.selected_l = l;
    }
}

const board = new Board('board', 4);

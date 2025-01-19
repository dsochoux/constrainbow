// Tile class
class Tile {
    constructor(id, state = 'inactive') {
        this.id = id; // Unique ID for the tile
        this.state = state; // State of the tile ('inactive' or 'active')
        this.element = this.createElement(); // Associated DOM element
    }

    // Create and return the DOM element for this tile
    createElement() {
        const div = document.createElement('div');
        div.classList.add('tile');
        // div.textContent = this.id;

        // Attach event listener to toggle state on click
        div.addEventListener('click', () => this.toggleState());

        return div;
    }

    // Toggle the state of the tile
    toggleState() {
        this.state = this.state === 'inactive' ? 'active' : 'inactive';
        this.updateDOM(); // Reflect the state change in the DOM
    }

    // Update the DOM element based on the current state
    updateDOM() {
        if (this.state === 'active') {
            this.element.classList.add('active');
        } else {
            this.element.classList.remove('active');
        }
    }
}

// GameBoard class
class GameBoard {
    constructor(containerId, rows, cols) {
        this.container = document.getElementById(containerId); // DOM container
        this.tiles = []; // Array to hold Tile objects
        this.rows = rows;
        this.cols = cols;

        this.initBoard();
    }

    // Initialize the board with tiles
    initBoard() {
        for (let i = 0; i < this.rows * this.cols; i++) {
            const tile = new Tile(i);
            this.tiles.push(tile);
            this.container.appendChild(tile.element); // Add tile's DOM element to the board
        }
    }

    // Example: Reset all tiles to inactive state
    resetBoard() {
        this.tiles.forEach(tile => {
            tile.state = 'inactive';
            tile.updateDOM();
        });
    }
}

// Initialize the game
const gameBoard = new GameBoard('game-board', 4, 5);

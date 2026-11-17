// the feedback form on the how-to-play popup's last step: "Send feedback" opens it, SEND posts the
// message (and an optional email for a reply) to /feedback, which Danny reads on /dashboard
export class Feedback {
    constructor(manager) {
        this.manager = manager;
        this.toggleButton = document.getElementById('feedback-toggle');
        this.form = document.getElementById('feedback-form');
        this.messageInput = document.getElementById('feedback-message');
        this.emailInput = document.getElementById('feedback-email');
        this.websiteInput = document.getElementById('feedback-website'); // hidden: only bots fill it in
        this.sendButton = document.getElementById('feedback-send');
        this.status = document.getElementById('feedback-status');

        this.toggleButton.addEventListener('click', () => {
            if (this.form.hidden) {
                this.open();
            } else {
                this.close();
            }
        });
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.send();
        });
    }

    // while the form is open, the link offers to close it again
    open() {
        this.form.hidden = false;
        this.toggleButton.textContent = "Nevermind, it's perfect";
        this.toggleButton.setAttribute('aria-expanded', 'true');
        this.status.textContent = '';
        this.messageInput.focus();
    }

    close() {
        this.form.hidden = true;
        this.toggleButton.textContent = 'Send feedback';
        this.toggleButton.setAttribute('aria-expanded', 'false');
    }

    async send() {
        const message = this.messageInput.value.trim();
        if (!message) {
            this.messageInput.focus();
            return;
        }
        this.sendButton.disabled = true;
        this.status.textContent = 'Sending...';
        // the play-test batch and /solve/day are SOLVE puzzles too
        const mode = this.manager.gameMode.startsWith('solve') ? 'solve' : this.manager.gameMode;
        try {
            const response = await fetch('/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    email: this.emailInput.value.trim(),
                    website: this.websiteInput.value,
                    player: this.manager.getPlayerId(),
                    mode,
                    game: /^[0-9]{8}$/.test(this.manager.gameId || '') ? this.manager.gameId : '',
                }),
            });
            if (response.ok) {
                this.messageInput.value = '';
                this.status.textContent = 'Thanks! Sent.';
            } else if (response.status === 429) {
                this.status.textContent = "That's a lot of feedback for one day. Try again tomorrow!";
            } else if (response.status === 400 && this.emailInput.value.trim()) {
                this.status.textContent = 'Check the email address?';
            } else {
                this.status.textContent = "Couldn't send. Try again?";
            }
        } catch (e) {
            this.status.textContent = "Couldn't send. Try again?";
        }
        this.sendButton.disabled = false;
    }
}

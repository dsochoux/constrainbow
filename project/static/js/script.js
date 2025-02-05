import { Manager } from './manager.js';
document.addEventListener('DOMContentLoaded', () => {
    new Manager();
});

// TODO:
// update keyboard should be the responsibility of the manager
// fix the toggleSelected bs
// ditch symbols for constraints, and use array indexes
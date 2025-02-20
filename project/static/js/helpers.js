export const LETTERS_TO_POINTS = {
    "A": 1,
    "B": 3,
    "C": 3,
    "D": 2,
    "E": 1,
    "F": 4,
    "G": 2,
    "H": 4,
    "I": 1,
    "J": 8,
    "K": 5,
    "L": 1,
    "M": 3,
    "N": 1,
    "O": 1,
    "P": 3,
    "Q": 10,
    "R": 1,
    "S": 1,
    "T": 1,
    "U": 1,
    "V": 4,
    "W": 4,
    "X": 8,
    "Y": 4,
    "Z": 10,
    "-": 0,
    "": 0
}

export const BOARD_ID = "board";
export const NUM_WORDS = 4;
export const WORD_LENGTH = 5;

// HELPER FUNCTIONS
export function getWithDefault(obj, key, defaultValue) {
    return key in obj ? obj[key] : defaultValue;
}

export function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        // Remove leading spaces and split into key-value
        const [key, value] = cookie.trim().split('=');
        if (key === name) {
            return decodeURIComponent(value); // Decode the cookie value
        }
    }
    return null; // Return null if the cookie is not found
}

export function deleteAllCookies() {
    document.cookie.split(';').forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
}

export function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const formattedMins = String(mins).padStart(2, '0');
    const formattedSecs = String(secs).padStart(2, '0');

    return hrs > 0 
        ? `${hrs}:${formattedMins}:${formattedSecs}` 
        : `${mins}:${formattedSecs}`;
}

export async function delayedForEach(array, callback, delayTime) {
    for (const item of array) {
        await callback(item);
        await new Promise(resolve => setTimeout(resolve, delayTime));
    }
}
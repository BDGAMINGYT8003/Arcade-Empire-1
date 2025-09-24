const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(__dirname, '..', 'db.json');

// Function to ensure the database file exists
function ensureDbFile() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}, null, 2), 'utf8');
    }
}

// Function to read the entire database
function readDb() {
    ensureDbFile();
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
}

// Function to write the entire database
function writeDb(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Gets a user's profile from the database.
 * @param {string} userId The ID of the user to get.
 * @returns {object | null} The user object or null if not found.
 */
function getUser(userId) {
    const db = readDb();
    return db[userId] || null;
}

/**
 * Creates a new user profile in the database.
 * @param {string} userId The ID of the user to create.
 * @returns {object} The newly created user object.
 */
function createUser(userId) {
    const db = readDb();
    if (db[userId]) {
        return db[userId]; // User already exists
    }
    const newUser = {
        id: userId,
        onboarded: false,
        balance: {
            at: 1000, // Arcade Tokens
            gj: 0,     // Golden Joysticks
        },
    };
    db[userId] = newUser;
    writeDb(db);
    return newUser;
}

/**
 * Updates a user's profile.
 * @param {string} userId The ID of the user to update.
 * @param {object} data The data to update.
 * @returns {object | null} The updated user object or null if not found.
 */
function updateUser(userId, data) {
    const db = readDb();
    if (!db[userId]) {
        return null; // User does not exist
    }
    // Deep merge the new data into the existing user data
    // A simple merge for now, can be made more robust if needed
    db[userId] = { ...db[userId], ...data };
    writeDb(db);
    return db[userId];
}

module.exports = {
    getUser,
    createUser,
    updateUser,
};

// Jules was here - Arcade Empire starts now.
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');

// Securely access the bot token and client ID from Replit's Secrets
const token = process.env['BOT_TOKEN'];
const clientId = process.env['CLIENT_ID'];

if (!token || !clientId) {
    throw new Error("BOT_TOKEN or CLIENT_ID is not set in Replit's Secrets. Please set them.");
}

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- Command Handling ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

// --- Event Handling ---
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}


// A Set to track users currently in an active command
const activeUsers = new Set();

// Make the set available globally through the client object
client.activeUsers = activeUsers;

// Log in to Discord with your client's token
client.login(token);

const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { validateWager, handleChallenge, handlePayout } = require('../util/games');

// --- Helper Functions for Tic-Tac-Toe ---

/**
 * Generates the Discord components for the Tic-Tac-Toe board.
 * @param {string[]} board An array of 9 strings representing the board.
 * @param {boolean} gameOver A boolean to indicate if all buttons should be disabled.
 * @returns {ActionRowBuilder[]} An array of action rows with buttons.
 */
function createBoardComponents(board, gameOver = false) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            const move = board[index];
            const button = new ButtonBuilder().setCustomId(`ttt_${index}`);

            if (move === 'X') {
                button.setLabel('X').setStyle(ButtonStyle.Primary).setDisabled(true);
            } else if (move === 'O') {
                button.setLabel('O').setStyle(ButtonStyle.Danger).setDisabled(true);
            } else {
                button.setLabel(' ').setStyle(ButtonStyle.Secondary).setDisabled(gameOver);
            }
            row.addComponents(button);
        }
        rows.push(row);
    }
    return rows;
}

/**
 * Checks for a win or draw condition.
 * @param {string[]} board An array of 9 strings representing the board.
 * @returns {'X' | 'O' | 'draw' | null} The winner, 'draw', or null if the game is ongoing.
 */
function checkWin(board) {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
    for (const line of winConditions) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // Returns 'X' or 'O'
        }
    }
    return board.includes('') ? null : 'draw'; // If no empty spaces, it's a draw
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Challenge a player to a game of Tic-Tac-Toe.')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('The user you want to challenge.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('wager')
                .setDescription('The amount of Arcade Tokens to wager.')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(25000)),
    async execute(interaction) {
        const initiator = interaction.user;
        const opponent = interaction.options.getUser('opponent');
        const wager = interaction.options.getInteger('wager');
        const client = interaction.client;

        // --- Standard Validation and Challenge Flow ---
        if (initiator.id === opponent.id) {
            const selfChallengeContainer = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent('You cannot challenge yourself.'));
            return interaction.reply({ components: [selfChallengeContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }
        if (opponent.bot) {
            const botChallengeContainer = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent('You cannot challenge a bot.'));
            return interaction.reply({ components: [botChallengeContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }
        const wagerValidation = validateWager(initiator, opponent, wager);
        if (!wagerValidation.isValid) {
            const invalidWagerContainer = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent(wagerValidation.message));
            return interaction.reply({ components: [invalidWagerContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        client.activeUsers.add(initiator.id);
        client.activeUsers.add(opponent.id);

        const challengeInteraction = await handleChallenge(interaction, opponent, wager, 'Tic-Tac-Toe');

        if (!challengeInteraction) {
            client.activeUsers.delete(initiator.id);
            client.activeUsers.delete(opponent.id);
            return;
        }

        // --- Game Setup ---
        let board = Array(9).fill('');
        let players = { 'X': initiator, 'O': opponent };
        let currentPlayerSymbol = 'X';
        let gameOver = false;

        const getGameContainer = (message) => {
            return new ContainerBuilder()
                .setAccentColor(0x5865F2)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setMarkdown(`**Tic-Tac-Toe: ${initiator.username} vs. ${opponent.username}**`),
                    new TextDisplayBuilder().setContent(message)
                );
        };

        let gameMessage = getGameContainer(`The game has begun! It's ${players[currentPlayerSymbol].username}'s turn (X).`);
        let boardComponents = createBoardComponents(board);

        await challengeInteraction.update({
            components: [gameMessage, ...boardComponents],
            flags: MessageFlags.IsComponentsV2
        });

        const gameInteraction = await interaction.fetchReply();
        const collector = gameInteraction.createMessageComponentCollector({ time: 180000 }); // 3 minute game timer

        collector.on('collect', async i => {
            if (i.user.id !== players[currentPlayerSymbol].id) {
                const notYourTurnContainer = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent("It's not your turn!"));
                return i.reply({ components: [notYourTurnContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
            }
            if (gameOver) return;

            const selectedIndex = parseInt(i.customId.split('_')[1]);
            if (board[selectedIndex] !== '') {
                const spotTakenContainer = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent("This spot is already taken!"));
                return i.reply({ components: [spotTakenContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
            }

            board[selectedIndex] = currentPlayerSymbol;
            const winner = checkWin(board);

            if (winner) {
                gameOver = true;
                let resultMessage;
                if (winner === 'draw') {
                    resultMessage = "It's a draw! Wagers have been returned.";
                } else {
                    const winnerUser = players[winner];
                    const loserUser = players[winner === 'X' ? 'O' : 'X'];
                    const { winnings } = handlePayout(winnerUser.id, loserUser.id, wager);
                    resultMessage = `${winnerUser.username} has won! They receive **${winnings.toLocaleString()}** <:ArcadeTokens:1420147365213507686>!`;
                }
                gameMessage = getGameContainer(resultMessage);
                boardComponents = createBoardComponents(board, true); // Disable all buttons
                await i.update({ components: [gameMessage, ...boardComponents], flags: MessageFlags.IsComponentsV2 });
                collector.stop();
            } else {
                currentPlayerSymbol = currentPlayerSymbol === 'X' ? 'O' : 'X';
                gameMessage = getGameContainer(`It's now ${players[currentPlayerSymbol].username}'s turn (${currentPlayerSymbol}).`);
                boardComponents = createBoardComponents(board);
                await i.update({ components: [gameMessage, ...boardComponents], flags: MessageFlags.IsComponentsV2 });
            }
        });

        collector.on('end', (collected, reason) => {
            if (!gameOver) { // If game hasn't naturally ended, it's a timeout
                gameOver = true;
                const forfeiter = players[currentPlayerSymbol];
                const winner = players[currentPlayerSymbol === 'X' ? 'O' : 'X'];
                handlePayout(winner.id, forfeiter.id, wager);
                const timeoutMessage = `${forfeiter.username} ran out of time! ${winner.username} wins by default.`;
                gameMessage = getGameContainer(timeoutMessage);
                boardComponents = createBoardComponents(board, true);
                interaction.editReply({ components: [gameMessage, ...boardComponents], flags: MessageFlags.IsComponentsV2 });
            }
            // --- Unlock users ---
            client.activeUsers.delete(initiator.id);
            client.activeUsers.delete(opponent.id);
        });
    },
};

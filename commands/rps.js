const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { validateWager, handleChallenge, handlePayout } = require('../util/games');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Challenge a player to a game of Rock, Paper, Scissors.')
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

        // --- Initial Validation ---
        if (initiator.id === opponent.id) {
            const selfChallengeContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('You cannot challenge yourself to a game.'));
            return interaction.reply({ components: [selfChallengeContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }
        if (opponent.bot) {
            const botChallengeContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('You cannot challenge a bot.'));
            return interaction.reply({ components: [botChallengeContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        const wagerValidation = validateWager(initiator, opponent, wager);
        if (!wagerValidation.isValid) {
            const invalidWagerContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(wagerValidation.message));
            return interaction.reply({ components: [invalidWagerContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        // --- Lock Users and Start Challenge ---
        client.activeUsers.add(initiator.id);
        client.activeUsers.add(opponent.id);

        const challengeInteraction = await handleChallenge(interaction, opponent, wager, 'Rock, Paper, Scissors');

        if (!challengeInteraction) {
            // Challenge was declined or timed out
            client.activeUsers.delete(initiator.id);
            client.activeUsers.delete(opponent.id);
            return;
        }

        // --- Game Logic ---
        try {
            const gameStartContainer = new ContainerBuilder()
                .setAccentColor(0x5865F2)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setHeadline('Rock, Paper, Scissors').setOmitTrailingSemicolon(true),
                    new TextDisplayBuilder().setContent(`**The game is on!**\nBoth players, please make your move secretly. You have 20 seconds.`)
                );
            await challengeInteraction.update({ components: [gameStartContainer], flags: MessageFlags.IsComponentsV2 });

            const moveContainer = new ContainerBuilder()
                .setAccentColor(0x5865F2)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('Choose your move!'))
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('rps_rock').setLabel('Rock').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('rps_paper').setLabel('Paper').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('rps_scissors').setLabel('Scissors').setStyle(ButtonStyle.Secondary)
                    )
                );

            const createMoveCollector = async (message, player) => {
                const filter = i => i.user.id === player.id;
                const choice = await message.awaitMessageComponent({ filter, time: 20000 });
                const confirmContainer = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`You chose ${choice.customId.split('_')[1]}!`));
                await choice.update({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });
                return choice.customId;
            };

            const getInitiatorMove = async () => {
                const message = await interaction.followUp({ components: [moveContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
                return createMoveCollector(message, initiator);
            };

            const getOpponentMove = async () => {
                const message = await challengeInteraction.reply({ components: [moveContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
                return createMoveCollector(message, opponent);
            };

            const [initiatorMove, opponentMove] = await Promise.all([
                getInitiatorMove(),
                getOpponentMove()
            ]);

            const outcomes = {
                'rps_rock': { 'rps_scissors': 1, 'rps_rock': 0, 'rps_paper': -1 },
                'rps_paper': { 'rps_rock': 1, 'rps_paper': 0, 'rps_scissors': -1 },
                'rps_scissors': { 'rps_paper': 1, 'rps_scissors': 0, 'rps_rock': -1 }
            };

            const result = outcomes[initiatorMove][opponentMove];
            let resultText;

            if (result === 0) { // Draw
                resultText = `It's a draw! Both players chose **${initiatorMove.split('_')[1]}**. The wager of ${wager} has been returned to both players.`;
            } else if (result === 1) { // Initiator wins
                const { winnings } = handlePayout(initiator.id, opponent.id, wager);
                resultText = `${initiator.username} chose **${initiatorMove.split('_')[1]}**.\n${opponent.username} chose **${opponentMove.split('_')[1]}**.\n\n**${initiator.username} wins ${winnings.toLocaleString()}** <:ArcadeTokens:1420147365213507686>!`;
            } else { // Opponent wins
                const { winnings } = handlePayout(opponent.id, initiator.id, wager);
                resultText = `${initiator.username} chose **${initiatorMove.split('_')[1]}**.\n${opponent.username} chose **${opponentMove.split('_')[1]}**.\n\n**${opponent.username} wins ${winnings.toLocaleString()}** <:ArcadeTokens:1420147365213507686>!`;
            }

            const finalContainer = new ContainerBuilder()
                .setAccentColor(result === 0 ? 0x5865F2 : 0x00FF00)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setHeadline('Game Over!').setOmitTrailingSemicolon(true),
                    new TextDisplayBuilder().setContent(resultText)
                );
            await interaction.editReply({ components: [finalContainer], flags: MessageFlags.IsComponentsV2 });

        } catch (err) {
            // A player failed to make a move in time
            const timeoutContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setHeadline('Game Forfeited').setOmitTrailingSemicolon(true),
                    new TextDisplayBuilder().setContent('A player did not make a move in time. The game has been cancelled and wagers returned.')
                );
            await interaction.editReply({ components: [timeoutContainer], flags: MessageFlags.IsComponentsV2 });
        } finally {
            // --- Unlock Users ---
            client.activeUsers.delete(initiator.id);
            client.activeUsers.delete(opponent.id);
        }
    },
};

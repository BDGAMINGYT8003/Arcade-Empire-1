const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getUser, updateUser } = require('./database');

/**
 * Validates if both the initiator and opponent have enough funds for the wager.
 * @param {User} initiator The user who started the challenge.
 * @param {User} opponent The user who was challenged.
 * @param {number} wager The amount of Arcade Tokens being wagered.
 * @returns {{isValid: boolean, message: string}} An object indicating if the wager is valid and a message.
 */
function validateWager(initiator, opponent, wager) {
    const initiatorProfile = getUser(initiator.id);
    const opponentProfile = getUser(opponent.id);

    if (!initiatorProfile || initiatorProfile.balance.at < wager) {
        return { isValid: false, message: "You do not have enough Arcade Tokens for this wager." };
    }
    if (!opponentProfile || opponentProfile.balance.at < wager) {
        return { isValid: false, message: `${opponent.username} does not have enough Arcade Tokens for this wager.` };
    }
    return { isValid: true, message: "Wager is valid." };
}

/**
 * Handles the full two-step challenge flow.
 * @param {Interaction} interaction The initial command interaction.
 * @param {User} opponent The user being challenged.
 * @param {number} wager The wager amount.
 * @param {string} gameName The name of the game for display purposes.
 * @returns {Promise<Interaction | null>} The interaction of the opponent accepting, or null if declined/timed out.
 */
async function handleChallenge(interaction, opponent, wager, gameName) {
    const initiator = interaction.user;

    // --- Step 1: Initiator Confirmation ---
    const confirmInitiatorContainer = new ContainerBuilder()
        .setAccentColor(0xFFA500) // Orange
        .addTextDisplayComponents(
            new TextDisplayBuilder().setMarkdown(`**Confirm Your Challenge!**`),
            new TextDisplayBuilder().setContent(`You are challenging ${opponent.username} to a game of **${gameName}** for **${wager.toLocaleString()}** <:ArcadeTokens:1420147365213507686>.\n\nDo you wish to proceed?`)
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('challenge_accept_initiator').setLabel('Confirm').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('challenge_decline_initiator').setLabel('Cancel').setStyle(ButtonStyle.Danger)
            )
        );

    const reply = await interaction.reply({
        components: [confirmInitiatorContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });

    const initiatorFilter = i => i.user.id === initiator.id;
    try {
        const initiatorConfirmation = await reply.awaitMessageComponent({ filter: initiatorFilter, time: 30000 });

        if (initiatorConfirmation.customId === 'challenge_decline_initiator') {
            const cancelledContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('You have cancelled the challenge.'));
            await initiatorConfirmation.update({ components: [cancelledContainer], flags: MessageFlags.IsComponentsV2 });
            return null;
        }

        // --- Step 2: Opponent Prompt ---
        const challengeContainer = new ContainerBuilder()
            .setAccentColor(0x5865F2) // Blurple
            .addTextDisplayComponents(
                new TextDisplayBuilder().setMarkdown(`**${gameName} Challenge!**`),
                new TextDisplayBuilder().setContent(`${opponent.toString()}, you have been challenged by ${initiator.username} to a game of **${gameName}** for **${wager.toLocaleString()}** <:ArcadeTokens:1420147365213507686>.\n\nYou have 30 seconds to respond.`)
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('challenge_accept_opponent').setLabel('Accept').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('challenge_decline_opponent').setLabel('Decline').setStyle(ButtonStyle.Danger)
                )
            );

        await interaction.editReply({
            components: [challengeContainer],
            flags: MessageFlags.IsComponentsV2,
        });

        const opponentFilter = i => i.user.id === opponent.id;
        const opponentConfirmation = await interaction.channel.awaitMessageComponent({ filter: opponentFilter, time: 30000 });

        if (opponentConfirmation.customId === 'challenge_decline_opponent') {
            const declinedContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setMarkdown('**Challenge Declined**'),
                    new TextDisplayBuilder().setContent(`${opponent.username} has declined the challenge.`)
                );
            await opponentConfirmation.update({ components: [declinedContainer], flags: MessageFlags.IsComponentsV2 });
            return null;
        }

        return opponentConfirmation;

    } catch (err) {
        const timeoutContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setMarkdown('**Challenge Timed Out**'),
                new TextDisplayBuilder().setContent('The challenge expired due to no response.')
            );
        await interaction.editReply({ components: [timeoutContainer], flags: MessageFlags.IsComponentsV2 });
        return null;
    }
}

/**
 * Handles the currency transaction after a game concludes.
 * @param {string} winnerId The user ID of the winner.
 * @param {string} loserId The user ID of the loser.
 * @param {number} wager The original wager amount.
 * @returns {{winnings: number}} The amount the winner received.
 */
function handlePayout(winnerId, loserId, wager) {
    const winnerProfile = getUser(winnerId);
    const loserProfile = getUser(loserId);

    if (!winnerProfile || !loserProfile) {
        console.error("Could not find profiles for payout.");
        return { winnings: 0 };
    }

    const payout = Math.round(wager * 0.85);
    const totalWinnings = wager + payout;

    winnerProfile.balance.at += totalWinnings;
    loserProfile.balance.at -= wager;

    updateUser(winnerId, { balance: winnerProfile.balance });
    updateUser(loserId, { balance: loserProfile.balance });

    return { winnings: totalWinnings };
}


module.exports = {
    validateWager,
    handleChallenge,
    handlePayout,
};

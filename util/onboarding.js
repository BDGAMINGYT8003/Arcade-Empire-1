const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { updateUser } = require('./database');

async function startOnboarding(interaction) {
    const client = interaction.client;
    const user = interaction.user;

    try {
        // --- Slide 1: Welcome ---
        const welcomeContainer = new ContainerBuilder()
            .setAccentColor(0x5865F2) // Blurple
            .addTextDisplayComponents(
                new TextDisplayBuilder().setHeadline('Welcome to Arcade Empire!').setOmitTrailingSemicolon(true),
                new TextDisplayBuilder().setContent("Hey there! I'm here to guide you through the basics of the bot. Let's get you set up.")
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('onboarding_next_1').setLabel('Next').setStyle(ButtonStyle.Primary)
                )
            );

        await interaction.reply({
            components: [welcomeContainer],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });

        const filter = i => i.user.id === user.id;
        // Use the interaction's channel if it's available, otherwise fallback to a cached channel
        const channel = interaction.channel || client.channels.cache.get(interaction.channelId);
        const collector = channel.createMessageComponentCollector({ filter, time: 60000 }); // 60s timeout

        collector.on('collect', async i => {
            if (i.customId === 'onboarding_next_1') {
                // --- Slide 2: Currencies ---
                const currencyContainer = new ContainerBuilder()
                    .setAccentColor(0x5865F2)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setHeadline('Our Currencies').setOmitTrailingSemicolon(true),
                        new TextDisplayBuilder().setContent("Here in the Arcade, we use two types of currency:"),
                        new TextDisplayBuilder().setMarkdown(`**<:ArcadeTokens:1420147365213507686> Arcade Tokens (AT)**\nThis is the main currency you use to challenge other players in our minigames.`).setOmitTrailingSemicolon(true),
                        new TextDisplayBuilder().setMarkdown(`**<:GoldenJoysticks:1420147415868244148> Golden Joysticks (GJ)**\nThis is a premium currency for special events and items. (More on this later!)`)
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('onboarding_next_2').setLabel('Got it!').setStyle(ButtonStyle.Primary)
                        )
                    );

                await i.update({ components: [currencyContainer], flags: MessageFlags.IsComponentsV2 });
            }

            if (i.customId === 'onboarding_next_2') {
                 // --- Slide 3: Balance & Challenges ---
                 const finalContainer = new ContainerBuilder()
                    .setAccentColor(0x5865F2)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setHeadline('Checking Balances & Challenging').setOmitTrailingSemicolon(true),
                        new TextDisplayBuilder().setContent("You can check your balance anytime with the `/balance` command.\n\nTo challenge someone, just use a game command like `/rps @user <wager>`.\n\nYou've been given a starting balance of **1,000 AT** to get you started!")
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('onboarding_finish').setLabel('Finish Tutorial').setStyle(ButtonStyle.Success)
                        )
                    );

                await i.update({ components: [finalContainer], flags: MessageFlags.IsComponentsV2 });
            }

            if (i.customId === 'onboarding_finish') {
                // Mark user as onboarded in the database
                updateUser(user.id, { onboarded: true });

                const completionContainer = new ContainerBuilder()
                    .setAccentColor(0x00FF00) // Green
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setHeadline('Setup Complete!').setOmitTrailingSemicolon(true),
                        new TextDisplayBuilder().setContent("You are all set! You can now use all of Arcade Empire's commands. Have fun!")
                    );

                await i.update({ components: [completionContainer], flags: MessageFlags.IsComponentsV2 });

                collector.stop();
            }
        });

        collector.on('end', (collected, reason) => {
            client.activeUsers.delete(user.id);
            if (reason === 'time') {
                const timeoutContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000) // Red
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setHeadline('Tutorial Timed Out').setOmitTrailingSemicolon(true),
                        new TextDisplayBuilder().setContent("Your session has expired. Please run a command again to restart the tutorial.")
                    );
                // Can't update the interaction after it's been too long, but we can try to edit the original reply if needed.
                // For ephemeral messages, it's often better to just let it be.
                console.log(`Onboarding timed out for ${user.tag}.`);
            }
        });

    } catch (error) {
        console.error("Error during onboarding:", error);
        client.activeUsers.delete(user.id);
    }
}

module.exports = { startOnboarding };

const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getUser, createUser } = require('../util/database');

// This will be the handler for the new user tutorial
const { startOnboarding } = require('../util/onboarding');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const client = interaction.client;
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        // --- Interaction Locking Protocol ---
        if (client.activeUsers.has(interaction.user.id)) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000) // Red
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setMarkdown('**Interaction Locked**'),
                    new TextDisplayBuilder().setContent('You are already in an active command. Please complete or cancel it before starting a new one.')
                );

            return interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // --- New User Onboarding Trigger ---
        let userProfile = getUser(interaction.user.id);

        // If user doesn't exist, create a profile. The onboarding status will be false by default.
        if (!userProfile) {
            userProfile = createUser(interaction.user.id);
        }

        // If user is not onboarded, start the tutorial instead of executing the command
        if (!userProfile.onboarded) {
            // Add user to the active set to prevent other commands during onboarding
            client.activeUsers.add(interaction.user.id);
            try {
                await startOnboarding(interaction);
                // The 'startOnboarding' function will handle removing the user from the active set upon completion/cancellation.
            } catch (error) {
                console.error('Onboarding process failed:', error);
                // Ensure user is removed from active set if onboarding fails
                client.activeUsers.delete(interaction.user.id);
            }
            return; // Stop further execution
        }

        // --- Command Execution ---
        try {
            // Add user to the active set before executing the command
            client.activeUsers.add(interaction.user.id);
            await command.execute(interaction);
            // Remove the user from the active set after the command is done
            // Note: For multi-step commands, this removal should be handled within the command file itself.
            // For simple commands, this is fine. We will adopt this as a convention.
            client.activeUsers.delete(interaction.user.id);
        } catch (error) {
            console.error(error);
            // Make sure to remove the user from the set if the command fails
            client.activeUsers.delete(interaction.user.id);
            // Using a simple content message for generic errors for now.
            // These could also be converted to V2 components if desired.
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    },
};

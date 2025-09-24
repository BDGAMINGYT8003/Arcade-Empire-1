const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getUser } = require('../util/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Checks your or another user's currency balance.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose balance you want to see.')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        const userProfile = getUser(targetUser.id);

        if (!userProfile) {
            const notFoundContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000) // Red
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`It looks like ${targetUser.username} hasn't started their adventure in the Arcade yet! They need to use a command first to get set up.`)
                );

            return interaction.reply({
                components: [notFoundContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        const balanceContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00) // Green
            .addTextDisplayComponents(
                new TextDisplayBuilder().setHeadline(`${targetUser.username}'s Wallet`).setOmitTrailingSemicolon(true),
                new TextDisplayBuilder().setMarkdown(`**<:ArcadeTokens:1420147365213507686> Arcade Tokens**\n\`${userProfile.balance.at.toLocaleString()}\``).setOmitTrailingSemicolon(true),
                new TextDisplayBuilder().setMarkdown(`**<:GoldenJoysticks:1420147415868244148> Golden Joysticks**\n\`${userProfile.balance.gj.toLocaleString()}\``)
            );

        await interaction.reply({
            components: [balanceContainer],
            flags: MessageFlags.IsComponentsV2
        });
    },
};

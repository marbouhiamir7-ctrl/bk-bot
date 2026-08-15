const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletecommand')
        .setDescription('Delete a custom command')
        .addStringOption(option => option.setName('name').setDescription('Command name to delete').setRequired(true)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need the Administrator permission to use this command!', ephemeral: true });
        }

        const name = interaction.options.getString('name');

        if (!interaction.client.customCommands.has(name.toLowerCase())) {
            return interaction.reply({ content: 'That custom command does not exist!', ephemeral: true });
        }

        interaction.client.customCommands.delete(name.toLowerCase());

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Custom Command Deleted')
            .addFields(
                { name: 'Command', value: `/${name}`, inline: true },
                { name: 'Deleted By', value: interaction.user.username, inline: true }
            )
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

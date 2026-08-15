const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addcommand')
        .setDescription('Add a custom command')
        .addStringOption(option => option.setName('name').setDescription('Command name').setRequired(true))
        .addStringOption(option => option.setName('response').setDescription('Command response').setRequired(true)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need the Administrator permission to use this command!', ephemeral: true });
        }

        const name = interaction.options.getString('name');
        const response = interaction.options.getString('response');

        interaction.client.customCommands.set(name.toLowerCase(), {
            response: response,
            createdBy: interaction.user.username,
            createdAt: new Date().toISOString()
        });

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Custom Command Added')
            .addFields(
                { name: 'Command', value: `/${name}`, inline: true },
                { name: 'Response', value: response.substring(0, 100), inline: true },
                { name: 'Created By', value: interaction.user.username, inline: true }
            )
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('List all custom commands'),
    cooldown: 5,
    async execute(interaction) {
        const commands = interaction.client.customCommands;

        if (commands.size === 0) {
            return interaction.reply({ content: 'No custom commands have been created yet!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('📋 Custom Commands')
            .setTimestamp();

        let description = '';
        commands.forEach((data, name) => {
            description += `**/${name}** - ${data.response.substring(0, 50)}${data.response.length > 50 ? '...' : ''}\n`;
        });

        embed.setDescription(description);
        interaction.reply({ embeds: [embed] });
    }
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close a support ticket'),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: 'This command can only be used in a ticket channel!', ephemeral: true });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Only administrators can close tickets!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Ticket Closing')
            .setDescription('This ticket will be closed in 5 seconds...')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error('Failed to delete ticket channel');
            }
        }, 5000);
    }
};

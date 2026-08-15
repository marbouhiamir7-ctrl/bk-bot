const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addStringOption(option => option.setName('userid').setDescription('The user ID to unban').setRequired(true)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: 'You need the Ban Members permission to use this command!', ephemeral: true });
        }

        const userId = interaction.options.getString('userid');
        if (!userId) return interaction.reply({ content: 'Please provide a user ID to unban.', ephemeral: true });

        try {
            const user = await interaction.guild.members.unban(userId);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Member Unbanned')
                .addFields(
                    { name: 'User', value: `${user.username}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.username}`, inline: true }
                )
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'Failed to unban the user. Make sure the ID is correct.', ephemeral: true });
        }
    }
};

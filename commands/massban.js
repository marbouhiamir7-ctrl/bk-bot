const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('massban')
        .setDescription('Mass ban multiple users')
        .addStringOption(option => option.setName('userids').setDescription('User IDs separated by spaces').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the ban').setRequired(false)),
    cooldown: 10,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: 'You need the Ban Members permission to use this command!', ephemeral: true });
        }

        const userIds = interaction.options.getString('userids').split(' ');
        const reason = interaction.options.getString('reason') || 'Mass ban';

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🔨 Mass Ban')
            .setDescription('Banning users...')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        let banned = 0;
        let failed = 0;

        for (const userId of userIds) {
            try {
                await interaction.guild.members.ban(userId.trim(), { reason });
                banned++;
            } catch (error) {
                failed++;
            }
        }

        const resultEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🔨 Mass Ban Complete')
            .addFields(
                { name: 'Banned', value: `${banned} users`, inline: true },
                { name: 'Failed', value: `${failed} users`, inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Moderator', value: `${interaction.user.username}`, inline: true }
            )
            .setTimestamp();

        interaction.editReply({ embeds: [resultEmbed] });
    }
};

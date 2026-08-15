const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption(option => option.setName('target').setDescription('The member to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for banning').setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: 'You need the Ban Members permission to use this command!', ephemeral: true });
        }

        const target = interaction.options.getMember('target');
        if (!target) return interaction.reply({ content: 'Please mention a valid member to ban.', ephemeral: true });

        if (!target.bannable) return interaction.reply({ content: 'I cannot ban this member.', ephemeral: true });

        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            await target.send(`You have been banned from **${interaction.guild.name}** for: ${reason}`).catch(() => {});
            await target.ban({ reason });

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Member Banned')
                .addFields(
                    { name: 'User', value: `${target.user.username}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.username}`, inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'Failed to ban the member.', ephemeral: true });
        }
    }
};

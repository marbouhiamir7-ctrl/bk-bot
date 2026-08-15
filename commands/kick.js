const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option => option.setName('target').setDescription('The member to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for kicking').setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({ content: 'You need the Kick Members permission to use this command!', ephemeral: true });
        }

        const target = interaction.options.getMember('target');
        if (!target) return interaction.reply({ content: 'Please mention a valid member to kick.', ephemeral: true });

        if (!target.kickable) return interaction.reply({ content: 'I cannot kick this member.', ephemeral: true });

        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            await target.send(`You have been kicked from **${interaction.guild.name}** for: ${reason}`);
            await target.kick(reason);

            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('Member Kicked')
                .addFields(
                    { name: 'User', value: `${target.user.tag}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'Failed to kick the member.', ephemeral: true });
        }
    }
};

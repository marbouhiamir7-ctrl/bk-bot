const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member')
        .addUserOption(option => option.setName('target').setDescription('The member to warn').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for warning').setRequired(false)),
    cooldown: 3,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: 'You need the Moderate Members permission to use this command!', ephemeral: true });
        }

        const target = interaction.options.getMember('target');
        if (!target) return interaction.reply({ content: 'Please mention a valid member to warn.', ephemeral: true });

        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.client.warnings.has(target.id)) {
            interaction.client.warnings.set(target.id, []);
        }

        const warnings = interaction.client.warnings.get(target.id);
        warnings.push({
            reason: reason,
            moderator: interaction.user.username,
            date: new Date().toISOString()
        });

        const embed = new EmbedBuilder()
            .setColor('#FFCC00')
            .setTitle('Member Warned')
            .addFields(
                { name: 'User', value: `${target.user.username}`, inline: true },
                { name: 'Moderator', value: `${interaction.user.username}`, inline: true },
                { name: 'Total Warnings', value: `${warnings.length}`, inline: true },
                { name: 'Reason', value: reason, inline: true }
            )
            .setTimestamp();

        interaction.reply({ embeds: [embed] });

        try {
            await target.send(`You have been warned in **${interaction.guild.name}** for: ${reason}`);
        } catch (error) {
            console.error('Could not DM the user');
        }

        if (warnings.length >= 3) {
            try {
                await target.ban({ reason: 'Reached 3 warnings' });
                interaction.channel.send(`${target.user.username} has been banned for reaching 3 warnings.`);
            } catch (error) {
                console.error('Failed to ban after 3 warnings');
            }
        }
    }
};

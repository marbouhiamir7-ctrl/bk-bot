const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a member in the server')
        .addUserOption(option => option.setName('target').setDescription('The member to unmute').setRequired(true)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
            return interaction.reply({ content: 'You need the Mute Members permission to use this command!', ephemeral: true });
        }

        const target = interaction.options.getMember('target');
        if (!target) return interaction.reply({ content: 'Please mention a valid member to unmute.', ephemeral: true });

        const muteRole = interaction.guild.roles.cache.find(r => r.name === config.muteRole);
        if (!muteRole || !target.roles.cache.has(muteRole.id)) {
            return interaction.reply({ content: 'This member is not muted.', ephemeral: true });
        }

        try {
            await target.roles.remove(muteRole);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Member Unmuted')
                .addFields(
                    { name: 'User', value: `${target.user.tag}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true }
                )
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'Failed to unmute the member.', ephemeral: true });
        }
    }
};

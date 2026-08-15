const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a member in the server')
        .addUserOption(option => option.setName('target').setDescription('The member to mute').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes (leave empty for permanent)').setRequired(false))
        .addStringOption(option => option.setName('reason').setDescription('Reason for muting').setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
            return interaction.reply({ content: 'You need the Mute Members permission to use this command!', ephemeral: true });
        }

        const target = interaction.options.getMember('target');
        if (!target) return interaction.reply({ content: 'Please mention a valid member to mute.', ephemeral: true });

        let muteRole = interaction.guild.roles.cache.find(r => r.name === config.muteRole);
        if (!muteRole) {
            try {
                muteRole = await interaction.guild.roles.create({
                    name: config.muteRole,
                    permissions: []
                });
                interaction.guild.channels.cache.forEach(async (channel) => {
                    await channel.permissionOverwrites.edit(muteRole, {
                        SendMessages: false,
                        Speak: false,
                        AddReactions: false
                    });
                });
            } catch (error) {
                return interaction.reply({ content: 'Failed to create mute role.', ephemeral: true });
            }
        }

        if (target.roles.cache.has(muteRole.id)) {
            return interaction.reply({ content: 'This member is already muted.', ephemeral: true });
        }

        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            await target.roles.add(muteRole);

            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('Member Muted')
                .addFields(
                    { name: 'User', value: `${target.user.tag}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Duration', value: duration ? `${duration} minutes` : 'Permanent', inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setTimestamp();

            interaction.reply({ embeds: [embed] });

            if (duration) {
                setTimeout(async () => {
                    if (target.roles.cache.has(muteRole.id)) {
                        await target.roles.remove(muteRole);
                    }
                }, duration * 60000);
            }
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'Failed to mute the member.', ephemeral: true });
        }
    }
};

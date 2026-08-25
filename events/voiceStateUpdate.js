const { Events, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    async execute(oldState, newState) {
        if (!oldState.guild) return;

        const settings = db.getGuildSettings(oldState.guild.id);
        if (settings.log_voice === false) return;

        const logChannel = oldState.guild.channels.cache.find(ch => ch.name === 'mod-logs');
        if (!logChannel) return;

        const member = oldState.member;
        if (!member || member.user.bot) return;

        let action, color, channelInfo;

        if (!oldState.channel && newState.channel) {
            action = '🔊 Joined Voice';
            color = '#22c55e';
            channelInfo = newState.channel.name;
        } else if (oldState.channel && !newState.channel) {
            action = '🔇 Left Voice';
            color = '#ef4444';
            channelInfo = oldState.channel.name;
        } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            action = '🔀 Moved Voice';
            color = '#3b82f6';
            channelInfo = `${oldState.channel.name} → ${newState.channel.name}`;
        } else {
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(action)
            .addFields(
                { name: 'User', value: `${member.user.tag}`, inline: true },
                { name: 'Channel', value: channelInfo, inline: true }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};

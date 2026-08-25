const { Events, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
    name: Events.MessageDelete,
    once: false,
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        const settings = db.getGuildSettings(message.guild.id);
        if (!settings.log_messages) return;

        const logChannel = message.guild.channels.cache.find(ch => ch.name === 'mod-logs');
        if (!logChannel) return;

        const content = message.content
            ? (message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content)
            : '*No text content*';

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Author', value: `${message.author.tag}`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Content', value: content }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};

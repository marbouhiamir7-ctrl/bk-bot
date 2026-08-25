const { Events, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
    name: Events.MessageUpdate,
    once: false,
    async execute(oldMessage, newMessage) {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const settings = db.getGuildSettings(oldMessage.guild.id);
        if (!settings.log_edits) return;

        const logChannel = oldMessage.guild.channels.cache.find(ch => ch.name === 'mod-logs');
        if (!logChannel) return;

        const oldContent = oldMessage.content.length > 1024 ? oldMessage.content.substring(0, 1021) + '...' : oldMessage.content;
        const newContent = newMessage.content.length > 1024 ? newMessage.content.substring(0, 1021) + '...' : newMessage.content;

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('✏️ Message Edited')
            .addFields(
                { name: 'Author', value: `${oldMessage.author.tag}`, inline: true },
                { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
                { name: 'Before', value: oldContent || '*empty*' },
                { name: 'After', value: newContent || '*empty*' }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};

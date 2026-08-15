const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Show bot information and statistics'),
    cooldown: 5,
    async execute(interaction) {
        const client = interaction.client;
        const uptime = formatUptime(client.uptime);

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('BK BOT Information')
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: 'General', value: [
                    `**Name:** ${client.user.username}`,
                    `**ID:** ${client.user.id}`,
                    `**Servers:** ${client.guilds.cache.size}`,
                    `**Users:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0).toLocaleString()}`
                ].join('\n'), inline: true },
                { name: 'System', value: [
                    `**Uptime:** ${uptime}`,
                    `**Ping:** ${client.ws.ping}ms`,
                    `**Commands:** ${client.commands.size}`,
                    `**Node.js:** ${process.version}`
                ].join('\n'), inline: true },
                { name: 'Protection', value: [
                    '✅ Anti-Nuke',
                    '✅ Anti-Raid',
                    '✅ Anti-Spam',
                    '✅ Anti-Link'
                ].join('\n'), inline: true }
            )
            .setFooter({ text: 'Baktiriya Team' })
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
}

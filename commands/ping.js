const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Show bot latency and API ping'),
    cooldown: 3,
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const ws = interaction.client.ws.ping;
        const api = sent.createdTimestamp - interaction.createdTimestamp;

        const embed = new EmbedBuilder()
            .setColor(ws < 100 ? '#2ED573' : ws < 200 ? '#FFA502' : '#FF4757')
            .setTitle('Pong!')
            .addFields(
                { name: 'WebSocket', value: `\`${ws}ms\``, inline: true },
                { name: 'API Latency', value: `\`${api}ms\``, inline: true },
                { name: 'Uptime', value: `\`${formatUptime(interaction.client.uptime)}\``, inline: true }
            )
            .setTimestamp();

        interaction.editReply({ content: '', embeds: [embed] });
    }
};

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
}

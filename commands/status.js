const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const statuses = [
    { name: 'Baktiriya Team | /help', type: 0 },
    { name: 'Protecting servers 24/7', type: 3 },
    { name: 'BK BOT | /help', type: 2 },
    { name: 'Servers: {guilds}', type: 3 },
    { name: 'Members: {members}', type: 3 },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Bot status management')
        .addSubcommand(sub => sub.setName('set').setDescription('Set bot status')
            .addStringOption(o => o.setName('text').setDescription('Status text').setRequired(true))
            .addStringOption(o => o.setName('type').setDescription('Activity type').addChoices(
                { name: 'Playing', value: '0' }, { name: 'Streaming', value: '1' },
                { name: 'Listening', value: '2' }, { name: 'Watching', value: '3' },
                { name: 'Competing', value: '5' })))
        .addSubcommand(sub => sub.setName('rotate').setDescription('Enable auto-rotating status')
            .addIntegerOption(o => o.setName('interval').setDescription('Seconds between rotations').setMinValue(10).setMaxValue(3600)))
        .addSubcommand(sub => sub.setName('stop').setDescription('Stop rotating status'))
        .addSubcommand(sub => sub.setName('current').setDescription('Show current status'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    cooldown: 5000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const client = interaction.client;

        if (sub === 'set') {
            const text = interaction.options.getString('text');
            const type = parseInt(interaction.options.getString('type') || '0');
            client.user.setActivity(text, { type });
            await interaction.reply({ content: `Status set to: **${['Playing','Streaming','Listening','Watching','','Competing'][type]} ${text}**`, ephemeral: true });
        }

        if (sub === 'rotate') {
            const interval = interaction.options.getInteger('interval') || 30;
            if (client.statusInterval) clearInterval(client.statusInterval);
            let idx = 0;
            client.statusInterval = setInterval(async () => {
                try {
                    const s = statuses[idx % statuses.length];
                    let text = s.name.replace('{guilds}', client.guilds.cache.size).replace('{members}', client.guilds.cache.reduce((a, g) => a + g.memberCount, 0));
                    client.user.setActivity(text, { type: s.type });
                    idx++;
                } catch (e) {}
            }, interval * 1000);
            await interaction.reply({ content: `Status rotation enabled! Rotating every ${interval}s through ${statuses.length} statuses.`, ephemeral: true });
        }

        if (sub === 'stop') {
            if (client.statusInterval) { clearInterval(client.statusInterval); client.statusInterval = null; }
            await interaction.reply({ content: 'Status rotation stopped!', ephemeral: true });
        }

        if (sub === 'current') {
            const activity = client.user.presence?.activities?.[0];
            const embed = new EmbedBuilder()
                .setColor('#60a5fa')
                .setTitle('Current Status')
                .setDescription(`**Activity:** ${activity?.name || 'None'}\n**Type:** ${['Playing','Streaming','Listening','Watching','','Competing'][activity?.type || 0]}\n**Rotating:** ${client.statusInterval ? 'Yes' : 'No'}`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

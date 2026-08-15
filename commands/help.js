const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all available commands'),
    cooldown: 3,
    async execute(interaction) {
        const embed = EmbedBuilder.from({
            color: 0xFF6B6B,
            title: 'BK BOT Commands',
            description: 'All available slash commands:',
            fields: [
                { name: 'Moderation', value: '`/kick` `/ban` `/unban` `/mute` `/unmute` `/warn` `/warnings` `/clear` `/massban` `/masskick` `/purge` `/lock` `/unlock` `/slowmode` `/nick` `/role`', inline: false },
                { name: 'Security', value: '`/security` — Anti-Nuke, Anti-Raid, Anti-Spam, Anti-Link (Always ON)', inline: false },
                { name: 'Leveling', value: '`/level` `/leaderboard`', inline: false },
                { name: 'Live Stats', value: '`/setupstats`', inline: false },
                { name: 'Tickets', value: '`/ticket` `/close`', inline: false },
                { name: 'Utility', value: '`/serverinfo` `/userinfo` `/avatar` `/botinfo` `/ping` `/emojis` `/afk` `/poll` `/remind` `/announce`', inline: false },
                { name: 'Custom Commands', value: '`/addcommand` `/deletecommand` `/commands`', inline: false },
                { name: 'Welcome', value: '`/setwelcome` `/testwelcome`', inline: false }
            ],
            footer: { text: 'Baktiriya Team | All commands use / prefix' },
            timestamp: new Date().toISOString()
        });

        interaction.reply({ embeds: [embed] });
    }
};

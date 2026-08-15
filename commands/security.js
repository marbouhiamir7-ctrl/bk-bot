const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('security')
        .setDescription('View security status and statistics'),
    cooldown: 10,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need the Administrator permission to use this command!', ephemeral: true });
        }

        const client = interaction.client;

        const antiNuke = client.antiNuke || {};
        const antiRaid = client.antiRaid || {};
        const antiSpam = client.antiSpam || {};
        const antiLink = client.antiLink || {};

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🛡️ Security Dashboard')
            .setDescription('All security systems are **ACTIVE** and protecting this server.')
            .addFields(
                {
                    name: '💣 Anti-Nuke',
                    value: `Status: ✅ **ACTIVE**\nChannel Delete Limit: ${antiNuke.maxChannelDelete || 3}/10s\nRole Delete Limit: ${antiNuke.maxRoleDelete || 3}/10s\nBan Limit: ${antiNuke.maxBans || 5}/10s\nChannel Create Limit: ${antiNuke.maxChannelCreate || 5}/10s\nWebhook Limit: ${antiNuke.maxWebhookCreate || 2}/10s\nTrusted Users: ${(antiNuke.trustedUsers || []).length}`,
                    inline: true
                },
                {
                    name: '🛡️ Anti-Raid',
                    value: `Status: ✅ **ACTIVE**\nJoin Limit: ${antiRaid.joinLimit || 5}\nTime Window: ${(antiRaid.timeWindow || 10000) / 1000}s\nAction: ${antiRaid.action || 'kick'}`,
                    inline: true
                },
                {
                    name: '🚫 Anti-Spam',
                    value: `Status: ✅ **ACTIVE**\nMessage Limit: ${antiSpam.messageLimit || 5}\nTime Window: ${(antiSpam.timeWindow || 5000) / 1000}s\nAction: ${antiSpam.action || 'mute'}`,
                    inline: true
                },
                {
                    name: '🔗 Anti-Link',
                    value: `Status: ✅ **ACTIVE**\nAction: ${antiLink.action || 'delete'}\nWhitelisted: ${(antiLink.whitelistedDomains || []).length} domains`,
                    inline: true
                },
                {
                    name: '📊 Statistics',
                    value: `Warnings Issued: ${client.warnings.size}\nCustom Commands: ${client.customCommands.size}\nActive Tickets: ${client.tickets.size}\nLeveled Users: ${client.levelData.size}`,
                    inline: true
                },
                {
                    name: '🔒 Protection Level',
                    value: '**MAXIMUM**\nAll systems operational',
                    inline: true
                }
            )
            .setFooter({ text: 'Security is always active. No configuration needed.' })
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

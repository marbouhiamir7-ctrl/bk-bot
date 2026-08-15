const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raidanalytics')
        .setDescription('View anti-raid analytics and stats')
        .addBooleanOption(o => o.setName('ephemeral').setDescription('Make response ephemeral')),
    cooldown: 5000,
    async execute(interaction) {
        const db = require('../db');
        const stats = db.getStats();

        const embed = new EmbedBuilder()
            .setColor('#ff5c5c')
            .setTitle('Anti-Raid Analytics')
            .setDescription('Protection system analytics and statistics')
            .addFields(
                { name: 'Total Bans', value: `**${stats.bans || 0}**`, inline: true },
                { name: 'Total Kicks', value: `**${stats.kicks || 0}**`, inline: true },
                { name: 'Total Mutes', value: `**${stats.mutes || 0}**`, inline: true },
                { name: 'Warnings Issued', value: `**${stats.warnings_issued || 0}**`, inline: true },
                { name: 'Commands Run', value: `**${stats.commands_run || 0}**`, inline: true },
                { name: 'Messages Seen', value: `**${stats.messages_seen || 0}**`, inline: true },
                { name: 'Tickets Created', value: `**${stats.tickets || 0}**`, inline: true }
            )
            .setFooter({ text: 'Protection status: ACTIVE' })
            .setTimestamp();

        const antiNuke = interaction.client.antiNuke;
        const antiRaid = interaction.client.antiRaid;
        const antiSpam = interaction.client.antiSpam;

        embed.addFields({
            name: 'Protection Status',
            value: [
                `🛡️ **Anti-Nuke:** ${antiNuke?.enabled ? '✅ Active' : '❌ Disabled'}`,
                `👥 **Anti-Raid:** ${antiRaid?.enabled ? '✅ Active' : '❌ Disabled'}`,
                `🚫 **Anti-Spam:** ${antiSpam?.enabled ? '✅ Active' : '❌ Disabled'}`,
                `🔗 **Anti-Link:** ${interaction.client.antiLink?.enabled ? '✅ Active' : '❌ Disabled'}`
            ].join('\n')
        });

        await interaction.reply({ embeds: [embed], ephemeral: interaction.options.getBoolean('ephemeral') ?? true });
    }
};

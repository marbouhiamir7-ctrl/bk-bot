const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Backup and restore server settings')
        .addSubcommand(sub => sub.setName('create').setDescription('Create a full backup'))
        .addSubcommand(sub => sub.setName('restore').setDescription('Restore from a backup')
            .addStringOption(o => o.setName('backup_id').setDescription('Backup ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List your backups'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete a backup')
            .addStringOption(o => o.setName('backup_id').setDescription('Backup ID').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    cooldown: 10000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = require('../db');

        const backupsFile = path.join(__dirname, '..', 'data', 'backups.json');
        let backups = {};
        try { backups = JSON.parse(fs.readFileSync(backupsFile, 'utf8')); } catch(e) { backups = {}; }

        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: true });

            const settings = db.getGuildSettings(interaction.guild.id);
            const roles = interaction.guild.roles.cache.filter(r => r.name !== '@everyone').map(r => ({
                name: r.name, color: r.hexColor, hoist: r.hoist, mentionable: r.mentionable,
                permissions: r.permissions.bitfield, position: r.position
            }));
            const channels = interaction.guild.channels.cache.map(c => ({
                name: c.name, type: c.type, topic: c.topic,
                nsfw: c.nsfw, position: c.position, parent: c.parent?.name
            }));
            const emojis = interaction.guild.emojis.cache.map(e => ({ name: e.name, url: e.url }));

            const id = `bkp_${Date.now()}`;
            backups[id] = {
                guildId: interaction.guild.id,
                guildName: interaction.guild.name,
                settings, roles, channels, emojis,
                memberCount: interaction.guild.memberCount,
                created: Date.now()
            };
            fs.writeFileSync(backupsFile, JSON.stringify(backups, null, 2));

            const embed = new EmbedBuilder()
                .setColor('#34d399')
                .setTitle('Backup Created!')
                .setDescription(`**ID:** \`${id}\`\n**Channels:** ${channels.length}\n**Roles:** ${roles.length}\n**Emojis:** ${emojis.length}\n**Settings:** Backed up\n\nUse \`/backup restore ${id}\` to restore.`);
            await interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'restore') {
            const id = interaction.options.getString('backup_id');
            const backup = backups[id];
            if (!backup) return interaction.reply({ content: 'Backup not found!', ephemeral: true });
            if (backup.guildId !== interaction.guild.id) return interaction.reply({ content: 'This backup is for a different server!', ephemeral: true });

            db.saveGuildSettings(interaction.guild.id, backup.settings);
            await interaction.reply({ content: `Settings restored from backup **${id}**!`, ephemeral: true });
        }

        if (sub === 'list') {
            const entries = Object.entries(backups).filter(([_, b]) => b.guildId === interaction.guild.id);
            if (entries.length === 0) return interaction.reply({ content: 'No backups found!', ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor('#60a5fa')
                .setTitle('Backups')
                .setDescription(entries.map(([id, b]) => `**${id}** — ${b.guildName} • <t:${Math.floor(b.created/1000)}:R>`).join('\n'));
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'delete') {
            const id = interaction.options.getString('backup_id');
            if (!backups[id]) return interaction.reply({ content: 'Backup not found!', ephemeral: true });
            delete backups[id];
            fs.writeFileSync(backupsFile, JSON.stringify(backups, null, 2));
            await interaction.reply({ content: `Backup **${id}** deleted!`, ephemeral: true });
        }
    }
};

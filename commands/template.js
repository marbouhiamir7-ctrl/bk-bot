const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('template')
        .setDescription('Server template management')
        .addSubcommand(sub => sub.setName('save').setDescription('Save current server settings as template')
            .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true)))
        .addSubcommand(sub => sub.setName('load').setDescription('Load a saved template')
            .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List saved templates'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete a template')
            .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    cooldown: 5000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = require('../db');
        const fs = require('fs');
        const path = require('path');

        const templatesFile = path.join(__dirname, '..', 'data', 'templates.json');
        let templates = {};
        try { templates = JSON.parse(fs.readFileSync(templatesFile, 'utf8')); } catch(e) { templates = {}; }

        if (sub === 'save') {
            const name = interaction.options.getString('name').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30);
            const settings = db.getGuildSettings(interaction.guild.id);
            const channels = interaction.guild.channels.cache.map(c => ({ name: c.name, type: c.type, parent: c.parent?.name }));
            const roles = interaction.guild.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ name: r.name, color: r.hexColor, permissions: r.permissions.bitfield }));

            templates[name] = {
                guildId: interaction.guild.id,
                name: interaction.guild.name,
                settings, channels, roles,
                created: Date.now()
            };
            fs.writeFileSync(templatesFile, JSON.stringify(templates, null, 2));
            await interaction.reply({ content: `Template **${name}** saved with ${channels.length} channels and ${roles.length} roles!`, ephemeral: true });
        }

        if (sub === 'load') {
            const name = interaction.options.getString('name');
            const tpl = templates[name];
            if (!tpl) return interaction.reply({ content: 'Template not found!', ephemeral: true });

            db.saveGuildSettings(interaction.guild.id, tpl.settings);
            await interaction.reply({ content: `Template **${name}** settings loaded! Channels and roles were saved for reference only.`, ephemeral: true });
        }

        if (sub === 'list') {
            const entries = Object.entries(templates);
            if (entries.length === 0) return interaction.reply({ content: 'No templates saved!', ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor('#34d399')
                .setTitle('Saved Templates')
                .setDescription(entries.map(([n, t]) => `**${n}** — ${t.channels?.length||0} channels, ${t.roles?.length||0} roles`).join('\n'));
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'delete') {
            const name = interaction.options.getString('name');
            if (!templates[name]) return interaction.reply({ content: 'Template not found!', ephemeral: true });
            delete templates[name];
            fs.writeFileSync(templatesFile, JSON.stringify(templates, null, 2));
            await interaction.reply({ content: `Template **${name}** deleted!`, ephemeral: true });
        }
    }
};

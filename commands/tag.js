const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tag')
        .setDescription('Quick response tags')
        .addSubcommand(sub => sub.setName('create').setDescription('Create a tag')
            .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true))
            .addStringOption(o => o.setName('response').setDescription('Tag response').setRequired(true)))
        .addSubcommand(sub => sub.setName('get').setDescription('Get a tag')
            .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List all tags'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete a tag')
            .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)))
        .addSubcommand(sub => sub.setName('edit').setDescription('Edit a tag')
            .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true))
            .addStringOption(o => o.setName('response').setDescription('New response').setRequired(true))),
    cooldown: 2000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = require('../db');
        const fs = require('fs');
        const path = require('path');

        const tagsFile = path.join(__dirname, '..', 'data', 'tags.json');
        let tags = {};
        try { tags = JSON.parse(fs.readFileSync(tagsFile, 'utf8')); } catch(e) { tags = {}; }
        const guildTags = tags[interaction.guild.id] || {};

        if (sub === 'create') {
            const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9_-]/g, '');
            const response = interaction.options.getString('response');
            if (!name) return interaction.reply({ content: 'Invalid tag name!', ephemeral: true });
            if (guildTags[name]) return interaction.reply({ content: 'Tag already exists!', ephemeral: true });
            guildTags[name] = { response, creator: interaction.user.id, uses: 0, created: Date.now() };
            tags[interaction.guild.id] = guildTags;
            fs.writeFileSync(tagsFile, JSON.stringify(tags, null, 2));
            await interaction.reply({ content: `Tag **${name}** created! Use \`/${name}\` to use it.`, ephemeral: true });
        }

        if (sub === 'get') {
            const name = interaction.options.getString('name').toLowerCase();
            if (!guildTags[name]) return interaction.reply({ content: 'Tag not found!', ephemeral: true });
            guildTags[name].uses++;
            tags[interaction.guild.id] = guildTags;
            fs.writeFileSync(tagsFile, JSON.stringify(tags, null, 2));
            await interaction.reply({ content: guildTags[name].response });
        }

        if (sub === 'list') {
            const entries = Object.entries(guildTags);
            if (entries.length === 0) return interaction.reply({ content: 'No tags!', ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor('#a78bfa')
                .setTitle('Tags')
                .setDescription(entries.map(([n, t]) => `\`${n}\` — ${t.uses} uses`).join('\n'));
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'delete') {
            const name = interaction.options.getString('name').toLowerCase();
            if (!guildTags[name]) return interaction.reply({ content: 'Tag not found!', ephemeral: true });
            delete guildTags[name];
            tags[interaction.guild.id] = guildTags;
            fs.writeFileSync(tagsFile, JSON.stringify(tags, null, 2));
            await interaction.reply({ content: `Tag **${name}** deleted!`, ephemeral: true });
        }

        if (sub === 'edit') {
            const name = interaction.options.getString('name').toLowerCase();
            const response = interaction.options.getString('response');
            if (!guildTags[name]) return interaction.reply({ content: 'Tag not found!', ephemeral: true });
            guildTags[name].response = response;
            tags[interaction.guild.id] = guildTags;
            fs.writeFileSync(tagsFile, JSON.stringify(tags, null, 2));
            await interaction.reply({ content: `Tag **${name}** updated!`, ephemeral: true });
        }
    }
};

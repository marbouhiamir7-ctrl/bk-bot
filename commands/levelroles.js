const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelroles')
        .setDescription('Configure level-based role rewards')
        .addSubcommand(sub => sub.setName('add').setDescription('Add a level role reward')
            .addIntegerOption(o => o.setName('level').setDescription('Level to reward at').setRequired(true).setMinValue(1))
            .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove a level role reward')
            .addIntegerOption(o => o.setName('level').setDescription('Level').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List all level role rewards'))
        .addSubcommand(sub => sub.setName('clear').setDescription('Clear all level roles'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    cooldown: 3000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = require('../db');

        let levelRoles = db.getGuildSettings(interaction.guild.id).level_roles || {};

        if (sub === 'add') {
            const level = interaction.options.getInteger('level');
            const role = interaction.options.getRole('role');
            if (role.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: 'Role is higher than my highest role!', ephemeral: true });
            levelRoles[level] = role.id;
            db.saveGuildSettings(interaction.guild.id, { level_roles: levelRoles });
            await interaction.reply({ content: `Level ${level} → ${role} reward added!`, ephemeral: true });
        }

        if (sub === 'remove') {
            const level = interaction.options.getInteger('level');
            if (!levelRoles[level]) return interaction.reply({ content: 'No role reward at that level!', ephemeral: true });
            delete levelRoles[level];
            db.saveGuildSettings(interaction.guild.id, { level_roles: levelRoles });
            await interaction.reply({ content: `Level ${level} reward removed!`, ephemeral: true });
        }

        if (sub === 'list') {
            const entries = Object.entries(levelRoles);
            if (entries.length === 0) return interaction.reply({ content: 'No level roles configured!', ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor('#a78bfa')
                .setTitle('Level Role Rewards')
                .setDescription(entries.sort((a, b) => b[0] - a[0]).map(([lvl, roleId]) => `**Level ${lvl}** → <@&${roleId}>`).join('\n'));
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'clear') {
            db.saveGuildSettings(interaction.guild.id, { level_roles: {} });
            await interaction.reply({ content: 'All level roles cleared!', ephemeral: true });
        }
    }
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Manage roles for a member')
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Add a role to a member')
            .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a role from a member')
            .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    cooldown: 3,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: 'You need Manage Roles permission!', ephemeral: true });
        }
        const target = interaction.options.getMember('user');
        if (!target) return interaction.reply({ content: 'Member not found!', ephemeral: true });
        const role = interaction.options.getRole('role');
        if (!role) return interaction.reply({ content: 'Role not found!', ephemeral: true });
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({ content: 'I can\'t manage this role (it\'s higher than my highest role)!', ephemeral: true });
        }
        if (role.managed) return interaction.reply({ content: 'This role is managed by an integration and can\'t be assigned!', ephemeral: true });

        const sub = interaction.options.getSubcommand();
        try {
            if (sub === 'add') {
                if (target.roles.cache.has(role.id)) return interaction.reply({ content: 'They already have this role!', ephemeral: true });
                await target.roles.add(role);
                interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ED573').setTitle('Role Added').setDescription(`Added ${role} to ${target}`).setTimestamp()] });
            } else {
                if (!target.roles.cache.has(role.id)) return interaction.reply({ content: 'They don\'t have this role!', ephemeral: true });
                await target.roles.remove(role);
                interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF4757').setTitle('Role Removed').setDescription(`Removed ${role} from ${target}`).setTimestamp()] });
            }
        } catch(e) {
            interaction.reply({ content: 'Failed: ' + e.message, ephemeral: true });
        }
    }
};

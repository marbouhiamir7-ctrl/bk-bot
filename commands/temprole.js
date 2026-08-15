const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ms = require('ms') || function(s) { const p = s.match(/^(\d+)(s|m|h|d)$/); if (!p) return parseInt(s)*1000; const n=parseInt(p[1]); return p[2]==='s'?n*1000:p[2]==='m'?n*60000:p[2]==='h'?n*3600000:n*86400000; };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temprole')
        .setDescription('Assign a role temporarily')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 1h, 30m, 1d)').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    cooldown: 3000,
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const durationStr = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason';

        let duration;
        try { duration = ms(durationStr); } catch(e) { duration = parseInt(durationStr) * 60000; }
        if (!duration || duration < 60000 || duration > 2592000000) return interaction.reply({ content: 'Duration must be 1 minute to 30 days!', ephemeral: true });

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'User not found!', ephemeral: true });
        if (role.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: 'I can\'t assign a role higher than my highest role!', ephemeral: true });

        await member.roles.add(role.id, reason);
        const embed = new EmbedBuilder()
            .setColor('#fbbf24')
            .setTitle('Temp Role Assigned')
            .setDescription(`${user} given ${role} for ${durationStr}\n**Reason:** ${reason}\n**Expires:** <t:${Math.floor((Date.now() + duration) / 1000)}:R>`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        setTimeout(async () => {
            try {
                const m = await interaction.guild.members.fetch(user.id);
                await m.roles.remove(role.id, 'Temp role expired');
            } catch (e) {}
        }, duration);
    }
};

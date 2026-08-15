const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolehierarchy')
        .setDescription('View the server role hierarchy'),
    cooldown: 3000,
    async execute(interaction) {
        const roles = interaction.guild.roles.cache
            .filter(r => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .first(25);

        if (roles.length === 0) return interaction.reply({ content: 'No roles found!', ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor('#a78bfa')
            .setTitle('Role Hierarchy')
            .setDescription(roles.map((r, i) => {
                const bar = '█'.repeat(Math.max(1, Math.floor(r.members.size / Math.max(1, interaction.guild.memberCount) * 10)));
                return `\`${(i+1).toString().padStart(2)}\` ${r} — ${r.members.size} members ${bar}`;
            }).join('\n'))
            .setFooter({ text: `${roles.length} roles shown • ${interaction.guild.memberCount} total members` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the level leaderboard'),
    cooldown: 10,
    async execute(interaction) {
        const data = Array.from(interaction.client.levelData.entries())
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.level - a.level || b.xp - a.xp)
            .slice(0, 10);

        if (data.length === 0) {
            return interaction.reply({ content: 'No one has leveled up yet!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🏆 Level Leaderboard')
            .setTimestamp();

        let description = '';
        for (let i = 0; i < data.length; i++) {
            const member = interaction.guild.members.cache.get(data[i].id);
            if (member) {
                const medals = ['🥇', '🥈', '🥉'];
                description += `${medals[i] || `**${i + 1}.**`} ${member.user.username} - Level ${data[i].level} (${data[i].xp} XP)\n`;
            }
        }

        embed.setDescription(description);
        interaction.reply({ embeds: [embed] });
    }
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your level and XP')
        .addUserOption(option => option.setName('target').setDescription('The user to check').setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        const target = interaction.options.getMember('target') || interaction.member;
        const userId = target.id;

        if (!interaction.client.levelData.has(userId)) {
            interaction.client.levelData.set(userId, { xp: 0, level: 1 });
        }

        const data = interaction.client.levelData.get(userId);
        const xpNeeded = data.level * 100;

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`${target.user.username}'s Level`)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Level', value: `${data.level}`, inline: true },
                { name: 'XP', value: `${data.xp}/${xpNeeded}`, inline: true },
                { name: 'Progress', value: `${Math.floor((data.xp / xpNeeded) * 100)}%`, inline: true }
            )
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

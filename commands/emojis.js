const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emojis')
        .setDescription('List all emojis in the server'),
    cooldown: 5,
    async execute(interaction) {
        const { guild } = interaction;
        const emojis = guild.emojis.cache;

        if (emojis.size === 0) return interaction.reply({ content: 'No emojis in this server!', ephemeral: true });

        const animated = emojis.filter(e => e.animated);
        const static = emojis.filter(e => !e.animated);

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`${guild.name} Emojis`)
            .setDescription(`**${emojis.size}** total emojis (${animated.size} animated, ${static.size} static)`)
            .setTimestamp();

        const chunks = [];
        emojis.forEach(e => { chunks.push(e.toString()); });

        const pages = [];
        for (let i = 0; i < chunks.length; i += 30) {
            pages.push(chunks.slice(i, i + 30).join(' '));
        }

        if (pages.length > 0) {
            embed.setDescription(`**${emojis.size}** total emojis\n\n${pages[0]}`);
        }

        interaction.reply({ embeds: [embed] });
    }
};

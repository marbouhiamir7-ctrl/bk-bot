const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testwelcome')
        .setDescription('Test the welcome message'),
    cooldown: 10,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need the Administrator permission to use this command!', ephemeral: true });
        }

        const welcomeMessage = config.welcomeMessage.replace('{user}', `${interaction.user}`);

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`Welcome to ${interaction.guild.name}!`)
            .setDescription(welcomeMessage)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setFooter({ text: `Member #${interaction.guild.memberCount}` })
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

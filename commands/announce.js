const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Make an announcement')
        .addChannelOption(option => option.setName('channel').setDescription('The channel to announce in').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('The announcement message').setRequired(true)),
    cooldown: 10,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need the Administrator permission to use this command!', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const announcement = interaction.options.getString('message');

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle('📢 Announcement')
            .setDescription(announcement)
            .setFooter({ text: `Announcement by ${interaction.user.tag}` })
            .setTimestamp();

        channel.send({ embeds: [embed] });
        interaction.reply({ content: `Announcement sent to ${channel}!`, ephemeral: true });
    }
};

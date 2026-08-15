const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwelcome')
        .setDescription('Set the welcome channel')
        .addChannelOption(option => option.setName('channel').setDescription('The welcome channel').setRequired(true)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need the Administrator permission to use this command!', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');

        config.welcomeChannel = channel.id;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Welcome Channel Set')
            .addFields(
                { name: 'Channel', value: `${channel}`, inline: true },
                { name: 'Set By', value: `${interaction.user.username}`, inline: true }
            )
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

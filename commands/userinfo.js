const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display user information')
        .addUserOption(option => option.setName('target').setDescription('The user to get info about').setRequired(false)),
    cooldown: 3,
    async execute(interaction) {
        const target = interaction.options.getMember('target') || interaction.member;

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`${target.user.username} Information`)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Username', value: `${target.user.username}`, inline: true },
                { name: 'Nickname', value: `${target.nickname || 'None'}`, inline: true },
                { name: 'ID', value: `${target.id}`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Joined Server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: 'Roles', value: `${target.roles.cache.size - 1}`, inline: true },
                { name: 'Is Bot', value: `${target.user.bot ? 'Yes' : 'No'}`, inline: true }
            )
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

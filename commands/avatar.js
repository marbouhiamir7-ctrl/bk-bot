const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Show a user\'s avatar')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false)),
    cooldown: 3,
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const avatar = user.displayAvatarURL({ dynamic: true, size: 1024 });

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`${user.username}'s Avatar`)
            .setImage(avatar)
            .setDescription(`[Download Avatar](${avatar})`)
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};

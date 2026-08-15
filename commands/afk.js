const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set yourself as AFK')
        .addStringOption(opt => opt.setName('reason').setDescription('AFK reason').setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        const reason = interaction.options.getString('reason') || 'AFK';
        const nickname = interaction.member.nickname || interaction.user.username;

        try {
            if (!nickname.startsWith('[AFK] ')) {
                await interaction.member.setNickname(`[AFK] ${nickname}`.substring(0, 32));
            }

            if (!interaction.client.afkUsers) interaction.client.afkUsers = new Map();
            interaction.client.afkUsers.set(interaction.user.id, {
                reason,
                since: Date.now(),
                originalNickname: nickname
            });

            const embed = new EmbedBuilder()
                .setColor('#FFA502')
                .setTitle('AFK Set')
                .setDescription(`${interaction.user} is now AFK: **${reason}**`)
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        } catch(e) {
            interaction.reply({ content: 'Failed: ' + e.message, ephemeral: true });
        }
    }
};

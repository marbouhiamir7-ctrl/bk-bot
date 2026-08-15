const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for a channel')
        .addIntegerOption(opt => opt.setName('seconds').setDescription('Slowmode in seconds (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to set slowmode').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: 'You need Manage Channels permission!', ephemeral: true });
        }
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const seconds = interaction.options.getInteger('seconds');

        try {
            await channel.setRateLimitPerUser(seconds);
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('Slowmode Updated')
                .setDescription(seconds > 0
                    ? `Slowmode set to **${seconds} second${seconds !== 1 ? 's' : ''}** in ${channel}`
                    : `Slowmode disabled in ${channel}`)
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        } catch(e) {
            interaction.reply({ content: 'Failed to set slowmode: ' + e.message, ephemeral: true });
        }
    }
};

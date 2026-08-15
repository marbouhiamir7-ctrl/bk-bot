const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock').setRequired(false))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for locking').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: 'You need Manage Channels permission!', ephemeral: true });
        }
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('Channel Locked')
                .setDescription(`${channel} has been locked`)
                .addFields({ name: 'Reason', value: reason }, { name: 'Moderator', value: `${interaction.user}` })
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        } catch(e) {
            interaction.reply({ content: 'Failed to lock channel: ' + e.message, ephemeral: true });
        }
    }
};

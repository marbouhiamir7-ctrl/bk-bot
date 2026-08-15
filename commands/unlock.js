const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: 'You need Manage Channels permission!', ephemeral: true });
        }
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
            const embed = new EmbedBuilder()
                .setColor('#2ED573')
                .setTitle('Channel Unlocked')
                .setDescription(`${channel} has been unlocked`)
                .addFields({ name: 'Moderator', value: `${interaction.user}` })
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        } catch(e) {
            interaction.reply({ content: 'Failed to unlock channel: ' + e.message, ephemeral: true });
        }
    }
};

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('permcheck')
        .setDescription('Check permissions for a user in a channel')
        .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Channel to check in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)),
    cooldown: 3000,
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'User not found!', ephemeral: true });

        const channelPerms = channel.permissionsFor(member);
        if (!channelPerms) return interaction.reply({ content: 'Cannot check permissions!', ephemeral: true });

        const checks = [
            ['Administrator', 'Administrator'],
            ['Manage Server', 'ManageGuild'],
            ['Manage Channels', 'ManageChannels'],
            ['Manage Roles', 'ManageRoles'],
            ['Manage Messages', 'ManageMessages'],
            ['Ban Members', 'BanMembers'],
            ['Kick Members', 'KickMembers'],
            ['Mute Members', 'MuteMembers'],
            ['Deafen Members', 'DeafenMembers'],
            ['Move Members', 'MoveMembers'],
            ['View Channel', 'ViewChannel'],
            ['Send Messages', 'SendMessages'],
            ['Embed Links', 'EmbedLinks'],
            ['Attach Files', 'AttachFiles'],
            ['Read Message History', 'ReadMessageHistory'],
            ['Add Reactions', 'AddReactions'],
            ['Connect', 'Connect'],
            ['Speak', 'Speak'],
            ['Use Voice Activity', 'UseVAD'],
        ];

        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor || '#60a5fa')
            .setTitle(`Permissions: ${user.username}`)
            .setDescription(`In ${channel}`)
            .addFields(checks.map(([name, perm]) => ({
                name,
                value: channelPerms.has(perm) ? '✅' : '❌',
                inline: true
            })));

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

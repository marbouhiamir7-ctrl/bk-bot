const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('social')
        .setDescription('Configure social media alerts')
        .addSubcommand(sub => sub.setName('youtube').setDescription('Set YouTube channel for alerts')
            .addStringOption(o => o.setName('channel_id').setDescription('YouTube channel ID').setRequired(true))
            .addChannelOption(o => o.setName('notify_channel').setDescription('Discord channel to post in'))
            .addStringOption(o => o.setName('message').setDescription('Custom message (use {title}, {link}, {channel})')))
        .addSubcommand(sub => sub.setName('twitch').setDescription('Set Twitch channel for alerts')
            .addStringOption(o => o.setName('username').setDescription('Twitch username').setRequired(true))
            .addChannelOption(o => o.setName('notify_channel').setDescription('Discord channel to post in'))
            .addStringOption(o => o.setName('message').setDescription('Custom message (use {username}, {link})')))
        .addSubcommand(sub => sub.setName('list').setDescription('List configured alerts'))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove an alert')
            .addStringOption(o => o.setName('platform').setDescription('Platform').addChoices({ name: 'YouTube', value: 'youtube' }, { name: 'Twitch', value: 'twitch' }).setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    cooldown: 5000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = require('../db');

        if (sub === 'youtube') {
            const ytId = interaction.options.getString('channel_id');
            const channel = interaction.options.getChannel('notify_channel') || interaction.channel;
            const msg = interaction.options.getString('message') || 'New video from {channel}!\n\n**{title}**\n{link}';

            db.saveGuildSettings(interaction.guild.id, {
                social_youtube_id: ytId,
                social_youtube_channel: channel.id,
                social_youtube_message: msg
            });

            await interaction.reply({ content: `YouTube alerts configured! Will post in ${channel} when a new video is detected.`, ephemeral: true });
        }

        if (sub === 'twitch') {
            const username = interaction.options.getString('username');
            const channel = interaction.options.getChannel('notify_channel') || interaction.channel;
            const msg = interaction.options.getString('message') || '{username} is now live on Twitch!\n\n{link}';

            db.saveGuildSettings(interaction.guild.id, {
                social_twitch_username: username,
                social_twitch_channel: channel.id,
                social_twitch_message: msg
            });

            await interaction.reply({ content: `Twitch alerts configured! Will post in ${channel} when ${username} goes live.`, ephemeral: true });
        }

        if (sub === 'list') {
            const settings = db.getGuildSettings(interaction.guild.id);
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('Social Media Alerts')
                .addFields(
                    { name: 'YouTube', value: settings.social_youtube_id ? `\`${settings.social_youtube_id}\` → <#${settings.social_youtube_channel}>` : 'Not configured', inline: true },
                    { name: 'Twitch', value: settings.social_twitch_username ? `\`${settings.social_twitch_username}\` → <#${settings.social_twitch_channel}>` : 'Not configured', inline: true }
                );
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'remove') {
            const platform = interaction.options.getString('platform');
            const key = platform === 'youtube' ? 'social_youtube_id' : 'social_twitch_username';
            db.saveGuildSettings(interaction.guild.id, { [key]: '' });
            await interaction.reply({ content: `${platform} alerts removed!`, ephemeral: true });
        }
    }
};

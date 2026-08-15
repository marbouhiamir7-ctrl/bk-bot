const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voicerooms')
        .setDescription('Configure temporary voice channels')
        .addSubcommand(sub => sub.setName('setup').setDescription('Set up voice room system')
            .addChannelOption(o => o.setName('lobby').setDescription('Join-to-create lobby channel').addChannelTypes(ChannelType.GuildVoice).setRequired(true))
            .addChannelOption(o => o.setName('category').setDescription('Category for temp channels').addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(sub => sub.setName('limit').setDescription('Set default user limit')
            .addIntegerOption(o => o.setName('limit').setDescription('Max users (0=unlimited)').setMinValue(0).setMaxValue(99).setRequired(true)))
        .addSubcommand(sub => sub.setName('disable').setDescription('Disable voice rooms'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    cooldown: 5000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = require('../db');

        if (sub === 'setup') {
            const lobby = interaction.options.getChannel('lobby');
            const category = interaction.options.getChannel('category');

            db.saveGuildSettings(interaction.guild.id, {
                voicerooms_enabled: true,
                voicerooms_lobby: lobby.id,
                voicerooms_category: category?.id || ''
            });

            const embed = new EmbedBuilder()
                .setColor('#22d3ee')
                .setTitle('Voice Rooms Configured!')
                .setDescription(`**Lobby:** ${lobby}\n**Category:** ${category?.name || 'Same as lobby'}\n\nWhen someone joins ${lobby}, a temporary voice channel will be created for them. When they leave, it gets deleted.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'limit') {
            const limit = interaction.options.getInteger('limit');
            db.saveGuildSettings(interaction.guild.id, { voicerooms_limit: limit });
            await interaction.reply({ content: `Default user limit set to ${limit || 'unlimited'}!`, ephemeral: true });
        }

        if (sub === 'disable') {
            db.saveGuildSettings(interaction.guild.id, { voicerooms_enabled: false });
            await interaction.reply({ content: 'Voice rooms disabled!', ephemeral: true });
        }
    }
};

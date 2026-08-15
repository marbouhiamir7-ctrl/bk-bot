const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcomebanner')
        .setDescription('Configure welcome banners')
        .addSubcommand(sub => sub.setName('set').setDescription('Set welcome banner settings')
            .addStringOption(o => o.setName('color').setDescription('Banner color (hex, e.g. #FF6B6B)'))
            .addStringOption(o => o.setName('text_color').setDescription('Text color (hex)'))
            .addStringOption(o => o.setName('title').setDescription('Banner title (use {user})'))
            .addStringOption(o => o.setName('subtitle').setDescription('Subtitle (use {server}, {member_count})')))
        .addSubcommand(sub => sub.setName('preview').setDescription('Preview the welcome banner'))
        .addSubcommand(sub => sub.setName('disable').setDescription('Disable welcome banners')),
    cooldown: 3000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = require('../db');

        if (sub === 'set') {
            const color = interaction.options.getString('color') || '#FF6B6B';
            const textColor = interaction.options.getString('text_color') || '#FFFFFF';
            const title = interaction.options.getString('title') || 'Welcome, {user}!';
            const subtitle = interaction.options.getString('subtitle') || 'to {server} • member #{member_count}';

            db.saveGuildSettings(interaction.guild.id, {
                banner_enabled: true,
                banner_color: color,
                banner_text_color: textColor,
                banner_title: title,
                banner_subtitle: subtitle
            });

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle('Banner Configured!')
                .setDescription(`**Title:** ${title}\n**Subtitle:** ${subtitle}\n**Color:** ${color}\n**Text:** ${textColor}\n\nRun \`/welcomebanner preview\` to see a preview.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'preview') {
            const settings = db.getGuildSettings(interaction.guild.id);
            const color = settings.banner_color || '#FF6B6B';
            const memberCount = interaction.guild.memberCount;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle((settings.banner_title || 'Welcome, {user}!').replace('{user}', interaction.user.username))
                .setDescription((settings.banner_subtitle || 'to {server} • member #{member_count}')
                    .replace('{server}', interaction.guild.name)
                    .replace('{member_count}', memberCount))
                .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (sub === 'disable') {
            db.saveGuildSettings(interaction.guild.id, { banner_enabled: false });
            await interaction.reply({ content: 'Welcome banners disabled!', ephemeral: true });
        }
    }
};

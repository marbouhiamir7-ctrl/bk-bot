const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, WebhookClient } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('webhook')
        .setDescription('Webhook management')
        .addSubcommand(sub => sub.setName('create').setDescription('Create a webhook')
            .addStringOption(o => o.setName('name').setDescription('Webhook name').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel for the webhook')))
        .addSubcommand(sub => sub.setName('send').setDescription('Send via webhook')
            .addStringOption(o => o.setName('webhook_url').setDescription('Webhook URL').setRequired(true))
            .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true))
            .addStringOption(o => o.setName('username').setDescription('Override username'))
            .addStringOption(o => o.setName('avatar').setDescription('Override avatar URL')))
        .addSubcommand(sub => sub.setName('list').setDescription('List webhooks in this channel'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete a webhook')
            .addStringOption(o => o.setName('webhook_url').setDescription('Webhook URL').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks),
    cooldown: 3000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const name = interaction.options.getString('name');
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            try {
                const webhook = await interaction.guild.webhooks.create({ name, channel: channel.id, avatar: interaction.client.user.displayAvatarURL() });
                await interaction.reply({ content: `Webhook created!\n**Name:** ${webhook.name}\n**URL:** ${webhook.url}`, ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `Failed: ${e.message}`, ephemeral: true });
            }
        }

        if (sub === 'send') {
            const url = interaction.options.getString('webhook_url');
            const message = interaction.options.getString('message');
            const username = interaction.options.getString('username');
            const avatar = interaction.options.getString('avatar');
            try {
                const webhook = new WebhookClient({ url });
                await webhook.send({ content: message, username: username || undefined, avatarURL: avatar || undefined });
                await interaction.reply({ content: 'Message sent!', ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `Failed: ${e.message}`, ephemeral: true });
            }
        }

        if (sub === 'list') {
            const webhooks = await interaction.guild.fetchWebhooks();
            const embed = new EmbedBuilder()
                .setColor('#60a5fa')
                .setTitle('Webhooks')
                .setDescription(webhooks.size === 0 ? 'No webhooks' : webhooks.map(w => `**${w.name}** — <#${w.channelId}> — \`${w.id}\``).join('\n'));
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'delete') {
            const url = interaction.options.getString('webhook_url');
            try {
                const webhook = new WebhookClient({ url });
                await webhook.delete();
                await interaction.reply({ content: 'Webhook deleted!', ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `Failed: ${e.message}`, ephemeral: true });
            }
        }
    }
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket')
        .addStringOption(option => option.setName('reason').setDescription('Reason for the ticket').setRequired(false)),
    cooldown: 30,
    async execute(interaction) {
        const existingTicket = interaction.client.tickets.get(interaction.user.id);
        if (existingTicket) {
            return interaction.reply({ content: 'You already have an open ticket!', ephemeral: true });
        }

        const ticketChannel = await interaction.guild.channels.create(`ticket-${interaction.user.username}`, {
            type: 0,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                }
            ]
        });

        interaction.client.tickets.set(interaction.user.id, {
            channelId: ticketChannel.id,
            createdBy: interaction.user.tag,
            createdAt: new Date().toISOString(),
            reason: interaction.options.getString('reason') || 'No reason provided'
        });

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🎫 Support Ticket')
            .setDescription(`Welcome ${interaction.user}!\n\nPlease describe your issue and a staff member will assist you soon.`)
            .addFields(
                { name: 'Reason', value: interaction.options.getString('reason') || 'No reason provided', inline: true },
                { name: 'Created By', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();

        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

        await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeButton] });

        interaction.reply({ content: `Your ticket has been created: ${ticketChannel}`, ephemeral: true });
    }
};

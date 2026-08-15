const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages by a specific user')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to check (default 100)').setRequired(false).setMinValue(1).setMaxValue(500))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    cooldown: 10,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: 'You need Manage Messages permission!', ephemeral: true });
        }
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount') || 100;

        await interaction.deferReply();

        try {
            const messages = await interaction.channel.messages.fetch({ limit: Math.min(amount, 100) });
            const userMsgs = messages.filter(m => m.author.id === target.id && (Date.now() - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);

            if (userMsgs.size === 0) return interaction.editReply('No messages found from this user in the last 14 days.');

            const deleted = await interaction.channel.bulkDelete(userMsgs, true);

            const embed = new EmbedBuilder()
                .setColor('#2ED573')
                .setTitle('Messages Purged')
                .setDescription(`Deleted **${deleted.size}** messages from ${target}`)
                .setTimestamp();

            interaction.editReply({ embeds: [embed] });
        } catch(e) {
            interaction.editReply('Failed: ' + e.message);
        }
    }
};

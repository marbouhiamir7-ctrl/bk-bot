const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View warnings for a member')
        .addUserOption(option => option.setName('target').setDescription('The member to check').setRequired(true)),
    cooldown: 3,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: 'You need the Moderate Members permission to use this command!', ephemeral: true });
        }

        const target = interaction.options.getMember('target');
        if (!target) return interaction.reply({ content: 'Please mention a valid member.', ephemeral: true });

        const warnings = interaction.client.warnings.get(target.id) || [];

        if (warnings.length === 0) {
            return interaction.reply({ content: `${target.user.tag} has no warnings.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FFCC00')
            .setTitle(`Warnings for ${target.user.tag}`)
            .setDescription(`Total warnings: ${warnings.length}`)
            .setTimestamp();

        warnings.forEach((warn, index) => {
            embed.addFields({
                name: `Warning ${index + 1}`,
                value: `Reason: ${warn.reason}\nModerator: ${warn.moderator}\nDate: ${new Date(warn.date).toLocaleDateString()}`
            });
        });

        interaction.reply({ embeds: [embed] });
    }
};

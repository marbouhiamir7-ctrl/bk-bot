const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nick')
        .setDescription('Change a member\'s nickname')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addStringOption(opt => opt.setName('nickname').setDescription('New nickname (leave empty to reset)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({ content: 'You need Manage Nicknames permission!', ephemeral: true });
        }
        const target = interaction.options.getMember('user');
        if (!target) return interaction.reply({ content: 'Member not found!', ephemeral: true });

        const nick = interaction.options.getString('nickname') || null;
        try {
            await target.setNickname(nick);
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('Nickname Changed')
                .setDescription(`Changed ${target}'s nickname to **${nick || '(reset)'}**`)
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        } catch(e) {
            interaction.reply({ content: 'Failed to change nickname: ' + e.message, ephemeral: true });
        }
    }
};

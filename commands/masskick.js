const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('masskick')
        .setDescription('Mass kick multiple users')
        .addStringOption(option => option.setName('users').setDescription('User mentions or IDs separated by spaces').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the kick').setRequired(false)),
    cooldown: 10,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({ content: 'You need the Kick Members permission to use this command!', ephemeral: true });
        }

        const targets = interaction.options.getString('users').split(' ');
        const reason = interaction.options.getString('reason') || 'Mass kick';

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('👢 Mass Kick')
            .setDescription('Kicking users...')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        let kicked = 0;
        let failed = 0;

        for (const target of targets) {
            try {
                const member = interaction.guild.members.cache.get(target.replace(/[^0-9]/g, ''));
                if (member) {
                    await member.kick(reason);
                    kicked++;
                } else {
                    failed++;
                }
            } catch (error) {
                failed++;
            }
        }

        const resultEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('👢 Mass Kick Complete')
            .addFields(
                { name: 'Kicked', value: `${kicked} users`, inline: true },
                { name: 'Failed', value: `${failed} users`, inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Moderator', value: `${interaction.user.tag}`, inline: true }
            )
            .setTimestamp();

        interaction.editReply({ embeds: [resultEmbed] });
    }
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a reminder')
        .addIntegerOption(option => option.setName('time').setDescription('Time in minutes').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('What to remind you about').setRequired(true)),
    cooldown: 5,
    async execute(interaction) {
        const time = interaction.options.getInteger('time');
        const reminder = interaction.options.getString('message');

        if (!time || time < 1) {
            return interaction.reply({ content: 'Please provide a valid time in minutes.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('⏰ Reminder Set')
            .addFields(
                { name: 'Time', value: `${time} minute(s)`, inline: true },
                { name: 'Reminder', value: reminder, inline: true }
            )
            .setTimestamp();

        interaction.reply({ embeds: [embed] });

        setTimeout(() => {
            const remindEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('⏰ Reminder!')
                .setDescription(`**${reminder}**`)
                .setFooter({ text: `Reminder from ${interaction.user.username}` })
                .setTimestamp();

            interaction.channel.send({ content: `${interaction.user}`, embeds: [remindEmbed] });
        }, time * 60000);
    }
};

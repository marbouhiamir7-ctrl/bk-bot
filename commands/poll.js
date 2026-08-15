const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll')
        .addStringOption(option => option.setName('question').setDescription('The poll question').setRequired(true))
        .addStringOption(option => option.setName('options').setDescription('Options separated by commas (optional)').setRequired(false)),
    cooldown: 10,
    async execute(interaction) {
        const question = interaction.options.getString('question');
        const optionsStr = interaction.options.getString('options');
        const options = optionsStr ? optionsStr.split(',').map(o => o.trim()) : [];

        if (options.length > 10) return interaction.reply({ content: 'You can only have up to 10 options!', ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('📊 Poll')
            .setDescription(`**${question}**`)
            .setFooter({ text: `Poll created by ${interaction.user.tag}` })
            .setTimestamp();

        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

        if (options.length > 0) {
            let description = '';
            options.forEach((option, index) => {
                description += `${numberEmojis[index]} ${option}\n`;
            });
            embed.setDescription(`**${question}**\n\n${description}`);
        }

        await interaction.reply({ embeds: [embed] });

        const message = await interaction.fetchReply();

        if (options.length > 0) {
            for (let i = 0; i < options.length; i++) {
                await message.react(numberEmojis[i]);
            }
        } else {
            await message.react('👍');
            await message.react('👎');
        }
    }
};

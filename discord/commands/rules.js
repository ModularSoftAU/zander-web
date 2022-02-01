const { MessageEmbed } = require('discord.js');
const config = require('../../config.json')

module.exports = {
  name: 'rules',
  description: 'Link to the Network rules.',
  category: 'Information',
  slash: true,
  guildOnly: true,
  testOnly: false,

  callback: ({ interaction }) => {
    try {
      const embed = new MessageEmbed()
      .setTitle(`Network Rules`)
      .setDescription(`Please ensure you follow and abide by the rules which you can read here: ${config.siteConfiguration.siteAddress}/rules`)

      interaction.reply({
        embeds: [embed],
        empheral: true
      });                      
    } catch (error) {
      console.log(error);
      return                      
    }
  },
}
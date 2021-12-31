const { MessageEmbed } = require('discord.js');
const config = require('../../config.json')

module.exports = {
  name: 'website',
  description: 'Link to the Network website.',
  category: 'Information',
  slash: true,
  guildOnly: true,
  testOnly: false,

  callback: ({ interaction }) => {
    try {
      const embed = new MessageEmbed()
      .setTitle(`Network Website`)
      .setDescription(`For more info and to get involved with the community, jump on our website ${config.siteConfiguration.siteAddress}`)

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
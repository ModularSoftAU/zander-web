const { MessageEmbed } = require('discord.js');
const config = require('../../config.json')

module.exports = {
  name: 'policy',
  description: 'List all Network policies for the user to view.',
  category: 'Information',
  slash: true,
  guildOnly: true,
  testOnly: false,

  callback: ({ interaction }) => {
    try {
      const embed = new MessageEmbed()
      .setTitle(`Network Policy`)
      .setDescription(`For user reference, here is a link to all Network polices.\nBy joining the Network and using our services you agree to all our polices.`)

      .addField(`Rules`, `${config.siteConfiguration.siteAddress}/rules`)
      .addField(`Terms Of Service`, `${config.siteConfiguration.siteAddress}/terms`)
      .addField(`Privacy Policy`, `${config.siteConfiguration.siteAddress}/privacy`)
      .addField(`Refund Policy`, `${config.siteConfiguration.siteAddress}/refund`)

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
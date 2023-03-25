import { Listener } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import fetch from 'node-fetch';
import config from '../config.json' assert {type: "json"};
import features from '../features.json' assert {type: "json"};

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'messageCreate'
    });
  }

  async run(message) {
    // Check if the author is a bot
    if (message.author.bot) return;
    
    if (features.filter.link || features.filter.phrase) {
      try {
        const filterURL = `${process.env.siteAddress}/api/filter`;
        const bodyJSON = { content: message.content };
  
        const response = await fetch(filterURL, {
          method: 'POST',
          body: JSON.stringify(bodyJSON),
          headers: {
              'Content-Type': 'application/json',
              'x-access-token': process.env.apiKey
          }
        })
  
        const dataResponse = await response.json();
        console.log(dataResponse);
  
        if (message.author.isbot) return
  
        if (dataResponse.success == false) {
          let embed = new MessageEmbed()
          .setTitle(`Prohibited content has been detected!`)
          .setDescription(`${message.author.username} please don't advertise or say prohibited content/phrases. If you continue, you will be punished.`)
          .setColor(`#ff3333`)
          message.reply({embeds: [embed]});
        }
        
      } catch (error) {
        console.log(error);
        return
      } 
    }
  }
}
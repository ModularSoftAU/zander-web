import { Listener } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import fetch from 'node-fetch';
import config from '../config.json' assert {type: "json"};

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'messageCreate'
    });
  }

  async run(message) {

    try {
      const phraseFilterURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/filter/phrase`;
      const bodyJSON = { content: message.content };

      const response = await fetch(phraseFilterURL, {
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
        .setTitle(`Swearing has been detected`)
        .setDescription(`${message.author.username} please don't swear. If you continue, you will be punished.`)
        .setColor(`#ff3333`)
        message.reply({embeds: [embed]});
      }
      
    } catch (error) {
      console.log(error);
      return
    }

  }
}
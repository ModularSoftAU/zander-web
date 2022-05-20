import { Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};
import fetch from 'node-fetch';

export class RulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'status',
      description: 'Display Servers and number of users online'
    });
  }

  async messageRun(message) {
    try {
      const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/users/get`;
      const response = await fetch(fetchURL);
      const apiData = await response.json();

      const embed = new MessageEmbed()
      .setTitle(`Network Status`)
      .setColor('#ffff4d')

      // Loop through each server and grab the name and number of players online.
      apiData.data.forEach(server => {
        embed.addField(`${server.name}`, `${server.playersOnline}`, true)
      });

      message.reply({
        embeds: [embed],
        empheral: true
      });                      
    } catch (error) {
      console.log(error);
      return
    }
  }
}
import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};
import fetch from 'node-fetch';

export class StatusCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'status',
      description: 'Display Servers and number of users online',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      }
    });
  }

  async chatInputRun(interaction) {
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

      interaction.reply({
        embeds: [embed],
        empheral: true
      });                      
    } catch (error) {
      interaction.reply(error)
      return
    }
  }

}
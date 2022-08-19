import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import features from '../features.json' assert {type: "json"};
import config from '../config.json' assert {type: "json"};
import fetch from 'node-fetch';

export class NameHistoryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'altcheck',
      description: 'Find and display all users that have used/connected to the account.',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      },
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder //
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption(option =>
          option.setName('username')
            .setDescription('The username to search for connected accounts.')
            .setRequired(true))
    );
  }

  async chatInputRun(interaction) {
    if (features.moderation.ipCheck) {
      const username = interaction.options.getString('username');

      const response = await fetch(`${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/user/check/alts?username=${username}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': process.env.apiKey
        }
      });
      const data = await response.json();

      console.log(data);

      if (!data.success) {
        const embed = new MessageEmbed()
        .setTitle(`Error in Alt Check Lookup`)
        .setDescription(data.message)
        .setColor('RED')

        return interaction.reply({
          embeds: [embed],
          empheral: true
        });
      }

      const embed = new MessageEmbed()
        .setTitle(`Alt Check for ${ipaddress}`)

        data.forEach(entry => {
          embed.addField(entry.username, entry.ipaddress) 
        });

        interaction.reply({
          embeds: [embed],
          empheral: true
        });      
    } else {
      interaction.reply("This feature has been disabled by the System Administrator.");
    }
  }
}
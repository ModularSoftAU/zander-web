import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};
import fetch from 'node-fetch';
import moment from 'moment'

export class NameHistoryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'namehistory',
      description: 'Display the name history of a specified user.',
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
            .setDescription('The username of the requesting user to obtain name history from.')
            .setRequired(true))
    );
  }

  async chatInputRun(interaction) {
    const username = interaction.options.getString('username');

    const UUIDFetchURL = `https://api.mojang.com/users/profiles/minecraft/${username}`;
    const UUIDResponse = await fetch(UUIDFetchURL);
    const UUIDApiData = await UUIDResponse.json();

    const uuid = UUIDApiData.id;

    const NameHistoryFetchURL = `https://api.mojang.com/user/profiles/${uuid}/names`;
    const NameHistoryResponse = await fetch(NameHistoryFetchURL);
    const NameHistoryApiData = await NameHistoryResponse.json();

    const embed = new MessageEmbed()
      .setTitle(`Name History for ${username}`)

      NameHistoryApiData
        .slice()
        .reverse()
        .forEach(name => {
          let nameChangeTime = null;

          if (name.changedToAt) {
            nameChangeTime = `${moment(name.changedToAt ?? null).format('MMMM Do YYYY')} (${moment(name.changedToAt ?? null).fromNow()})`
            embed.addField(name.name, `${nameChangeTime}`)            
          } else {
            nameChangeTime = `*First Username*`;
            embed.addField(name.name, `${nameChangeTime}`)
          }
        });

      interaction.reply({
        embeds: [embed],
        empheral: true
      });
  }
}
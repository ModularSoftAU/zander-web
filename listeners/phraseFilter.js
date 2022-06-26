import { Listener } from '@sapphire/framework';

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'messageCreate'
    });
  }

  async run(message) {
    
    const filterPhraseURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/filter/phrase`;
    const filterPhraseResponse = await fetch(filterPhraseURL, {
      headers: { 'x-access-token': process.env.apiKey }
    });

    const filterPhraseData = await filterPhraseResponse.json();
    console.log(filterPhraseData);

  }
}
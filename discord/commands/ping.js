module.exports = {
    name: 'ping',
    description: 'Send Ping, recieve pong.',
    category: 'Testing',
    slash: true,
    guildOnly: true,
    testOnly: true,

    callback: ({ interaction }) => {
        try {
            interaction.reply({
                content: "Pong",
                ephemeral: true 
            });
          return
      } catch (error) {
        console.log(error);
        return;  
      }
    },
}
module.exports = (app, fetch, moment) => {

    require('./dashboard')(app, fetch);
    require('./events')(app, fetch, moment);
    require('./knowledgebase')(app, fetch);
    require('./ranks')(app, fetch);
    require('./servers')(app, fetch);

}
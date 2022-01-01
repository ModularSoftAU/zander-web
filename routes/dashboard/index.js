module.exports = (app, fetch) => {

    require('./dashboard')(app, fetch);
    require('./events')(app, fetch);
    require('./knowledgebase')(app, fetch);
    require('./ranks')(app, fetch);
    require('./servers')(app, fetch);

}
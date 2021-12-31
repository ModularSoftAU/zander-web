module.exports = (app) => {

    require('./dashboard')(app);
    require('./events')(app);
    require('./knowledgebase')(app);
    require('./ranks')(app);
    require('./servers')(app);

}
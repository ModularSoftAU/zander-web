module.exports = function (app) {

    app.use(require('./alert'));
    app.use(require('./anticheat'));
    app.use(require('./appeal'));
    app.use(require('./application'));
    app.use(require('./communitycreation'));
    app.use(require('./discord'));
    app.use(require('./event'));
    app.use(require('./friend'));
    app.use(require('./knowledgebase'));
    app.use(require('./punishment'));
    app.use(require('./rank'));
    app.use(require('./report'));
    app.use(require('./server'));
    app.use(require('./session'));
    app.use(require('./shoppingdistrictdirectory'));
    app.use(require('./user'));
    app.use(require('./vote'));
    app.use(require('./web'));

}
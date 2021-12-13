const express = require('express');
const package = require('./package.json');
const config = require('./config.json');

// 
// Website Related
// 
const app = express();
app.use(express.urlencoded());
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.static(__dirname + '/assets'));

//
// Site Routes
//
var index = require('./routes/index');

app.use('/', index);

const policyRoutes = require('./routes/policyRoutes');
app.use(policyRoutes);

const dashboardRoutes = require('./routes/dashboardRoutes');
app.use(dashboardRoutes);

const knowledgebaseRoutes = require('./routes/knowledgebaseRoutes');
app.use(knowledgebaseRoutes);

// 
// API
// 
// #soon

//
// Controllers
//
const database = require('./controllers/databaseController'); // Database controller

//
// Application Boot
//
const port = process.env.PORT || config.port || 8080;
app.listen(port, async function() {
    console.log(`\n// ${package.name} v.${package.version}\nGitHub Repository: ${package.homepage}\nCreated By: ${package.author}`);
    console.log(`Site and API is listening to the port ${port}`);
});
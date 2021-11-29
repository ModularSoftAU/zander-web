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

// const dashboardRoutes = require('./routes/dashboard');
// app.use(dashboardRoutes);

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
    console.log(`Web Application is listening to the port ${port}`);
});
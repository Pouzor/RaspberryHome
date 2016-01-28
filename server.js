// server.js

// ========== Set up ==============
var express = require('express');
var app = express(); 								    // create our app w/ express
var http = require('http');
var io = require('socket.io');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var morgan = require('morgan'); // logguer
var config = require('./config');
var argv = require('minimist')(process.argv.slice(2));  //Get Argument pass to server.js
var port = argv.p ? argv.p : config.port;


app.disable('etag');
app.use(express.static(__dirname + '/app')); 		// set the static files location /public/img will be /img for users
app.use(morgan('dev')); 					// log every request to the console
app.use(bodyParser.urlencoded({extended: true})); // pull information from html in POST
app.use(bodyParser.json()); // parse application/json
app.use(methodOverride('X-HTTP-Method-Override')); //// simulate DELETE and PUT


// ============================== Webservices =================================== //


app.post('/api/authenticate', function (req, res) {
    if (req.body.username == config.auth.username && req.body.password == config.auth.password) {
        res.json({success: true});
    } else {
        res.json({});
    }

});


// Get all databases
app.get('/api/raspberry', function (req, res) {


});



server = http.createServer(app);


server.listen(port);
console.log("App listening on port " + port);
exports = module.exports = app;




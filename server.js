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
var exec = require('child_process').exec;
var argv = require('minimist')(process.argv.slice(2));  //Get Argument pass to server.js
var port = argv.p ? argv.p : config.port;
var schedule = require('node-schedule');

app.disable('etag');
app.use(express.static(__dirname + '/app')); 		// set the static files location /public/img will be /img for users
app.use(morgan('dev')); 					// log every request to the console
app.use(bodyParser.urlencoded({extended: true})); // pull information from html in POST
app.use(bodyParser.json()); // parse application/json
app.use(methodOverride('X-HTTP-Method-Override')); //// simulate DELETE and PUT

//sudo ./chacon_send 6 12325261 1 on
// sudo python Adafruit_DHT.py  22 4


var server = http.createServer(app);
io = io.listen(server);
server.listen(port);

var j = schedule.scheduleJob('*/5 * * * *', function(){
    console.log('Check temperature');
    exec("cat /sys/class/thermal/thermal_zone0/temp", function (error, stdout, stderr) {
       //Check temp from external captor$^^^^^^TODO
    });

});

function getTemperature() {
    exec("cat /sys/class/thermal/thermal_zone0/temp", function (error, stdout, stderr) {
        if (error) {
            console.log(error);
            io.emit('temperature', {
                temp: 0
            });
        }
        io.emit('temperature', {
            temp: stdout / 1000
        });
    });
}


function getCpu() {
    exec("top -d 0.5 -b -n2 | grep 'Cpu(s)'|tail -n 1 | awk '{print $2 + $4}'", function (error, stdout, stderr) {
        if (error) {
            console.log(error);
            io.emit('cpu', {
                cpu: 0
            });
        }

        io.emit('cpu', {
            cpu: stdout
        });
    });
}

function getInfos() {
var infos = {};
    exec("uname -r", function (error, uname, stderr) {
        infos.uname = uname;
        exec("hostname", function (error, hostname, stderr) {
            infos.hostname = hostname;
            exec("uptime | tail -n 1 | awk '{print $3 $4}'",function (error, uptime, stderr) {
                infos.uptime = uptime;
                io.emit('infos', infos);
            })

        });
    });
}


// ============================== Webservices =================================== //


app.post('/api/authenticate', function (req, res) {
    if (req.body.username == config.auth.username && req.body.password == config.auth.password) {
        console.log("Success");
        res.json({success: true});
    } else {
        console.log("Echec");
        res.json({});
    }

});


io.on('connection', function (socket) {
    console.log("Socket on");

    socket.on('get-temp', function(data) {
       getTemperature();
    });

    socket.on('get-cpu', function(data) {
        getCpu();
    });

    socket.on('get-infos', function(data) {
        getInfos();
    });


});


console.log("App listening on port " + port);
exports = module.exports = app;



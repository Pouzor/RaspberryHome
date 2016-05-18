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
var influx = require('influx');
var basicAuth = require('basic-auth-connect');

//Steam
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var proc;
var sockets = {};
var camera = "0";

//Secu
app.use(basicAuth(config.auth.username, config.auth.password));

app.use('/', express.static(path.join(__dirname, 'stream')));
app.disable('etag');
app.use(express.static(__dirname + '/app')); 		// set the static files location /public/img will be /img for users
app.use(morgan('dev')); 					// log every request to the console
app.use(bodyParser.urlencoded({extended: true})); // pull information from html in POST
app.use(bodyParser.json()); // parse application/json
app.use(methodOverride('X-HTTP-Method-Override')); //// simulate DELETE and PUT


var heaters = {
    "salon": {
        "mode": "eco",
        "temperatureCible": 17,
        "relais": ["12325261", "12325262"],
        "lastTemperature": 0,
        "lastHumidity": 0
    },
    "chambre 1": {
        "mode": "eco",
        "temperatureCible": 17,
        "relais": ["12325263"],
        "lastTemperature": 0,
        "lastHumidity": 0
    },
    "chambre 2": {
        "mode": "eco",
        "temperatureCible": 17,
        "relais": ["12325264"],
        "lastTemperature": 0,
        "lastHumidity": 0
    }
};

var modeTemp = {
    "confort": 20,
    "eco": 17
};
var modeActive = {
    "confort": "off",
    "eco": "on"
};

var client = influx({
    host: 'localhost',
    port: 8086,
    protocol: 'http',
    username: 'raspberry',
    password: 'raspberry',
    database: 'home'
});

var client2 = influx({
    host: 'localhost',
    port: 8086,
    protocol: 'http',
    username: 'raspberry',
    password: 'raspberry',
    database: 'raspberry'
});

var server = http.createServer(app);
io = io.listen(server);
server.listen(port);


var rule = new schedule.RecurrenceRule();
rule.minute = new schedule.Range(0, 59, 5);
schedule.scheduleJob(rule, function () {
    getTemperature(true);
    exec("python scripts/Adafruit_DHT.py 22 4", function (error, stdout, stderr) {

        var data = stdout.split(" ");

        if (data[4] && data[8]) {
            console.log('Send data to influx');
            client.writePoint("temperature", parseFloat(data[4]), {temperature: 'temperature'}, {precision: 's'}, done);
            client.writePoint("humidity", parseFloat(data[8]), null, done);

            heaters["salon"].lastTemperature = data[4];
            heaters["salon"].lastHumidity = data[8];
        }

    });
    client.writePoint("temperatureCible_salon", heaters["salon"].temperatureCible, null, done);
    client.writePoint("temperatureCible_chambre 1", heaters["chambre 1"].temperatureCible, null, done);
    client.writePoint("temperatureCible_chambre 2", heaters["chambre 2"].temperatureCible, null, done);
});


function setMode(m, room) {
    console.log("set mode " + m + " on " + room);

    heaters[room].mode = m;
    heaters[room].temperatureCible = modeTemp[m];

    client.writePoint("temperatureCible_" + room, heaters[room].temperatureCible, null, done);
    callChacon(m, room);

}


function callChacon(m, room) {
    if (room == "salon" || room == undefined) {
        exec("./scripts/chacon_send/chacon_send 6 12325261 1 " + modeActive[m], function (error, stdout, stderr) {
            if (error)
                console.log(error);

            console.log('Send mode chacon 1 : ' + modeActive[m]);
            setTimeout(function() {

                exec("./scripts/chacon_send/chacon_send 6 12325262 1 " + modeActive[m], function (error, stdout, stderr) {
                    if (error)
                        console.log(error);
                    console.log('Send mode chacon 2 : ' + modeActive[m]);
                });
            }, 2000); 
            
        });
    } else {
        exec("./scripts/chacon_send/chacon_send 6 " + heaters[room].relais[0] + " 1 " + modeActive[m], function (error, stdout, stderr) {
            if (error)
                console.log(error);
            console.log('Send mode chacon ' + room + ' : ' + modeActive[m]);
        });
    }
}

function done(err, response) {
    if (err)
        console.log('Error : ' + err);

}


function setLight(mode) {

    exec("irsend SEND_ONCE lircd.conf " + mode, function (error, stdout, stderr) {
        if (error)
            console.log(error);
    });
}

function setTV(mode) {

    exec("irsend SEND_ONCE tele " + mode, function (error, stdout, stderr) {
        if (error)
            console.log(error);
    });
}
////////////////////////// STREAM ////////////////////

function stopStreaming() {
    camera = 0;
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
}

function startStreaming(io) {
    camera = 1;
    if (app.get('watchingFile')) {
        io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
        return;
    }

    var args = ["-w", "1024", "-h", "720", "-n", "-q", "75", "-o", "./stream/image_stream.jpg", "-t", "999999999", "-tl", "100"];
    proc = spawn('raspistill', args);

    console.log('Watching for changes...');

    app.set('watchingFile', true);

    fs.watchFile('./stream/image_stream.jpg', function (current, previous) {
        io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
    })

}

//////////////////////// SALON ///////////////////////

var semaineStart = new schedule.RecurrenceRule();
semaineStart.dayOfWeek = [1, 2, 3, 4, 5];
semaineStart.hour = [6, 17];
semaineStart.minute = 0;
schedule.scheduleJob(semaineStart, function () {
    console.log('Start mode confort');
    setMode("confort", "salon");
});

var semaineStop = new schedule.RecurrenceRule();
semaineStop.dayOfWeek = [1, 2, 3, 4, 5];
semaineStop.hour = [1, 8];
semaineStop.minute = 0;
schedule.scheduleJob(semaineStop, function () {
    console.log('stop mode confort');
    setMode("eco", "salon");
});

var weStart = new schedule.RecurrenceRule();
weStart.dayOfWeek = [6, 0];
weStart.hour = [7];
weStart.minute = 30;
schedule.scheduleJob(weStart, function () {
    console.log('Start mode confort WE');
    setMode("confort", "salon");
});

var weStop = new schedule.RecurrenceRule();
weStop.dayOfWeek = [6, 0];
weStop.hour = [1];
weStop.minute = 10;
schedule.scheduleJob(weStop, function () {
    console.log('stop mode confort WE');
    setMode("eco", "salon");
});

/////////////////////////// CHAMBRE //////////////////////////

var semaineChambreStart = new schedule.RecurrenceRule();
semaineChambreStart.dayOfWeek = [1, 2, 3, 4, 5, 6, 7];
semaineChambreStart.hour = [17];
semaineChambreStart.minute = 0;
schedule.scheduleJob(semaineChambreStart, function () {
    console.log('Start mode confort chambres');
    setMode("confort", "chambre 1");
    setTimeout(function() {
        setMode("confort", "chambre 2");
    }, 2000);    
    
});

var semaineChambreStop = new schedule.RecurrenceRule();
semaineChambreStop.dayOfWeek = [1, 2, 3, 4, 5, 6, 7];
semaineChambreStop.hour = [8];
semaineChambreStop.minute = 0;
schedule.scheduleJob(semaineChambreStop, function () {
    console.log('stop mode confort chambres');
    setMode("eco", "chambre 1");
    setTimeout(function() {
        setMode("eco", "chambre 2");
    }, 2000);    

});

//////////////////////////////////////////////////////////////



function getTemperature(save) {
    exec("cat /sys/class/thermal/thermal_zone0/temp", function (error, stdout, stderr) {
        if (error) {
            console.log(error);
        }

        if (save) {
            client2.writePoint("temperature", stdout / 1000, null, done);
        } else {
            io.emit('temperature', {
                temp: stdout / 1000
            });
        }
    });
}


function getCpu() {
    exec("top -d 0.5 -b -n2 | grep 'Cpu(s)'|tail -n 1 | awk '{print $2 + $4}'", function (error, stdout, stderr) {
        if (error) {
            console.log(error);
        }

        io.emit('cpu', {
            cpu: stdout
        });
    });
}

function getMem() {
    exec("free -m", function (error, stdout, stderr) {
        if (error) {
            console.log(error);
        }
        stdout = stdout.replace(/ +(?= )/g, ' ');
        var data = stdout.split(" ");

        io.emit('mem', {
            memTotal: data[14],
            memUsed: data[16]
        });
    });
}

function getInfos() {
    var infos = {};
    exec("uname -r", function (error, uname, stderr) {
        infos.uname = uname;
        exec("hostname", function (error, hostname, stderr) {
            infos.hostname = hostname;
            exec("uptime | tail -n 1 | awk '{print $3 $4}'", function (error, uptime, stderr) {
                infos.uptime = uptime;
                io.emit('infos', infos);
            })

        });
    });
}

function getRooms() {
    io.emit('rooms', {
        chambre1: heaters["chambre 1"],
        chambre2: heaters["chambre 2"]
    });
}

function getHomeTemp() {
    console.log('Call get Home TEMP');

    io.emit('home', {
            temperature: heaters["salon"].lastTemperature,
            humidity: heaters["salon"].lastHumidity
        }
    );

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


app.get('/api/home', function (req, res) {
    console.log('api/home');
    res.json({temperature: heaters["salon"].lastTemperature, humidity: heaters["salon"].lastHumidity});
});


app.get('/ever/devices', function (req, res) {

    res.json({
        "devices": [
            {
                "id": "dev01",
                "name": "Temp1",
                "room": "salon",
                "type": "DevTempHygro",
                "params": [{
                    "key": "temp",
                    "value": heaters["salon"].lastTemperature
                }, {
                    "key": "hygro",
                    "value": heaters["salon"].lastHumidity
                }]
            },
            {
                "id": "dev02",
                "name": "Camera salon",
                "type": "DevCamera",
                "room": "salon",
                "params": [
                    {
                        "key": "localjpegurl",
                        "value": "http://pouzor.hd.free.fr:8081/image_stream.jpg"
                    },
                    {
                        "key": "remotejpegurl",
                        "value": "http://pouzor.hd.free.fr:8081/image_stream.jpg"
                    }

                ]
            },
            {
                "id" : "dev03",
                "name" : "Camera On/Off",
                "type" : "DevLock",
                "room" : "salon",
                "params" : [
                    {
                        "key" : "Status",
                        "value" : camera
                    }
                ]
            },
			{
				"id": "dev04",
				"name": "Thermostat",
				"type": "DevThermostat",
				"room": "salon",
				"params": [
					{
						"key": "curmode",
						"value": heaters["salon"].mode
					},
					{
						"key": "curfanmode",
						"value": "Off"
					},
					{
						"key": "curenergymode",
						"value": "Energy1"
					},
					{
						"key": "curtemp",
						"value": heaters["salon"].lastTemperature,
						"unit": "°C"
					},
					{
						"key": "cursetpoint",
						"value": heaters["salon"].temperatureCible
					},
					{
						"key": "cursetpoint1",
						"value": "19.0"
					},
					{
						"key": "cursetpointindex",
						"value": "0"
					},
					{
						"key": "step",
						"value": "0.5"
					},
					{
						"key": "minVal",
						"value": "12.0"
					},
					{
						"key": "maxVal",
						"value": "28.0"
					},
					{
						"key": "availablemodes",
						"value": "confort,eco,Off"
					},
					{
						"key": "availablefanmodes",
						"value": "Off,Middle,High"
					},
					{
						"key": "availableenergymodes",
						"value": "Energy1,Energy2"
					}
				]
			},
			{
				"id" : "dev05",
				"name" : "Chauffage salon",
				"type" : "DevMultiSwitch",
				"room" : "salon",
				"params" : [
					{
						"key" : "Value",
						"value" : heaters["salon"].mode
					},
					{
						"key" : "Choices",
						"value" : "eco,confort,Off"
					}
				]
			},
			{
				"id" : "dev06",
				"name" : "Chauffage chambre parents",
				"type" : "DevMultiSwitch",
				"room" : "chambre1",
				"params" : [
					{
						"key" : "Value",
						"value" : heaters["chambre 1"].mode
					},
					{
						"key" : "Choices",
						"value" : "eco,confort,Off"
					}
				]
			},
			{
				"id" : "dev07",
				"name" : "Chauffage chambre Celia",
				"type" : "DevMultiSwitch",
				"room" : "chambre2",
				"params" : [
					{
						"key" : "Value",
						"value" : heaters["chambre 2"].mode
					},
					{
						"key" : "Choices",
						"value" : "eco,confort,Off"
					}
				]
			}
        ]
    });
});

app.get('/ever/system', function (req, res) {
    res.json({
        "id": "42:23:23:24:26:36",
        "apiversion": 1
    });
});

//Open camera
app.get('/ever/devices/dev03/action/setStatus/:action', function(req, res) {
    if (req.params.action == "1"){
        startStreaming(io);
    } else {
        stopStreaming();
    }

    res.json({
        "success": true,
        "errormsg": ""
    });
});

//Set mode salon
app.get('/ever/devices/dev05/action/setChoice/:action', function(req, res) {
    
    setMode(req.params.action, 'salon');
    res.json({
        "success": true,
        "errormsg": ""
    });
});

//Set chambre 1
app.get('/ever/devices/dev06/action/setChoice/:action', function(req, res) {
    
    setMode(req.params.action, 'chambre 1');
    res.json({
        "success": true,
        "errormsg": ""
    });
});

//Set chambre 2
app.get('/ever/devices/dev07/action/setChoice/:action', function(req, res) {
    
    setMode(req.params.action, 'chambre 2');
    res.json({
        "success": true,
        "errormsg": ""
    });
});

app.get('/ever/rooms', function (req, res) {
    res.json({
        "rooms": [
            {
                "id": "salon",
                "name": "Salon"
            },
            {
                "id": "chambre1",
                "name": "Chambre parents"
            },
            {
                "id": "chambre2",
                "name": "Chambre Celia"
            }
        ]
    })
});

// ============================= Socket ================================== //

io.on('connection', function (socket) {

    sockets[socket.id] = socket;

    socket.on('disconnect', function () {
        delete sockets[socket.id];
        console.log('Disconnect socket');
        // no more sockets, kill the stream
        if (Object.keys(sockets).length == 0) {
            app.set('watchingFile', false);
            if (proc) proc.kill();
            fs.unwatchFile('./stream/image_stream.jpg');
        }
    });

    socket.on('start-stream', function () {
        console.log("start streaming");
        startStreaming(io);
    });

    socket.on('stop-stream', function () {
        console.log("stop streaming");
        stopStreaming();
    });


    socket.on('get-temp', function (data) {
        getTemperature();
    });

    socket.on('get-cpu', function (data) {
        getCpu();
    });

    socket.on('get-infos', function (data) {
        getInfos();
    });

    socket.on('get-home', function (data) {
        getHomeTemp();
    });

    socket.on('get-mem', function (data) {
        getMem();
    });

    socket.on('get-rooms', function (data) {
        getRooms();
    });


    socket.on('get-mode', function (data) {
        io.emit('mode', {
            mode: heaters["salon"].mode,
            temp: modeTemp[heaters["salon"].mode]
        });
    });

    socket.on('set-mode', function (data) {
        setMode(data.mode, data.room);

    });

    socket.on('set-light', function (mode) {
        setLight(mode);
    });

    socket.on('set-TV', function (mode) {
        setTV(mode);
    });


});


console.log("App listening on port " + port);
exports = module.exports = app;




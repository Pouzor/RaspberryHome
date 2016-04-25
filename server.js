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

//Secu
//app.use(basicAuth(config.auth.username, config.auth.password));

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

            exec("./scripts/chacon_send/chacon_send 6 12325262 1 " + modeActive[m], function (error, stdout, stderr) {
                if (error)
                    console.log(error);
                console.log('Send mode chacon 2 : ' + modeActive[m]);
            });
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
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
}

function startStreaming(io) {

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

//////////////////////// CRON ///////////////////////

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
semaineStop.hour = [8, 1];
semaineStop.minute = 0;
schedule.scheduleJob(semaineStop, function () {
    console.log('stop mode confort');
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
    setMode("confort", "chambre 2");
});

var semaineChambreStop = new schedule.RecurrenceRule();
semaineChambreStop.dayOfWeek = [1, 2, 3, 4, 5, 6, 7];
semaineChambreStop.hour = [8];
semaineChambreStop.minute = 0;
schedule.scheduleJob(semaineChambreStop, function () {
    console.log('stop mode confort chambres');
    setMode("eco", "chambre 1");
    setMode("eco", "chambre 2");

});

//////////////////////////////////////////////////////////////

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
	
	res.json({"devices" : [
	{
		"id" : "Temp1",
		"name" : "Temp1",
		"room" : "salon",
		"type" : "DevTempHygro",
		"params" : [{
			"key" : "temp",
			"value" : "21.2"
		}, {
			"key" : "hygro",
			"value" : "80"
		}]
	}
	]});
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




var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;
var http = require('http');

// here's a fake temperature sensor device that we'll expose to HomeKit
var MY_SENSOR = {
  currentTemperature: 0,
  getTemperature: function() { 
    console.log("Getting the current temperature!");
    return MY_SENSOR.currentTemperature;
  },
  randomizeTemperature: function() {
    // randomize temperature to a value between 0 and 100
    MY_SENSOR.currentTemperature = Math.round(Math.random() * 100);
  },
  requestTemperature: function() {


	var options = {
		host: 'pouzor.hd.free.fr',
		port: 8081,
		path: '/api/temperature'
	};

	http.get(options, function(resp){
		var body = '';
		resp.on('data', function(chunk){
			body += chunk;
		});
		response.on('end', function() {
            // Data reception is done, do whatever with it!
           var parsed = JSON.parse(body);
		   console.log('getTemp ' + parsed.temp);
           MY_SENSOR.currentTemperature = parsed.temp;
        });
	}).on("error", function(e){
		console.log("Got error: " + e.message);
	});
  }
}


// Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
// even when restarting our server. We use the `uuid.generate` helper function to create
// a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
var sensorUUID = uuid.generate('hap-nodejs:accessories:temperature-sensor');

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
var sensor = exports.accessory = new Accessory('Temperature Sensor', sensorUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
sensor.username = "C1:5D:3A:AE:5E:FA";
sensor.pincode = "031-45-154";

// Add the actual TemperatureSensor Service.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
sensor
  .addService(Service.TemperatureSensor)
  .getCharacteristic(Characteristic.CurrentTemperature)
  .on('get', function(callback) {
    
    // return our current value
    callback(null, MY_SENSOR.getTemperature());
  });

// randomize our temperature reading every 3 seconds
setInterval(function() {
  
  MY_SENSOR.requestTemperature();
  
  // update the characteristic value so interested iOS devices can get notified
  sensor
    .getService(Service.TemperatureSensor)
    .setCharacteristic(Characteristic.CurrentTemperature, MY_SENSOR.currentTemperature);
  
}, 3000);
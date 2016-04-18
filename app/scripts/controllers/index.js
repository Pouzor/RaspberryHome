'use strict';

app.controller('IndexCtrl', function ($scope, Raspberry, socket) {
    $scope.mem = 0;
    $scope.temperature = 0;
    $scope.cpu = 0;
    $scope.home = {
        temperature : 0,
        humidity: 0
    };
    $scope.chambre1 = {};
    $scope.chambre2 = {};

    socket.emit('get-mem');
    socket.emit('get-temp');
    socket.emit('get-cpu');
    socket.emit('get-infos');
	socket.emit('get-home');
	socket.emit('get-mode');
	socket.emit('get-rooms');


    socket.on('rooms', function (data) {

            if (data.chambre1.mode == 'eco') {
                $scope.chambre1 = false;
                jQuery("#switchChambre1").bootstrapSwitch('state', false);
            }
            else {
                $scope.chambre1 = true;
                jQuery("#switchChambre1").bootstrapSwitch('state', true);
            }

            if (data.chambre2.mode == 'eco') {
                $scope.chambre2 = false;
                jQuery("#switchChambre2").bootstrapSwitch('state', false);
            }
            else {
                $scope.chambre2 = true;
                jQuery("#switchChambre2").bootstrapSwitch('state', true);
            }


    });

    socket.on('temperature', function(data) {
        $scope.$apply(function () {
            $scope.temperature = data.temp;
        });
    });

    socket.on('cpu', function(data) {
        $scope.$apply(function () {
            $scope.cpu = data.cpu;
        });
    });

	socket.on('mem', function(data) {
        $scope.$apply(function () {
            $scope.mem = (data.memUsed / data.memTotal) * 100;
        });
    });
	
    socket.on('infos', function(data) {
        $scope.$apply(function () {
            $scope.infos = data;
        });
    });


	socket.on('home', function(data) {
        $scope.$apply(function () {
            $scope.home = data;
          
        });
    });
	
	socket.on('mode', function(data) {
        $scope.$apply(function () {
            $scope.mode = data.mode;
			$scope.modeTemperature = data.temp;
        });
    });
	
	
	$scope.setMode = function(room, state) {
        if (state != undefined) {
            if (state)
                socket.emit('set-mode', {mode: 'confort', room: room});
            else
                socket.emit('set-mode', {mode: 'eco', room: room});
        } else {
            socket.emit('set-mode', {mode: $scope.mode, room: room});
        }

	};
	
	$scope.pressLight = function (mode) {
		socket.emit('set-light', mode);
	};
	
		$scope.pressTV = function (mode) {
		socket.emit('set-TV', mode);
	};
	
	socket.on('liveStream', function(url) {
		console.log("On recoit le steamm");
		$('#stream').attr('src', url);
        $('#streamFull').attr('src', url);
		$scope.stream = url;
		$('.start').hide();
    });
	
	$scope.startStream = function() {
		console.log("Action start");
		socket.emit('start-stream');
		$('.start').hide();
	};
	
	$scope.stopStream = function() {
		console.log("stop camera");
		$('#stream').attr('src', "");
        $('#streamFull').attr('src', "");
		socket.emit('stop-stream');
		$('.start').show();
	};

	
});


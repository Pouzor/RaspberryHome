'use strict';

app.controller('IndexCtrl', function ($scope, Raspberry, socket) {
    $scope.mem = 0;
    $scope.temperature = 0;
    $scope.cpu = 0;
    $scope.home = {
        temperature : 0,
        humidity: 0
    };

    socket.emit('get-mem');
    socket.emit('get-temp');
    socket.emit('get-cpu');
    socket.emit('get-infos');
	socket.emit('get-home');
	socket.emit('get-mode');
	
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
	
	
	$scope.setMode = function() {
		socket.emit('set-mode', $scope.mode);
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


    //demo
    $scope.setDemo2 = function(mode) {
        socket.emit('setDemo2', mode);
    };
    $scope.setDemo1 = function(mode) {
        socket.emit('setDemo1', mode);
    };
	
});


'use strict';

app.controller('IndexCtrl', function ($scope, Raspberry, socket) {

    socket.emit('get-temp');
    socket.emit('get-cpu');
    socket.emit('get-infos');
	socket.emit('get-home');
	socket.emit('get-mem');
	socket.emit('get-mode');
	
    socket.on('temperature', function(data) {
        $scope.$apply(function () {
            $scope.temperature = data.temp;
            initJs();
        });
    });

    socket.on('cpu', function(data) {
        $scope.$apply(function () {
            $scope.cpu = data.cpu;
            initJs();
        });
    });

	socket.on('mem', function(data) {
        $scope.$apply(function () {
            $scope.mem = (data.memUsed / data.memTotal) * 100;
            initJs();
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
	
});


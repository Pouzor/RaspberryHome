'use strict';

app.controller('IndexCtrl', function ($scope, Raspberry, socket) {

    socket.emit('get-temp');
    socket.emit('get-cpu');
    socket.emit('get-infos');

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

    socket.on('infos', function(data) {
        $scope.$apply(function () {
            $scope.infos = data;
            initJs();

        });
    });


});


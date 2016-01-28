'use strict';

app.controller('IndexCtrl', function () {

});

app.controller('ListDatabaseCtrl', function($scope, Database) {
    $scope.databases = Database.get();

});
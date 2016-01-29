'use strict';

app.factory('Raspberry', function ($resource, CONFIG) {

    return $resource(CONFIG.URL+'/api/raspberry/:id',
        { },{
            get :{method: 'get', isArray:false, cache: false},
            findOne: {method: 'get', isArray:false, cache: false}
        });

});
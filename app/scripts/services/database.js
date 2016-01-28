'use strict';

app.factory('Database', function ($resource, CONFIG) {

    return $resource(CONFIG.URL+'/api/database/:id',
        { },{
            get :{method: 'get', isArray:true, cache: false},
            findOne: {method: 'get', isArray:false, cache: false}
        });

});
var api = function(id) {
    return this;
}

api.prototype = {
    putMr: function (table, tid, newObj, cb) {
        var jqXhr = $.ajax({
            url: 'http://'+ window.location.hostname +':8877/test',
            type: 'GET',
            data: {
                sql: escape('SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.' + table + ' WHERE id="' + tid + '"')
            }
        });
        jqXhr.done(function(data) {
            var obj = JSON.parse(data);
            if (obj.length >= 0) {
                var id = obj[0].id;
                var doc = JSON.parse(obj[0].doc);
                Object.keys(newObj).forEach(function(e) {
                    if (newObj[e] == '')
                        delete doc[e];
                    else
                        doc[e] = newObj[e];
                });
                var strData = objToArrDB(doc);
                var jqXhr2 = $.ajax({
                    url: 'http://'+ window.location.hostname +':8877/test',
                    type: 'GET',
                    data: {
                        sql: escape('DELETE FROM docs.' + table + ' WHERE id ="' + id + '"')
                    }
                });
                jqXhr2.done(function(data) {
                    var jqXhr3 = $.ajax({
                        url: 'http://'+ window.location.hostname +':8877/test',
                        type: 'GET',
                        data: {
                            sql: escape('INSERT INTO docs.' + table + ' VALUES ("' + id + '", COLUMN_CREATE(' + strData + '));')
                        }
                    });
                    jqXhr3.done(function(data) {
                        console.log('sukses');
                        cb();
                    });
                });
            }
        });
    },
    obj2arr: 
    //  Descriptions --> Change Object to Array Data that supported to Database API
    //  Parameters --> obj (Object)
    //  Returns --> str (String)
    function(obj) {
        var arr = [];
        Object.keys(obj).forEach(function(e) {
            arr.push(e);
            arr.push(obj[e]);
        });
        return '"' + arr.join('","') + '"';
    },
    querystring: 
    //  Descriptions --> Get Query String from url 
    //  Parameters --> urls (String)
    //  Returns --> params (Object)
    function(queryString) {
        var params = {},
            queries, temp, i, l;
        queries = queryString.split("&");
        for (i = 0, l = queries.length; i < l; i++) {
            temp = queries[i].split('=');
            params[temp[0]] = temp[1];
        }
        return params;
    },
    parsing: function(string) {
        if (!string) string = '[]';
        var array = JSON.parse(string);
        var reArray = array.map(function(e) {
            e.doc = JSON.parse(e.doc);
            return e;
        });
        return reArray;
    },
    errors: function( code , desc) {
    	var objError = {
    		'00': 'Empty Data',
    		'05': 'Connection Timeout'
    	};
    	console.error(objError[code] + " " + desc);
    }
};


document.addEventListener("DOMContentLoaded", function (event) {
    var old = 0;
    var rows = 18;
        var queryString = window.location.search;
        queryString = queryString.substring(1);
        qs = parseQueryString(queryString);
        $.ajax({
            url: 'http://localhost:8877/test',
            type: 'GET',
            data: {
                sql: escape('SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materials WHERE COLUMN_GET(doc, "ID" as char)="' + qs.order + '" AND COLUMN_GET(doc, "Component Item" as char)="' + qs.code + '"')
            },
            success: function (result) {
                var obj = JSON.parse(result);
                obj = obj.map(function(e){
                    return {
                        'id':e.id,
                        'doc': JSON.parse(e.doc)
                    };
                });
                var batchsize = qs.batchsize;
                var batchnumber = qs.batchnumber;
                var dateprocess = qs.dateprocess;
                var operator1 = qs.operator1;
                var operator2 = qs.operator2;
                $('#product_name').text(obj[0].doc['Item Number']);
                $('#batch_size').text(batchsize);
                $('#batch_no').text(batchnumber);
                $('#date_of_process').text(dateprocess);
                var dataHead = obj[0].doc;
                $.ajax({
                    url: 'http://localhost:8877/test',
                    type: 'GET',
                    data: {
                        sql: escape('SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.weights WHERE COLUMN_GET(doc, "ID" as char)="' + qs.order + '" AND COLUMN_GET(doc, "Component Item" as char)="' + qs.code + '" ORDER BY COLUMN_GET(doc, "nettoTime" as char) ASC')
                    },
                    success: function (result) {
                        var obj = JSON.parse(result);
                        obj = obj.map(function(e){
                                    return {
                                        'id':e.id,
                                        'doc': JSON.parse(e.doc)
                                    };
                                });
                                var objName = {};
                                var sum = 0;
                                arrBody = obj.map(function(e, i){
                                    sum = ! (e.doc['Component Item'] in objName) ? 0 : sum;
                                    sum += (e.doc.netto * 1);
                                    console.log(e);
                                    var name = ! (e.doc['Component Item'] in objName) ? e.doc['Component Item'] : '';
                                    objName[e.doc['Component Item']] = e.doc['Component Item'];
                                    return [
                                        //i == 0 ? e.doc['Component Item'] : '',
                                        name,
                                        e.doc['Lot/Serial'],
                                        e.doc['Scale'],
                                        e.doc['number'],
                                        e.doc.netto,
                                        sum.toFixed(9) * 1
                                    ]

                                });
                                console.log(arrBody.length);
                                var header = [
                                    'Material Name',
                                    'Lot No',
                                    'Scale No',
                                    'S/N',
                                    'Quantity',
                                    'Subtotal'
                                ];
                                $('#container').html('<table id="table_data" class="table"></table>')
                                var str = '<thead><tr>';
                                header.forEach(function(e){
                                    str += '<th>' + e + '</th>'
                                });
                                str += '</tr></thead><tbody>';
                                for (i = 0; i < rows; i++) {
                                    str += '<tr>';
                                    str += header.map(function(e, i2){
                                        if( arrBody[i] )
                                            return '<td>' + arrBody[i][i2] +'</td>';
                                        else
                                            return '<td></td>';
                                    }).join('');
                                    str += '</tr>';
                                }
                                str += '</tbody>'
                                $('#table_data').html(str);
                                var operators = [
                                    qs.operator1,
                                    qs.operator2
                                ];
                                var strO = '';
                                var strS = '';
                                operators.forEach(function(e, i){
                                    strO += '<label>Operator '+ (i + 1) +' : ' + e + '</label><br>';
                                    strS += '<label>Sign: ______________________ </label><br>';
                                });
                                $('#operator').html(strO);
                                $('#sign').html(strS);
                                alert('Finished');
                            }}); 
            },
            error: function (req, status, error) {
                alert('error', error);
            }
        });
    });

var parseQueryString = function (queryString) {
    var params = {},
        queries, temp, i, l;
    // Split into key/value pairs
    queries = queryString.split("&");
    // Convert the array of strings into an object
    for (i = 0, l = queries.length; i < l; i++) {
        temp = queries[i].split('=');
        params[temp[0]] = temp[1];
    }
    return params;
};

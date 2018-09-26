document.addEventListener("DOMContentLoaded", function(event) {
    var HOSTPORT_DB = "localhost:8877";
    var HOSTPORT_FS = "localhost:4005";
    var HOSTPORT_IO = "localhost:6666";
    requirejs([
        "/cdn/js/lea.js",
        "/cdn/js/uuidv1.js"
    ], function(Lea, Uuidv1) {
        l = new lea();
        var qs = l.querystring(window.location.search.substring(1));
        l.BrowserReady(async function(){
            var xml = await $.ajax("http://" + HOSTPORT_FS + "/local/index.xml");
            $('#content').html(xml);

            if( 'order' in qs ) {
                var sqlOrder = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.orders WHERE COLUMN_GET(doc, "Work Order" as char)="' + qs.order + '"';
                var objOrders = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sqlOrder)).then(l.parsing);
                var sqlWeight = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.weights WHERE COLUMN_GET(doc, "ID" as char) = "' + objOrders[0].doc.ID + '" ORDER BY COLUMN_GET(doc, "nettoTime" as char) ASC';
                var objWeights = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sqlWeight)).then(l.parsing);
                var sqlMaterial = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materials WHERE COLUMN_GET(doc, "ID" as char) = "' + objOrders[0].doc.ID + '"';
                var objMaterials = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sqlMaterial)).then(l.parsing);
                var objWeightsGroupByComponent = {};
                objWeights.forEach(function(weight){
                    var key = weight.doc['Component Item'];
                    if( !(key in objWeightsGroupByComponent) ) {
                        objWeightsGroupByComponent[key] = {
                            kemasan: 0,
                            totalNetto: 0
                        };
                    } 
                    objWeightsGroupByComponent[key]['kemasan']++;
                    objWeightsGroupByComponent[key]['totalNetto'] = ( objWeightsGroupByComponent[key]['totalNetto'] + (weight.doc.netto * 1) ).toFixed(10) * 1;                
                });
                var oldWeightData = {
                    doc:''
                };
                var strDataTable = objWeights.map(function(weight){
                    var key = weight.doc['Component Item'];
                    weight.doc['totalPackages'] = objWeightsGroupByComponent[key]['kemasan'];
                    var str = '<tr>';
                    str += '<td>' + ( 'kodeBahan' in weight.doc ? weight.doc['kodeBahan'] : '-' ) + '</td>';
                    if( weight.doc['Component Item'] != oldWeightData.doc['Component Item'] )
                        str += '<td rowspan="'+ weight.doc['totalPackages'] +'">' + ( 'Component Item' in weight.doc ? weight.doc['Component Item'] : '-' ) + '</td>';
                    
                    str += '<td>' + ( 'netto' in weight.doc ? weight.doc['netto'] : '-' ) + '</td>';
                    if( weight.doc['Component Item'] != oldWeightData.doc['Component Item'] )
                        str += '<td rowspan="'+ weight.doc['totalPackages'] +'">' + ( 'totalPackages' in weight.doc ? weight.doc['totalPackages'] : '-' ) + '</td>';
                    str += '<td>' + ( 'Scale' in weight.doc ? weight.doc['number'] : '-' ) + '</td>';
                    str += '<td>' + ( 'operator1' in weight.doc ? weight.doc['operator1'] : '-' ) + '</td>';
                    str += '<td>' + ( 'operator2' in weight.doc ? weight.doc['operator2'] : '-' ) + '</td>';
                    str += '<td>' + ( 'penanggungJawab' in weight.doc ? weight.doc['penanggungJawab'] : '-' ) + '</td>';
                    str += '</tr>';
                    oldWeightData = weight;
                    return str;
                }).join('');
                $('#bodyData').empty().html(strDataTable);
            } else {
                l.promptXml({
                    title: 'Order Number',
                    xml: '<input type="text" id="order" placeholder="Order Number" class="name form-control" required />',
                }, {
                    action: async function() {
                        var orderNumber = this.$content.find('#order').val();
                        var url = window.location.toString() + "?order=" + orderNumber;
                        window.location = url;
                    }
                });
            }
        });
    });
});
/*
document.addEventListener("DOMContentLoaded", function(event) {
    var old = 0;
    var rows = 25;
    requirejs(["/cdn/js/localforage.js"], function(localforage) {
        localForage = localforage;
        var queryString = window.location.search;
        queryString = queryString.substring(1);
        qs = parseQueryString(queryString);

        $.ajax({
            url: 'http://localhost:8877/test',
            type: 'GET',
            data: {
                sql: escape('SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materials WHERE COLUMN_GET(doc, "ID" as char)="' + qs.order + '"')
            },
            success: function(result) {
                var obj = JSON.parse(result);
                console.log(obj);
                obj = obj.map(function(e) {
                    return {
                        'id': e.id,
                        'doc': JSON.parse(e.doc)
                    };
                });
                var batchsize = ( obj[0].doc['Qty Required'] * 1)/(obj[0].doc['Qty Per Batch'] * 1);
                var batchnumber = obj[0].doc['Lot Produksi'];
                var dateprocess = "";
                $('link').eq(1).remove();
                $('#product_name').text(obj[0].doc['Item Parent Description']);
                $('#batch_size').text(batchsize);
                $('#batch_no').text(batchnumber);
                var dataHead = obj[0].doc;
                $.ajax({
                    url: 'http://localhost:8877/test',
                    type: 'GET',
                    data: {
                        sql: escape('SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.weights WHERE COLUMN_GET(doc, "ID" as char)="' + qs.order + '" ORDER BY COLUMN_GET(doc, "nettoTime" as char) ASC')
                    },
                    success: function(result) {
                        var obj = JSON.parse(result);
                        $('#date_of_process').text(JSON.parse(obj[0].doc)['nettoTime'].substr(0, 10));
                        var operator1 = JSON.parse(obj[0].doc)['operator1'];
                        var operator2 = JSON.parse(obj[0].doc)['operator2'];
                        obj = obj.map(function(e) {
                            return {
                                'id': e.id,
                                'doc': JSON.parse(e.doc)
                            };
                        });
                        var objName = {};
                        var sum = 0;
                        arrBody = obj.map(function(e, i) {
                            sum = !(e.doc['Component Item'] in objName) ? 0 : sum;
                            sum += (e.doc.netto * 1);
                            console.log(e);
                            var name = !(e.doc['Component Item'] in objName) ? e.doc['Component Item'] : '';
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
                        header.forEach(function(e) {
                            str += '<th>' + e + '</th>'
                        });
                        str += '</tr></thead><tbody>';
                        for (i = 0; i < rows; i++) {
                            str += '<tr>';
                            str += header.map(function(e, i2) {
                                if (arrBody[i])
                                    return '<td>' + arrBody[i][i2] + '</td>';
                                else
                                    return '<td></td>';
                            }).join('');
                            str += '</tr>';
                        }
                        str += '</tbody>'
                        $('#table_data').html(str);
                        var operators = [
                            operator1,
                            operator2
                        ];
                        var strO = '';
                        var strS = '';
                        operators.forEach(function(e, i) {
                            strO += '<label>Operator ' + (i + 1) + ' : ' + e + '</label><br>';
                            strS += '<label>Sign: ______________________ </label><br>';
                        });
                        $('#operator').html(strO);
                        $('#sign').html(strS);

                        $.ajax({
                            url: 'http://localhost:6001/?code=' + qs.code + '&order=' + qs.order + '&batchsize=' + batchsize + '&batchnumber=' + batchnumber + '&dateprocess=' + dateprocess + '&operator1=' + operator1 + '&operator2=' + operator2,
                            type: 'GET',
                            data: {},
                            success: function(result) {
                                console.log('ok');
                            }
                        });

                    }
                });

            },
            error: function(req, status, error) {
                alert('error', error);
            }
        });
    });
});


function debug(e) {
    console.log(e);
}

function createTable(obj) {
    var str = '<table id="datatable" class="table"></table>';
    $('.table-wrap').html(str);
    var str = '<thead><tr>';
    ["#"].concat(obj.head).forEach(function(e) {
        str += '<th>';
        str += e;
        str += '</th>';
    });
    str += '</tr></thead>';
    str += '<tbody>';
    obj.data.forEach(function(e, i) {
        str += '<tr>';
        [i + 1].concat(e).forEach(function(e2, i2) {
            str += '<td class="data' + i2 + '">';
            if (!e2)
                e2 = '-';
            if (i2 == 1 && false)
                str += '<a href="">' + e2 + '</a>';
            else
                str += e2;
            str += '</td>';
        });
        str += '</tr>';
    });
    str += '</tbody>';
    $('#datatable').html(str);
}

var parseQueryString = function(queryString) {
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

var promptVal = function(option, action) {

    $.confirm({
        title: 'Prompt!',
        content: '' +
            '<form action="" class="formName">' +
            '<div class="form-group">' +
            '<label>Product Name</label>' + '<input type="text" class="name form-control" disabled="disabled" value="' + option.product + '" required />' +
            '<label>Batch Size (pcs)</label>' + '<input type="text" placeholder="100" class="batchsize form-control" required />' +
            '<label>Batch Number</label>' + '<input type="text" class="batchnumber form-control" required />' +
            '<label>Date of Process</label>' + '<input type="text" placeholder="01-01-2001" id="dateprocess" class="dateprocess form-control" required />' +
            '<label>Operator 1</label>' + '<input type="text" placeholder="Operator 1" class="operator1 form-control" required />' +
            '<label>Operator 2</label>' + '<input type="text" placeholder="Operator 2" class="operator2 form-control" required />' +
            '</div>' +
            '</form>',
        buttons: {
            formSubmit: {
                text: 'Submit',
                btnClass: 'btn-blue submit',
                action: action
            }
        },

        onContentReady: function() {
            // bind to events
            var jc = this;
            this.$content.find('form').on('submit', function(e) {
                // if the user submits the form by pressing enter in the field.
                e.preventDefault();
                jc.$$formSubmit.trigger('click'); // reference the button and click it
            });
            localForage.getItem(qs.code + '-report').then(function(rep) {
                var obj = JSON.parse(rep);
                $('.batchnumber').val(obj['batchnumber']);
                $('.batchsize').val(obj['batchsize']);
                $('.dateprocess').val(obj['dateprocess']);
                $('.operator1').val(obj['operator1']);
                $('.operator2').val(obj['operator2']);
            });
        }
    });
}
*/
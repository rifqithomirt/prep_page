var state = 'idle';
var gTara = 0;
var gTarget = 0;
var oldStable = 1;
var wsbroker = "127.0.0.1";
var wsport = 15675;
var weighingName = "Qty Required";
var ready = false;
var weighProcess = 'zero';
var weighData = {};
var weighSisa = {};
var taraFirst = false;
var toleransi = 0;
var mqttConnected = false;
document.addEventListener("DOMContentLoaded", function(event) {
    var old = 0;
    material = false;
    requirejs([
        "/cdn/js/localforage.js",
        "/cdn/js/mqttws31.js",
        "/cdn/js/countUp.js",
        "/cdn/js/uuidv1.js",
        "/cdn/js/EventEmitter.min.js"
    ], function(localForage, mqtt, count, Uuidv1, EventEmitter) {
        localforage = localForage;

        client = new Paho.MQTT.Client(wsbroker, wsport, "/ws",
            "myclientid_" + parseInt(Math.random() * 100, 10));
        client.onConnectionLost = function(responseObject) {
            debug("CONNECTION LOST - " + responseObject.errorMessage);
        };
        client.onMessageArrived = function(message) {
            debug("RECEIVE ON " + message.destinationName + " PAYLOAD " + message.payloadString);
            var obj = JSON.parse(message.payloadString);
            if (message.destinationName.indexOf('scale') > -1 && ready && mqttConnected) {
                if (obj.stable == 0 && oldStable !== 0) onScale(weighProcess, obj, true);
                else onScale(weighProcess, obj, false);
                oldStable = obj.stable;
                $('#count').text(obj.data * 1);
            }
        };
        var options = {
            timeout: 3,
            onSuccess: function() {
                debug("CONNECTION SUCCESS");
                localForage.getItem('onFormula').then(function(fm) {
                    fm = JSON.parse(fm);
                    localForage.getItem('onSequence').then(function(sq) {
                        itm = fm[sq];
                        console.log('scale' + itm.Scale);
                        client.subscribe('scale' + itm.Scale, {
                            qos: 1
                        });
                        mqttConnected = true;
                    })
                });

            },
            onFailure: function(message) {
                debug("CONNECTION FAILURE - " + message.errorMessage);
            }
        };
        client.connect(options);

        ee = new EventEmitter();
        $('#save').attr('disabled', 'disabled');
        localForage.getItem('onFormula').then(function(formula) {
            formula = JSON.parse(formula);
            Formula = formula;
            localForage.getItem('onSequence').then(function(seq) {
                item = formula[seq];
                var sql1 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materials WHERE COLUMN_GET(doc, "ID" as char) = "' + item['ID'] + '" AND COLUMN_GET(doc, "Component Item" as char) = "' + item['Component Item'] + '"';
                var sql2 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.stocks WHERE COLUMN_GET(doc, "Item Number" as char) IS NOT NULL';
                var sql3 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materialscode';
                $.when(
                    $.ajax("http://localhost:8877/test?sql=" + escape(sql1)),
                    $.ajax("http://localhost:8877/test?sql=" + escape(sql2))).then(function(a, b, c) {
                    $('#get').attr('disabled', 'disabled');
                    var objMaterials = JSON.parse(a[0]);
                    var objStocks = JSON.parse(b[0]);
                    var arrBarcodeCode = JSON.parse(c[0]);
                    objBarcodeCode = {}
                    arrBarcodeCode.forEach(function(e){
                        var doc = JSON.parse(e.doc);
                        objBarcodeCode[ doc["Component Item"] ] = e.doc['Barcode Code'];
                    });
                    objLots = {}
                    objKeyLots = {}
                    objStocks.forEach(function(e) {
                        doc = JSON.parse(e.doc);
                        if (!(doc['Item Number'] in objLots))
                            objLots[doc['Item Number']] = [];
                        objLots[doc['Item Number']].push(doc);
                        objKeyLots[doc['Item Number'] + '#' + doc['Lot/Serial'] + "#" + doc['Reference']] = doc;
                    });
                    recipe = {}
                    idsRecipe = {}
                    objMaterials.forEach(function(mat) {
                        var doc = JSON.parse(mat.doc);
                        recipe[doc['Component Item']] = doc;
                        idsRecipe[doc['Component Item']] = mat;
                    });
                    gTarget = recipe[item["Component Item"]]['Qty Required'] * 1;
                    localForage.getItem('onState').then(function(oState) {
                        oState = JSON.parse(oState);
                        localForage.getItem(item['ID'] + '-' + item["Component Item"]).then(function(datas) {
                            //console.log(datas, 'datas', datas.length);
                            if (datas !== '[]' && datas != null) {
                                var doc = JSON.parse(datas);
                                doc.forEach(function(e) {
                                    objLots[item["Component Item"]] = objLots[item["Component Item"]].map(function(l) {
                                        if (e['Lot/Serial'] == l['Lot/Serial'] && e['Reference'] == l['Reference'])
                                            l['Quantity On Hand'] = (l['Quantity On Hand'] * 1) - e.netto;
                                        return l;
                                    });
                                });
                                datas = JSON.parse(datas);
                                weighData['tara'] = datas[datas.length - 1].tara * 1;
                                weighData['taraTime'] = datas[datas.length - 1]['taraTime'];
                                console.log(datas, datas.length - 1, weighData);
                                datas = JSON.stringify(datas);
                                var head = [
                                    'Component Item',
                                    'tara',
                                    'netto',
                                    'nettoTime'
                                ];
                                var totalizer = 0;
                                var data = doc.map(function(e) {
                                    return head.map(function(e2) {
                                        if (e2 == 'netto') {
                                            totalizer += e[e2] * 1;
                                        }
                                        return e[e2];
                                    });
                                });
                                gTarget -= totalizer;
                                gTarget = gTarget.toFixed(8) * 1
                                var toleransi = item['Tolerance'] * 1;
                                if (gTarget.toFixed(12) * 1 == 0 || (gTarget - toleransi < 0)) {
                                    $('#save').removeAttr('disabled');
                                    console.log('Nyasaa');
                                }
                                document.title = 'Target Kurang: ' + (gTarget.toFixed(6)) + 'Kg';
                                $('#kurang').text(gTarget.toFixed(6));
                                $('#jumlah').text(totalizer.toFixed(6));
                                createTable({
                                    'head': head,
                                    'data': data
                                }, true);
                            }
                            if (!(oState.key in objKeyLots)) objKeyLots[oState.key] = {
                                'Quantity On Hand': 0
                            };
                            console.log(objKeyLots[oState.key]['Quantity On Hand']);
                            if (oState.state == "Weighing" && datas !== '[]' && datas != null && (objKeyLots[oState.key]['Quantity On Hand'] * 1).toFixed(9) * 1 > 0) {
                                datas = JSON.parse(datas);
                                $('#scale').text(item['Scale']);
                                ee.emit('kg');
                                ready = true;
                                $('#matcode').text(item['Component Item']);
                                $('#matname').text(recipe[item['Component Item']]['Component Item Description']);
                                $('#lotnumber').text(oState.key.split('#')[1]);
                                $('#referenceid').text(oState.key.split('#')[2]);
                                $('#target').text(recipe[item['Component Item']]['Qty Required']);
                                $('#item').text(item['Component Item']);
                                $('#lot').text(oState.key.split('#')[1] + "#" + oState.key.split('#')[2]);
                                $('#reference').text((objKeyLots[oState.key]['Quantity On Hand'] * 1).toFixed(9) * 1);

                            } else if (oState.state == "Weighing") {
                                promptVal2(function() {
                                    var lotmat = this.$content.find('#promptmatlot').val();
                                    var refer = this.$content.find('#promptref').val();
                                    var val = lotmat + "#" + refer;
                                    if (val.indexOf('#') > -1) {
                                        var arrval = val.split('#');
                                        var matCode = arrval[0];
                                        var lotCode = arrval[1];
                                        var refCode = arrval[2];
                                        if (matCode == item['Component Item']) {
                                            $('#item').text(item['Component Item']);
                                            if (val in objKeyLots) {
                                                if ((objKeyLots[val]['Quantity On Hand'] * 1) > 0) {
                                                    $('#target').text(recipe[item['Component Item']]['Qty Required']);
                                                    var objState = {
                                                        'state': 'Weighing',
                                                        'key': val,
                                                        'stock': objKeyLots[val]['Quantity On Hand'] * 1
                                                    };
                                                    $('#lot').text(lotCode + "#" + refCode);
                                                    $('#reference').text(objState.stock.toFixed(9) * 1);
                                                    localForage.setItem('onState', JSON.stringify(objState)).then(function() {
                                                        ready = true;
                                                        $('#scale').text(item['Scale']);
                                                        $('#matcode').text(item['Component Item']);
                                                        $('#matname').text(recipe[item['Component Item']]['Component Item Description']);
                                                        $('#lotnumber').text(lotCode);
                                                        $('#referenceid').text(refCode);
                                                        ee.emit('kg');
                                                    });
                                                } else {
                                                    $.alert('Stock is empty');
                                                }
                                            } else {
                                                $.alert('Lot is not found!');
                                                return false;
                                            }
                                        } else {
                                            $.alert('Item is not valid!');
                                            return false;
                                        }
                                    } else {
                                        $.alert('Value not valid!');
                                        return false;
                                    }
                                }, function() {}, function() {}, {
                                    'Qty Required': recipe[item["Component Item"]]['Qty Required'],
                                    'Component Item': item["Component Item"],
                                    'Description': recipe[item["Component Item"]]['Component Item Description'] || '',
                                    'UM': recipe[item["Component Item"]]['UM'] || '',
                                    'seq': item.Sequence,
                                    'data': objLots[item["Component Item"]]
                                });
                            } else if (oState.state == "Sisa") {
                                datas = JSON.parse(datas);
                                $('#scale').text(item['Scale']);
                                $('#item').text(item['Component Item']);
                                $('#matcode').text(item['Component Item']);
                                $('#matname').text(recipe[item['Component Item']]['Component Item Description']);
                                $('#lotnumber').text(oState.key.split('#')[1]);
                                $('#referenceid').text(oState.key.split('#')[2]);
                                weighData['tara'] = datas[datas.length - 1].tara * 1;
                                weighData['taraTime'] = datas[datas.length - 1]['taraTime'];
                                weighProcess = 'sisa';
                                console.log(datas[datas.length - 1]);
                                $('#zerosisa').removeClass('hide');
                                $('#save').attr('disabled', 'disabled');
                                $('#zerosisa').removeAttr('disabled');
                                ready = true;
                                ee.emit('kg');
                            }
                        });
                    });
                });
            });
        });

        var main = function() {
            $('#command').text(weighProcess.toUpperCase());
            switch (weighProcess) {
                case 'zero':
                    break;
                case 'tara':
                    break;
                case 'weight':
                    break;
            };
        };
        ee.on('kg', main);

        var onScale = function(status, obj, stable) {
            switch (weighProcess) {
                case 'zero':
                    if ((obj.data * 1) == 0 && obj.statusT == 'G') {
                        weighData['zeroTime'] = new Date().toISOString();
                        taraFirst = !$('#taraoption').is(':checked');
                        if (taraFirst && 'tara' in weighData)
                            weighProcess = 'weight';
                        else {
                            weighProcess = 'tara';
                            taraFirst = false;
                        }
                        ee.emit('kg');
                    }
                    break;
                case 'tara':
                    if ((obj.data * 1) > 0 && stable) {
                        weighData['taraTime'] = new Date().toISOString();
                        weighData['tara'] = $('#count').text() * 1;
                    } else if ((obj.data * 1) == 0 && stable && 'tara' in weighData && !taraFirst && obj.statusT == 'N') {
                        weighProcess = 'weight';
                        ee.emit('kg');
                    }
                    break;
                case 'weight':
                    if ((obj.data * 1) > 0 && (obj.stable * 1)) {
                        $('#get').removeAttr('disabled');
                    } else if ((obj.data * 1) > 0 && !(obj.stable * 1)) {
                        $('#get').attr('disabled', 'disabled');
                    }
                    if ((obj.data * 1) > 0 && (obj.stable * 1) && obj.statusT == "G") {
                        //if ('weight' in weighData) {
                        weighData['grossTime'] = new Date().toISOString();
                        weighData['gross'] = $('#count').text() * 1;
                        //}
                    } else if (stable * 1 && 'gross' in weighData && obj.statusT == "N") {
                        var value = $('#count').text() * 1;
                        localForage.getItem('onState').then(function(obj) {
                            var doc = JSON.parse(obj);
                            toleransi = item['Tolerance'] * 1;
                            console.log(gTarget, (gTarget + toleransi) >= value, (gTarget - toleransi) >= value, doc);
                            if ((gTarget + toleransi) >= value || (gTarget - toleransi) >= value) {
                                if ((doc.stock + toleransi) >= value || (doc.stock - toleransi) >= value) {
                                    $('#get').attr('disabled', 'disabled');
                                    weighData['nettoTime'] = new Date().toISOString();
                                    weighData['netto'] = $('#count').text() * 1;
                                    weighProcess = 'get';
                                    $('#get').attr('disabled', 'disabled');
                                    ee.emit('kg');
                                } else {
                                    delete weighData['gross'];
                                    if ($('.jconfirm-box').length == 0)
                                        $.alert('Berat lebih dari Stock!');
                                }
                            } else {
                                delete weighData['gross'];
                                if ($('.jconfirm-box').length == 0)
                                    $.alert('Berat target berlebih!');
                            }
                        });
                    }
                    break;
                case 'get':
                    if ((obj.data * 1) < 0 && obj.statusT == "N") {
                        localForage.getItem('onState').then(function(st) {
                            state = JSON.parse(st);
                            state.stock = (state.stock * 1) - weighData.netto;
                            localForage.setItem('onState', JSON.stringify(state)).then(function() {});
                            var objSave = weighData;
                            objSave['ID'] = item.ID;
                            objSave['Component Item'] = item["Component Item"];
                            objSave['Lot/Serial'] = state.key.split('#')[1];
                            objSave['Reference'] = state.key.split('#')[2];
                            objSave['Scale'] = item["Scale"];
                            objSave['Location'] = objKeyLots[state.key]['Location'];
                            objSave['Operation'] = recipe[item["Component Item"]]['Operation'];
                            objSave['Site'] = objKeyLots[state.key]['Site'];
                            localforage.getItem(item.ID + '-' + item["Component Item"]).then(function(e) {
                                var arrSave = [];
                                if (e) {
                                    arrSave = JSON.parse(e);
                                }
                                objSave['number'] = arrSave.length;
                                localForage.getItem('operators').then(function(optr) {
                                    optr = JSON.parse(optr);
                                    objSave['number'] = arrSave.length;
                                    objSave['operator1'] = optr.operator1;
                                    objSave['operator2'] = optr.operator2;
                                    arrSave.push(objSave);
                                    localForage.setItem(item.ID + '-' + item["Component Item"], JSON.stringify(arrSave)).then(function() {
                                        var head = [
                                            'Component Item',
                                            'tara',
                                            'netto',
                                            'nettoTime'
                                        ];
                                        var totalizer = 0;
                                        var data = arrSave.map(function(e) {
                                            return head.map(function(e2) {
                                                if (e2 == 'netto') {
                                                    totalizer += e[e2] * 1;
                                                }
                                                return e[e2];
                                            });
                                        });
                                        createTable({
                                            'head': head,
                                            'data': data
                                        }, true);
                                        console.log('PRINT');
                                        weighProcess = "zero";
                                        var recipes = recipe[item["Component Item"]];
                                        var materialName = recipes['Component Item Description'].split(' ').length >= 2 ? recipes['Component Item Description'].split(' ')[0] + " " + recipes['Component Item Description'].split(' ')[1] : recipes['Component Item Description'].split('')[0];
                                        console.log(materialName);

                                        var operators = optr.operator1 + "#" + optr.operator2;
                                        console.log(operators);
                                        print({
                                            'matName': materialName,
                                            'dte': new Date(objSave['nettoTime']).getTime() + 7 * 3600 * 1000,
                                            //'code': item["Component Item"],
                                            'code': objBarcodeCode[item["Component Item"]],
                                            'lot': objSave['Lot/Serial'].substr(-9),
                                            'netto': objSave.netto * 1,
                                            'number': ((arrSave.length * 1).toString()).padStart(3, "0"),
                                            'operator1': optr.operator1,
                                            'operator2': optr.operator2
                                        }, function() {
                                            window.location.reload();
                                        });
                                    });
                                });
                            });
                        });
                    }
                    break;
                case 'sisa':
                    if ((obj.data * 1) == 0 && obj.statusT == 'G') {
                        weighSisa['zeroTime'] = new Date().toISOString();
                        taraFirst = !$('#taraoption').is(':checked');
                        if (taraFirst) {
                            weighSisa['tara'] = weighData['tara'] * 1;
                        }
                        if (taraFirst && 'tara' in weighSisa)
                            weighProcess = 'weight sisa';
                        else {
                            weighProcess = 'tara sisa';
                            taraFirst = false;
                        }
                        ee.emit('kg');
                    }
                    break;
                case 'tara sisa':
                    if ((obj.data * 1) > 0 && stable) {
                        weighSisa['taraTime'] = new Date().toISOString();
                        weighSisa['tara'] = $('#count').text() * 1;
                    } else if ((obj.data * 1) == 0 && stable && 'tara' in weighSisa && !taraFirst && obj.statusT == 'N') {
                        weighProcess = 'weight sisa';
                        ee.emit('kg');
                    }
                    break;
                case 'weight sisa':
                    if ((obj.data * 1) > 0 && (obj.stable * 1)) {
                        $('#get').removeAttr('disabled');
                    } else if ((obj.data * 1) > 0 && !(obj.stable * 1)) {
                        $('#get').attr('disabled', 'disabled');
                    }
                    if ((obj.data * 1) > 0 && (obj.stable * 1) && obj.statusT == "G") {
                        weighSisa['grossTime'] = new Date().toISOString();
                        weighSisa['gross'] = $('#count').text() * 1;
                    } else if (stable * 1 && 'gross' in weighSisa && obj.statusT == "N") {
                        weighSisa['nettoTime'] = new Date().toISOString();
                        weighSisa['netto'] = $('#count').text() * 1;
                        weighProcess = "get sisa";
                        ee.emit('kg');
                    }
                    break;
                case 'get sisa':
                    if ((obj.data * 1) <= 0) {
                        ee.emit('sisa');
                    }
                    break;

            }
        }
        ee.on('sisa', function() {
            var id = Uuidv1();
            var obj = weighSisa;
            obj['Component Item'] = item["Component Item"];
            obj['ID'] = item["ID"];
            obj['Type'] = 'sisa';
            var recipes = recipe[item["Component Item"]];
            console.log(obj, 'sisa');
            localForage.getItem('onState').then(function(st) {
                var state = JSON.parse(st);
                var lot = (state.key.split('#')[1]).substr(-9);
                var materialName = recipes['Component Item Description'].split(' ').length >= 2 ? recipes['Component Item Description'].split(' ')[0] + " " + recipes['Component Item Description'].split(' ')[1] : recipes['Component Item Description'].split('')[0];
                localForage.getItem('operators').then(function(optr) {
                    optr = JSON.parse(optr);
                    var operators = optr.operator1 + "#" + optr.operator2;
                    console.log(operators);
                    print({
                        'matName': materialName,
                        'dte': new Date().getTime() + 7 * 3600 * 1000,
                        //'code': item["Component Item"],
                        'code': objBarcodeCode[item["Component Item"]],
                        'lot': $('#lotnumber').text().substr(-9),
                        'netto': obj.netto * 1,
                        'number': ("0").padStart(3, "0"),
                        'operator1': optr.operator1,
                        'operator2': optr.operator2
                    }, function() {
                        var strData = objToArrDB(obj);
                        var jqXhr = $.ajax({
                            url: 'http://localhost:8877/test',
                            type: 'GET',
                            data: {
                                sql: escape('INSERT INTO docs.sisa VALUES ("' + id + '", COLUMN_CREATE(' + strData + '));')
                            }
                        });
                        jqXhr.done(function(data) {
                            localForage.getItem('onState').then(function(state) {
                                state = JSON.parse(state);
                                state['state'] = 'Weighing';
                                $('#sisa').attr('disabled', 'disabled');
                                localForage.setItem('onState', JSON.stringify(state)).then(function() {
                                    var sequence = item.Sequence * 1;
                                    sequence += 1;
                                    console.log(item.Sequence, sequence, item, Object.keys(Formula));
                                    if (Object.keys(Formula).indexOf(sequence.toString()) > -1) {
                                        localForage.setItem('onSequence', sequence).then(function() {
                                            location.reload();
                                        });
                                    } else {
                                        localForage.getItem('onState').then(function(state) {
                                            state = JSON.parse(state);
                                            state['state'] = 'Finished';
                                            localForage.setItem('onState', JSON.stringify(state)).then(function() {
                                                putMR('orders', arrOrders[0].id, {
                                                    'Status': 'Weighted'
                                                }, function() {
                                                    $.alert('Done');
                                                    window.location = "/orders";
                                                });
                                            });
                                        });
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
        $('#content').delegate('#zerosisa', 'click', function() {
            weighSisa['nettoTime'] = new Date().toISOString();
            weighSisa['netto'] = 0;
            ee.emit('sisa');
        });
        $('#content').delegate('#get', 'click', function() {
            if (weighProcess.indexOf('sisa') > -1) {
                weighSisa['nettoTime'] = new Date().toISOString();
                weighSisa['netto'] = $('#count').text() * 1;
                weighProcess = "get sisa";
                ee.emit('kg');
            } else {
                var value = $('#count').text() * 1;
                localForage.getItem('onState').then(function(obj) {
                    var doc = JSON.parse(obj);
                    toleransi = item['Tolerance'] * 1;
                    console.log(gTarget, (gTarget + toleransi) >= value, (gTarget - toleransi) >= value);
                    if ((gTarget + toleransi) >= value || (gTarget - toleransi) >= value) {
                        if ((doc.stock + toleransi) >= value || (doc.stock - toleransi) >= value) {
                            $('#get').attr('disabled', 'disabled');
                            weighData['nettoTime'] = new Date().toISOString();
                            weighData['netto'] = $('#count').text() * 1;
                            weighProcess = 'get';
                            $('#get').attr('disabled', 'disabled');
                            ee.emit('kg');
                        } else {
                            $.alert('Berat lebih dari Stock!');
                        }
                    } else {
                        $.alert('Berat target berlebih!');
                    }
                });
            }
        });
        $('#content').delegate('#save', 'click', async function() {
            var res = confirm('Anda Yakin?');
            if (res) {
                var obj = await localForage.getItem(item.ID + '-' + item["Component Item"]);
                obj = JSON.parse(obj);
                obj.forEach(function(e) {
                    var id = Uuidv1();
                    var strData = objToArrDB(e);
                    var jqXhr = $.ajax({
                        url: 'http://localhost:8877/test',
                        type: 'GET',
                        data: {
                            sql: escape('INSERT INTO docs.weights VALUES ("' + id + '", COLUMN_CREATE(' + strData + '));')
                        }
                    });
                    jqXhr.done(function(data) {
                        var val = $('#matcode').text() + "#" + $('#lotnumber').text() + "#" + $('#referenceid').text();
                        console.log(val);
                        localForage.setItem('onState', JSON.stringify({
                            'state': 'Sisa',
                            'key': val,
                            'stock': objKeyLots[val]['Quantity On Hand'] * 1
                        })).then(function() {
                            console.log('ok', idsRecipe[item["Component Item"]]);
                            putMR('materials', idsRecipe[item["Component Item"]].id, {
                                'Status': 'Weighted'
                            }, function() {
                                $.alert('Done');
                                window.location.reload();
                            });
                        });
                    });
                });
            }
        });
        $('#content').delegate('a.btn.delete', 'click', function() {
            var el = this.parentNode.parentNode;
            var time = $(el).find('td:nth-child(5)');
            time = $(time[0]).text();
            var res = confirm('Anda yakin delete penimbangan?');
            if (res) {
                localforage.getItem(item.ID + '-' + item["Component Item"]).then(function(de) {
                    de = JSON.parse(de);
                    var deleted = de.filter(function(e) {
                        return time != e.nettoTime;
                    });
                    localforage.setItem(item.ID + '-' + item["Component Item"], JSON.stringify(deleted)).then(function() {
                        window.location.reload();
                    });
                });
            }
        });
        $('#content').delegate('a.btn.print', 'click', function() {
            var el = this.parentNode.parentNode;
            var time = $(el).find('td:nth-child(5)');
            time = $(time[0]).text();
            var res = confirm('Anda yakin print?');
            if (res) {
                localforage.getItem(item.ID + '-' + item["Component Item"]).then(function(de) {
                    de = JSON.parse(de);
                    var printed = de.filter(function(e) {
                        return time == e.nettoTime;
                    });
                    console.log(printed[0]);
                    print({
                        'matName': printed[0]['Component Item'],
                        'dte': new Date( printed[0]['nettoTime'] ).getTime() + 7 * 3600 * 1000,
                        //'code': printed[0]['Component Item'],
                        'code': objBarcodeCode[printed[0]['Component Item']],
                        'lot': printed[0]['Lot/Serial'].substr(-9),
                        'netto': printed[0]['netto'],
                        'number': ( printed[0]['number'].toString() ).padStart(3, "0"),
                        'operator1': printed[0]['operator1'],
                        'operator2': printed[0]['operator2']
                    }, function() {

                    });
                });
            }
        });
    });
});

function debug(e) {
    //console.log(e);
}

function onStable(e) {
    switch (state) {
        case 'idle':
            if ($('.jconfirm').length == 0) {
                $.confirm({
                    title: 'Confirm!',
                    content: 'Tara box',
                    buttons: {
                        confirm: function() {
                            gTara = $('.count').text() * 1;
                            /*
                            var msg = new Paho.MQTT.Message(JSON.stringify({
                                'command': 'tara'
                            }));
                            msg.destinationName = 'command' + item.Scale;
                            client.send(msg);
                            */
                            state = 'material';
                        }
                    }
                });
            }
            break;
        case 'material':
            if ($('.jconfirm').length == 0) {
                $.confirm({
                    title: 'Confirm!',
                    content: 'material',
                    buttons: {
                        confirm: function() {
                            console.log('confirmed');
                            Confrimed();
                        },
                        cancel: function() {
                            $.alert('Canceled!');
                            location.reload();
                        }
                    }
                });
            }
            break;
    }
}

function Confrimed() {
    console.log('ok');
    var today = new Date();
    today.setHours(today.getHours() + 7);
    var objData = {
        'name': qs.code,
        'order': qs.order,
        'tara': gTara,
        'netto': $('.count').text() * 1,
        'weigh_at': today.toISOString()
    };
    console.log(gTarget, 't');
    if (objData.netto <= gTarget) {
        localforage.getItem(qs.order + '-' + qs.code).then(function(e) {
            arr = [];
            if (e) {
                arr = JSON.parse(e);
            }
            arr.push(objData);
            localforage.setItem(qs.order + '-' + qs.code, JSON.stringify(arr)).then(function() {
                window.location.reload();
            });
        });
    } else {
        $.alert('Material terlalu berat melebihi target!');
        state = 'tara';
    }
}

var parseQueryString = function(queryString) {
    var params = {},
        queries, temp, i, l;
    queries = queryString.split("&");
    for (i = 0, l = queries.length; i < l; i++) {
        temp = queries[i].split('=');
        params[temp[0]] = temp[1];
    }
    return params;
};

var cash = (function(sig, sec) {
    var options = {
        useEasing: true,
        useGrouping: true,
        separator: ',',
        decimal: '.',
        prefix: '',
        suffix: ''
    };
    return function(e, to) {
        var from = $('#' + e).text() * 1;
        if (isNaN(from))
            from = 0;
        new countUp(e, from, to, sig, sec, options).start();
    };
})(2, 1);

function objToArrDB(obj) {
    var arr = [];
    Object.keys(obj).forEach(function(e) {
        arr.push(e);
        arr.push(obj[e]);
    });
    return '"' + arr.join('","') + '"';
}

function createTable(obj, delAble) {
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
            if (i2 == 1 && false)
                str += '<a href="">' + e2 + '</a>';
            else
                str += e2;
            str += '</td>';
        });
        // if(options !== null && typeof options === 'object'){
        //     Object.keys(options).forEach(function(e){
        //         str += '<td><a href="javascript:;" class="btn default btn-xs blue '+ e +'"><i class="fa fa-share"></i> ' + e + ' </a></td>';
        //     });   
        // }
        if (delAble) {
            //str += '<td><a href="javascript:;" class="btn default btn-xs blue delete"><i class="fa fa-share"></i> Delete </a></td>';
            str += '<td><a href="javascript:;" class="btn default btn-xs blue print"><i class="fa fa-share"></i> Print </a></td>';
        }
        str += '</tr>';
    });
    str += '</tbody>';
    $('#datatable').html(str);
}

function putMR(table, tid, newObj, cb) {
    var jqXhr = $.ajax({
        url: 'http://localhost:8877/test',
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
                url: 'http://localhost:8877/test',
                type: 'GET',
                data: {
                    sql: escape('DELETE FROM docs.' + table + ' WHERE id ="' + id + '"')
                }
            });
            jqXhr2.done(function(data) {
                var jqXhr3 = $.ajax({
                    url: 'http://localhost:8877/test',
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
};

var command = function(e) {
    console.log(e);
}

function Finalize() {
    var today = new Date();
    today.setHours(today.getHours() + 7);
    var objData = {
        'name': qs.code,
        'order': qs.order,
        'tara': 1,
        'netto': gTarget,
        'weigh_at': today.toISOString()
    };
    console.log(gTarget, 't');
    if (objData.netto <= gTarget) {
        localforage.getItem(qs.order + '-' + qs.code).then(function(e) {
            arr = [];
            if (e) {
                arr = JSON.parse(e);
            }
            arr.push(objData);
            localforage.setItem(qs.order + '-' + qs.code, JSON.stringify(arr)).then(function() {
                window.location.reload();
            });
        });
    } else {
        $.alert('Material terlalu berat melebihi target!');
        state = 'tara';
    }
}

var promptVal2 = function(action, cancel, ready, option) {
    console.log(option.data);
    var head = [
        'Item Number',
        'Location',
        'Lot/Serial',
        'Reference',
        'Quantity On Hand',
        'Expire Date'
    ];
    var str = '<thead><tr>';
    ["#"].concat(head).forEach(function(e) {
        str += '<th>';
        str += e;
        str += '</th>';
    });
    str += '</tr></thead>';
    str += '<tbody>';
    option.data.forEach(function(e, i) {
        str += '<tr>';
        str += '<td>';
        str += (i + 1);
        str += '</td>';
        head.forEach(function(e2) {
            str += '<td>';
            if (e2 == 'Expire Date') str += e[e2].substr(0, 10);
            else if (e2 == 'Quantity On Hand') str += (e[e2] * 1).toFixed(9) * 1;
            else str += e[e2];
            str += '</td>';
            if (!e[e2]) console.log(e2);
        });
        str += '</tr>';
    });
    str += '</tbody>';

    $.confirm({
        title: 'Prompt!',
        content: '' +
            '<form action="" class="formName">' +
            '<label>Sequence : </label>' + option.seq +
            '<br><label>Component Item : </label>' + option['Component Item'] +
            '<br><label>Description : </label>' + option['Description'] +
            '<br><label>Qty Required : </label>' + option['Qty Required'] + " " + option['UM'] +
            '<div class="form-group">' +
            '<label>Scan or Enter Barcode</label>' +
            '<input type="text" id="promptmatlot" placeholder="Material#Lot/Serial" class="name form-control" required />' +
            '<label>Location</label>' +
            '<input type="text" placeholder="2131" class="name form-control" value="2131" disabled="disabled" required />' +
            '<label>Reference</label>' +
            '<input type="text" id="promptref" placeholder="Reference" class="name form-control" required />' +
            '</div>' +
            '<br><div class="table"><table class="table table-striped jambo_table bulk_action">' + str +
            '</table></div>' +
            '</form>',
        buttons: {
            formSubmit: {
                text: 'Submit',
                btnClass: 'btn-blue',
                action: action
            }
        },
        onContentReady: function() {
            // bind to events
            var jc = this;
            this.$content.find('.name').trigger('focus');
            this.$content.find('form').on('submit', function(e) {
                // if the user submits the form by pressing enter in the field.
                e.preventDefault();
                jc.$$formSubmit.trigger('click'); // reference the button and click it
            });
            $('.jconfirm-box-container').removeClass('col-md-4');
            $('.jconfirm-box-container').removeClass('col-md-offset-4');
            $('.jconfirm-box-container').addClass('col-md-8');
            $('.jconfirm-box-container').addClass('col-md-offset-2');
        }
    });
}

var promptVal = function(action, cancel, ready) {
    $.confirm({
        title: 'Prompt!',
        content: '' +
            '<form action="" class="formName">' +
            '<div class="form-group">' +
            '<label>Scan or Enter Barcode</label>' +
            '<input type="text" placeholder="Material#Lot" class="name form-control" required />' +
            '</div>' +
            '</form>',
        buttons: {
            formSubmit: {
                text: 'Submit',
                btnClass: 'btn-blue',
                action: action
            },
            cancel: cancel
        },
        onContentReady: function() {
            // bind to events
            var jc = this;
            this.$content.find('.name').trigger('focus');
            this.$content.find('form').on('submit', function(e) {
                // if the user submits the form by pressing enter in the field.
                e.preventDefault();
                jc.$$formSubmit.trigger('click'); // reference the button and click it
            });
        }
    });
}


var print = function(option, cb) {
    var url = 'http://localhost:8080/test?material=' + option.matName + '&date=' + option.dte + '&code=' + option.code + '&lot=' + option.lot + '&qty=' + option.netto + '&nomor=' + ((option.number).toString()).padStart(3, "0") + '&operator1=' + option.operator1 + '&operator2=' + option.operator2;
    console.log(url);
    var jqXhr = $.ajax({
        url: url,
        type: 'GET'
    });
    jqXhr.done(function(data) {
        cb(data);
    });
}

function getCook(cookiename) {
    var cookiestring = RegExp("" + cookiename + "[^;]+").exec(document.cookie);
    return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./, "") : "");
}
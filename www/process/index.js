document.addEventListener("DOMContentLoaded", async function(event) {
    var DEBUGGING = true;
    var TOLERANCE = 0;
    var HOSTPORT_DB = "localhost:8877";
    var HOSTPORT_FS = "localhost:4001";
    var HOSTPORT_IO = "localhost:6666";
    var LOCATION = "2131";
    requirejs([
        "/cdn/js/localforage.js",
        "/cdn/js/mqttws31.js",
        "/cdn/js/lea.js",
        "/cdn/js/uuidv1.js"
    ], function(localForage, mqtt, Lea, Uuidv1) {
        localforage = localForage;
        l = new lea();
        var qs = l.querystring(window.location.search.substring(1));
        socket = io('http://' + HOSTPORT_FS);

        fsm = new StateMachine({
            init: 'idle',
            transitions: [
                { name: 'IdleToCalibrate', from: 'idle', to: 'calibrate' },
                { name: 'IdleToZero', from: 'idle', to: 'zero' },
                { name: 'CalibrateToZero', from: 'calibrate', to: 'zero' },
                { name: 'ZeroToTara', from: 'zero', to: 'tara' },
                { name: 'TaraToWeight', from: 'tara', to: 'weight' },
                { name: 'IdleToWeight', from: 'idle', to: 'weight' },
                { name: 'ZeroToWeight', from: 'zero', to: 'weight' },
                { name: 'WeightToZero', from: 'weight', to: 'zero' },
                { name: 'WeightToGet', from: 'weight', to: 'get' }
            ],
            methods: {
                onTransition: function(lifecycle, arg1, arg2) {
                    var destinationState = lifecycle.to.toUpperCase();
                    $('#command').text(destinationState);
                },
                onInvalidTransition: function(transition, from, to) {
                    console.error(transition, from, to);
                }
            }
        });
        BrowserReady(async function() {
            var xml = await $.ajax("http://" + HOSTPORT_FS + "/local/index.xml");
            $('#content').html(xml);

            var objOnState = await localForage.getItem('onState').then(JSON.parse);
            var objOnFormula = await localForage.getItem('onFormula').then(JSON.parse);
            var objOnSequence = await localForage.getItem('onSequence').then(JSON.parse);
            var objOperators = await localForage.getItem('operators').then(JSON.parse);
            item = objOnFormula[objOnSequence];
            var objWeightedData = await localforage.getItem(item['ID'] + "-" + item['Component Item']).then(JSON.parse);
            var stocked = funRemainStock({ data: objWeightedData });

            var sql1 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materials WHERE COLUMN_GET(doc, "ID" as char) = "' + item['ID'] + '" AND COLUMN_GET(doc, "Component Item" as char) = "' + item['Component Item'] + '"';
            var sql2 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.stocks WHERE COLUMN_GET(doc, "Item Number" as char) IS NOT NULL AND COLUMN_GET(doc, "Location" as char) = "' + LOCATION + '"';
            var sql3 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materialscode';
            var objMaterials = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sql1)).then(l.parsing);
            var objStocks = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sql2)).then(l.parsing);
            var objMaterialsCode = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sql3)).then(l.parsing);
            var calculatedData = funCalculateWeighingData({ required: objMaterials, weighted: stocked });
            var objMaterialsData = objMaterials[0].doc;
            var objKeyLots = funGetStock({ query: objStocks, weighted: objWeightedData });

            if ((!(calculatedData.remain[item['Component Item']]) || objKeyLots.remain[objOnState.key] == 0) && objOnState.state == "Weighing") {
                l.promptXml({
                    xml: xmlPrompted()
                }, {
                    ready: function() {
                        $('.jconfirm-box-container').removeClass('col-md-4');
                        $('.jconfirm-box-container').removeClass('col-md-offset-4');
                        $('.jconfirm-box-container').addClass('col-md-8');
                        $('.jconfirm-box-container').addClass('col-md-offset-2');
                        $('#promptmatlot').focus();
                        $('#sequence').text(item['Sequence']);
                        $('#componentItem').text(item['Component Item']);
                        $('#description').text(objMaterialsData['Component Item Description']);
                        $('#qtyRequired').text(objMaterialsData['Qty Required']);
                        l.createDatatable("#promptTable", {
                            head: [{
                                name: 'Item Number',
                                title: 'Component Item'
                            }, {
                                name: 'Lot/Serial',
                                title: 'Lot / Serial'
                            }, {
                                name: 'Reference',
                                title: 'Reference'
                            }, {
                                name: 'netto',
                                title: 'Netto'
                            }],
                            data: objKeyLots['data'][item['Component Item']]
                        });
                    },
                    action: async function() {
                        var lotmaterial = this.$content.find('#promptmatlot').val();
                        var reference = this.$content.find('#promptref').val();
                        var key = lotmaterial + "#" + reference;
                        if (key.indexOf('#') > -1) {
                            var arrayval = key.split('#');
                            var matCode = arrayval[0];
                            var lotCode = arrayval[1];
                            var refCode = arrayval[2];
                            if (matCode == item['Component Item']) {
                                if (key in objKeyLots.quantity) {
                                    if ((objKeyLots.remain[key] * 1) > 0) {
                                        var objState = {
                                            'state': 'Weighing',
                                            'key': key,
                                            'stock': objKeyLots.quantity[key] * 1
                                        };
                                        await localForage.setItem('onState', JSON.stringify(objState));
                                        $('#materialName').text(objMaterialsData['Component Item Description']);
                                        $('#materialCode').text(key.split("#")[0]);
                                        $('#lotnumber').text(key.split("#")[1]);
                                        $('#referenceid').text(key.split("#")[2]);
                                        $('#scale').text(item['Scale']);
                                    } else {
                                        alert('Stock is empty');
                                        window.location.reload();
                                    }
                                } else {
                                    alert('Lot is not found!');
                                    window.location.reload();
                                }
                            } else {
                                alert('Item is not valid!');
                                window.location.reload();
                            }
                        } else {
                            alert('Value not valid!');
                            window.location.reload();
                        }
                    },
                    cancel: function() {
                        return false;
                    }
                });
            } else {
                $('#materialName').text(objMaterialsData['Component Item Description']);
                $('#materialCode').text(objOnState.key.split("#")[0]);
                $('#lotnumber').text(objOnState.key.split("#")[1]);
                $('#referenceid').text(objOnState.key.split("#")[2]);
                $('#scale').text(item['Scale'] + "  -Stock left- " + objKeyLots.remain[objOnState.key] + " " + objMaterialsData['UM']);
            }

            if (objMaterials.length > 0 && objStocks.length > 0 && objMaterialsCode.length > 0) {
                weighData = {};
                var taraFirst = !$('#taraoption').is(':checked');
                if (taraFirst) fsm.idletoweight();
                else fsm.idletozero();

                $('#taraoption').on('change', function() {
                    if (!$('#taraoption').is(':checked') && fsm.state == 'zero' && objWeightedData.length > 0) {
                        weighData['zeroTime'] = objWeightedData[objWeightedData.length - 1]['zeroTime'];
                        weighData['taraTime'] = objWeightedData[objWeightedData.length - 1]['taraTime'];
                        weighData['tara'] = objWeightedData[objWeightedData.length - 1]['tara'];
                        fsm.zerotoweight();
                    } else if ($('#taraoption').is(':checked') && fsm.state == 'weight') {
                        weighData = {};
                        fsm.weighttozero();
                    }
                });


                onScale = async function(status, obj, stable) {
                    switch (status) {
                        case 'zero':
                            if ((obj.value * 1) == 0 && obj.statusT == 'G') {
                                weighData['zeroTime'] = new Date().toISOString();
                                fsm.zerototara();
                            }
                            break;
                        case 'tara':
                            if ((obj.value * 1) > 0 && (obj.stable * 1)) {
                                weighData['taraTime'] = new Date().toISOString();
                                weighData['tara'] = $('#count').text() * 1;
                            } else if ((obj.value * 1) == 0 && 'tara' in weighData && obj.statusT == 'N') {
                                fsm.taratoweight();
                            }
                            break;
                        case 'weight':
                            if ((obj.value * 1) > 0 && (obj.stable * 1)) {
                                $('#get').removeAttr('disabled');
                            } else if ((obj.data * 1) > 0 && !(obj.stable * 1)) {
                                $('#get').attr('disabled', 'disabled');
                            }

                            if ((obj.value * 1) > objKeyLots.remain[objOnState.key] || (obj.value * 1) > calculatedData.required[item['Component Item']]) {
                                $('.scale').css('background-color', 'red');
                            } else if ((obj.value * 1) < calculatedData.required[item['Component Item']]) {
                                $('.scale').css('background-color', 'yellow');
                            } else if ((obj.value * 1) == calculatedData.required[item['Component Item']]) {
                                $('.scale').css('background-color', 'green');
                            }

                            break;
                        case 'get':
                            if ((obj.value * 1) < 0 && obj.statusT == "N") {
                                if (calculatedData.remain[item['Component Item']] == 0 && objOnState.state == "Weighing") {
                                    var newObjState = objOnState;
                                    newObjState.state = "Sisa";
                                    await localForage.setItem('onState', JSON.stringify(newObjState));
                                    setTimeout(function() { window.location.reload(); }, 200);
                                } else if (objOnState.state == "Sisa") {

                                } else {
                                    setTimeout(function() { window.location.reload(); }, 200);
                                }
                            }
                            break;
                    }
                }
                $('#save').click(async function() {
                    console.log('sape');
                    $('#save').attr('disabled', 'disabled');

                    var res = confirm('Anda Yakin?');
                    if (res) {
                        var obj = await localForage.getItem(item.ID + '-' + item["Component Item"]).then(JSON.parse);
                        var totalArray = 0;
                        obj.forEach( async function(e, index, all) {
                            totalArray++;
                            var id = Uuidv1();
                            var strData = l.obj2arr(e);
                            var sqlPost = 'INSERT INTO docs.weights VALUES ("' + id + '", COLUMN_CREATE(' + strData + '));';
                            await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sqlPost)).then();

                            if( totalArray == all.length ) {
                                l.put('materials', objMaterials[0].id, {
                                        'Status': 'Weighted2'
                                }, function() {
                                    $.alert('Done');
                                    window.location.reload();
                                });
                            }
                        });
                    }

                });

                $('#get').click(async function() {
                    $('#get').attr('disabled', 'disabled');
                    var value = $('#count').text() * 1;
                    var onState = await localForage.getItem('onState').then(JSON.parse);
                    var toleransi = 0;
                    if (objOnState.state == "Weighing" && value > 0) {
                        if (((calculatedData.required[item['Component Item']] + toleransi) >= value || (calculatedData.required[item['Component Item']] - toleransi) >= value)) {
                            if ((objKeyLots.remain[onState.key] + toleransi) >= value || (objKeyLots.remain[onState.key] - toleransi) >= value) {
                                weighData['nettoTime'] = new Date().toISOString();
                                weighData['netto'] = $('#count').text() * 1;
                                var objSave = weighData;
                                objSave['ID'] = item.ID;
                                objSave['Component Item'] = item["Component Item"];
                                objSave['Lot/Serial'] = onState.key.split('#')[1];
                                objSave['Reference'] = onState.key.split('#')[2];
                                objSave['Scale'] = item["Scale"];
                                objSave['Location'] = LOCATION;
                                objSave['Operation'] = objMaterialsData['Operation'];
                                objSave['Site'] = objMaterialsData['Site'];
                                objSave['operator1'] = objOperators.operator1;
                                objSave['operator2'] = objOperators.operator2;
                                var arrSave = [];
                                if (objWeightedData) arrSave = objWeightedData;
                                objSave['number'] = arrSave.length + 1;
                                arrSave.push(objSave);
                                await localForage.setItem(item['ID'] + '-' + item["Component Item"], JSON.stringify(arrSave));

                                calculatedData = funCalculateWeighingData({ required: objMaterials, weighted: funRemainStock({ data: arrSave }) });
                                $('#jumlah').text(calculatedData['weighted'][item['Component Item']]);
                                $('#kurang').text(calculatedData['remain'][item['Component Item']]);

                                l.updateDatatable("#datatable", {
                                    head: [{
                                        name: 'Component Item',
                                        title: 'Component Item'
                                    }, {
                                        name: 'Lot/Serial',
                                        title: 'Lot / Serial'
                                    }, {
                                        name: 'number',
                                        title: 'Number'
                                    }, {
                                        name: 'Reference',
                                        title: 'Reference'
                                    }, {
                                        name: 'tara',
                                        title: 'Tara'
                                    }, {
                                        name: 'netto',
                                        title: 'Netto'
                                    }],
                                    data: arrSave
                                });
                                fsm.weighttoget();
                            } else {
                                $.alert('Berat lebih dari Stock!');
                            }
                        } else {
                            $.alert('Berat target berlebih!');
                        }
                    } else if (objOnState.state == "Sisa" && value > 0) {
                        weighData['nettoTime'] = new Date().toISOString();
                        weighData['netto'] = $('#count').text() * 1;
                        var objSave = weighData;
                        objSave['ID'] = item.ID;
                        objSave['Component Item'] = item["Component Item"];
                        objSave['Lot/Serial'] = onState.key.split('#')[1];
                        objSave['Reference'] = onState.key.split('#')[2];
                        objSave['Scale'] = item["Scale"];
                        objSave['Location'] = LOCATION;
                        objSave['Operation'] = objMaterialsData['Operation'];
                        objSave['Site'] = objMaterialsData['Site'];
                        objSave['operator1'] = objOperators.operator1;
                        objSave['operator2'] = objOperators.operator2;
                        await localForage.setItem(item['ID'] + '-' + item["Component Item"] + '-Sisa', JSON.stringify([objSave]));

                        $('#save').removeAttr('disabled');

                        fsm.weighttoget();
                    } else if (value <= 0) {
                        $.alert('Wrong Value');
                        $('#get').removeAttr('disabled');
                    }
                });
            } else {
                if (materials.length == 0) l.errors('00', 'materials data');
                if (stocks.length == 0) l.errors('00', 'stocks data');
                if (materialscode.length == 0) l.errors('00', 'materialscode data');
            }

            l.createDatatable("#datatable", {
                head: [{
                    name: 'Component Item',
                    title: 'Component Item'
                }, {
                    name: 'Lot/Serial',
                    title: 'Lot / Serial'
                }, {
                    name: 'number',
                    title: 'Number'
                }, {
                    name: 'Reference',
                    title: 'Reference'
                }, {
                    name: 'tara',
                    title: 'Tara'
                }, {
                    name: 'netto',
                    title: 'Netto'
                }],
                data: objWeightedData,
                buttons: [{
                    name: 'reprint',
                    title: 'Reprint',
                    xml: '<button class="btn btn-warning">Reprint <span class="glyphicon glyphicon-print">  </button>',
                    index: 6
                }]
            });


            $('#jumlah').text(calculatedData['weighted'][item['Component Item']] ? calculatedData['weighted'][item['Component Item']] : 0);
            $('#target').text(calculatedData['required'][item['Component Item']]);
            $('#kurang').text(calculatedData['remain'][item['Component Item']] ? calculatedData['remain'][item['Component Item']] : 0);

            var oldStable = 0;
            socket.on('connect', function() {
                socket.emit('idClient', 'listener');
            });
            socket.on('connect_error', function(data) { console.log(data); });
            socket.on('disconnect', function(aa) { console.log('disconnect', aa); });
            socket.on('data', function(dt) {
                $('#count').text(dt.value * 1);
                if (dt.stable == 0 && oldStable !== 0) onScale(fsm.state, dt, true);
                else onScale(fsm.state, dt, false);
                oldStable = dt.stable;
            });
        });
    });


    var BrowserReady = function(cb) {
        if (document.readyState === "complete") cb();
        else setTimeout(cb, 100);
    }

    var xmlPrompted = function(data) {
        return '<label>Sequence : </label>' + '<span id="sequence"></span>' +
            '<br><label>Component Item : </label>' + '<span id="componentItem"></span>' +
            '<br><label>Description : </label>' + '<span id="description"></span>' +
            '<br><label>Qty Required : </label>' + '<span id="qtyRequired"></span>' +
            '<br><div class="clearfix"></div>' +
            '<div class="form-group">' +
            '<label>Scan or Enter Barcode</label>' +
            '<input type="text" id="promptmatlot" placeholder="Material#Lot/Serial" class="name form-control" required />' +
            '<label>Location</label>' +
            '<input type="text" placeholder="' + LOCATION + '" class="name form-control" value="' + LOCATION + '" disabled="disabled" required />' +
            '<label>Reference</label>' +
            '<input type="text" id="promptref" placeholder="Reference" class="name form-control" required />' +
            '</div>' +
            '<table id="promptTable" class="table table-striped jambo_table bulk_action"></table>';
    }

    var funCalculateWeighingData = function(data) {
        var materials = {};
        var remain = {};
        data.required.forEach(function(row) {
            materials[row.doc['Component Item']] = row.doc['Qty Required'] * 1;
            remain[row.doc['Component Item']] = 0;
        });
        Object.keys(data.weighted).forEach(function(itemname) {
            remain[itemname] = (materials[itemname] - data.weighted[itemname]).toFixed(12) * 1;
        });
        return {
            required: materials,
            remain: remain,
            weighted: data.weighted
        };
    }

    var funRemainStock = function(object) {
        var obj = {};
        object.data = object.data ? object.data : [];
        object.data.forEach(function(row, index) {
            if (!(row['Component Item'] in obj))
                obj[row['Component Item']] = 0;
            obj[row['Component Item']] = (obj[row['Component Item']] + row['netto']).toFixed(12) * 1;
        });
        return obj;
    }

    var funGetStock = function(object) {
        var objKeyWeightedData = {};
        object.weighted = object.weighted ? object.weighted : [];
        object.weighted.forEach(function(current, index) {
            var doc = 'doc' in current ? current.doc : current;
            var key = doc['Component Item'] + '#' + doc['Lot/Serial'] + "#" + doc['Reference'];
            if (!(objKeyWeightedData[key])) objKeyWeightedData[key] = 0;
            objKeyWeightedData[key] = (objKeyWeightedData[key] + doc.netto).toFixed(12) * 1;
        });
        var objQuantity = object.query.reduce(function(acc, current, index) {
            acc[current.doc['Item Number'] + '#' + current.doc['Lot/Serial'] + "#" + current.doc['Reference']] = current.doc['Quantity On Hand'] * 1;
            return acc;
        }, {});
        console.log(objKeyWeightedData);
        var objRemain = object.query.reduce(function(acc, current, index) {
            var doc = 'doc' in current ? current.doc : current;
            var key = doc['Item Number'] + '#' + doc['Lot/Serial'] + "#" + doc['Reference'];
            var weightedValue = objKeyWeightedData[key] ? objKeyWeightedData[key] : 0;
            acc[key] = ((doc['Quantity On Hand'] * 1) - weightedValue).toFixed(12) * 1;
            return acc;
        }, {});

        var objData = {};
        object.query.forEach(function(current, index) {
            var doc = 'doc' in current ? current.doc : current;
            var key = doc['Item Number'] + '#' + doc['Lot/Serial'] + "#" + doc['Reference'];
            if (!(objData[doc['Item Number']])) objData[doc['Item Number']] = [];
            doc['netto'] = objRemain[key];
            objData[doc['Item Number']].push(doc);
        });
        return {
            data: objData,
            quantity: objQuantity,
            remain: objRemain
        };
    };

});
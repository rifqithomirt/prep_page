document.addEventListener("DOMContentLoaded", function (event) {
    var HOSTPORT_DB = "localhost:8877";
    var HOSTPORT_FS = "localhost:4005";
    var HOSTPORT_IO = "localhost:6666";
    requirejs([
        "/cdn/js/lea.js",
        "/cdn/js/uuidv1.js"
    ], function (Lea, Uuidv1) {
        l = new lea();
        var qs = l.querystring(window.location.search.substring(1));
        l.BrowserReady(async function () {
            var xml = await $.ajax("http://" + HOSTPORT_FS + "/local/index.xml");
            $('#content').html(xml);

            if ('order' in qs) {
                var sqlOrder = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.orders WHERE COLUMN_GET(doc, "Work Order" as char)="' + qs.order + '"';
                var objOrders = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sqlOrder)).then(l.parsing);
                var sqlWeight = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.weights WHERE COLUMN_GET(doc, "ID" as char) = "' + objOrders[0].doc.ID + '" ORDER BY COLUMN_GET(doc, "nettoTime" as char) ASC';
                var objWeights = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sqlWeight)).then(l.parsing);
                var sqlMaterial = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materials WHERE COLUMN_GET(doc, "ID" as char) = "' + objOrders[0].doc.ID + '"';
                var objMaterials = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sqlMaterial)).then(l.parsing);

                var objMaterialsPerCode = {};
                objWeightedsIDs = {};
                objMaterials.forEach(element => {
                    objMaterialsPerCode[element.doc['Component Item']] = element.doc;
                });

                var sqlMaterialCode = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.materialscode';
                var objMaterialCode = await $.ajax("http://" + HOSTPORT_DB + "/test?sql=" + escape(sqlMaterialCode)).then(l.parsing);
                var objMaterialsPerBarcodeCode = {};
                objMaterialCode.forEach(element => {
                    objMaterialsPerBarcodeCode[element.doc['Component Item']] = element.doc;
                });
                arrWeighteds = objWeights.map((elm, index) => {
                    var number = (((elm.doc["number"]) * 1) < 10 ? '00' : ((elm.doc["number"]) * 1) < 100 ? '0' : '') + ((elm.doc["number"]) * 1);
                    objWeightedsIDs[elm.doc['Component Item'].substr(0, 6) + "#" + number] = elm;
                    return elm.doc;
                });
                var objWeightedsBarcode = {};
                arrWeighteds.forEach(element => {
                    var barcodeCode = element['Component Item'].substr(0, 6);
                    //var barcodeCode = element['Component Item'] in objMaterialsPerBarcodeCode ? objMaterialsPerBarcodeCode[element['Component Item']] :'123456';
                    var number = (((element["number"]) * 1) < 10 ? '00' : ((element["number"]) * 1) < 100 ? '0' : '') + ((element["number"]) * 1);
                    objWeightedsBarcode[barcodeCode + "#" + element["Lot/Serial"].substring(0, 10) + "#" + element["netto"] + objMaterials[0]['doc']['UM'] + "#" + number] = element;
                });
                console.log(objWeightedsBarcode);
                arrScanned = arrWeighteds.filter(elm => 'scanTime' in elm);
                console.log(arrScanned, arrWeighteds);
                $('#orderNumber').text(qs.order);
                $('#materialName').text(objMaterialsPerCode[arrWeighteds[arrScanned.length]['Component Item']]['Component Item Description']);
                $('#materialCode').text(arrWeighteds[arrScanned.length]['Component Item']);
                $('#lotNumber').text(arrWeighteds[arrScanned.length]['Lot/Serial']);
                var number = arrWeighteds[arrScanned.length]['number'] * 1;
                onNumber = (number < 10 ? '00' : number < 100 ? '0' : '') + number;
                $('#weighingNumber').text(number);
                $('#weighingQty').text(arrWeighteds[arrScanned.length]['netto'] + " " + objMaterials[0]['doc']['UM']);
                $('#barcodeScanner').focus();

                var headCSV = [
                    'Work Order',
                    'ID',
                    'Operation',
                    'Component Item',
                    'Site',
                    'Location',
                    'Lot/Serial',
                    'Qty to Iss'
                ];

                var nettoWeight = {};
                var objKeysWeight = objWeights.filter(function (weights) {
                    var key = weights.doc['Component Item'] + "#" + weights.doc['Lot/Serial'];
                    var boolValue = !(key in nettoWeight);
                    console.log(boolValue);
                    if (!(key in nettoWeight)) nettoWeight[key] = 0;
                    nettoWeight[key] += (weights.doc['netto'] * 1);
                    console.log(weights);
                    return boolValue;
                });
                console.log(objKeysWeight, nettoWeight);

                var arrIssue = objKeysWeight.map(function (weights) {
                    var doc = weights.doc;
                    var obj = {};
                    headCSV.forEach(function (h) {
                        if (h == 'Qty to Iss')
                            obj[h] = nettoWeight[doc['Component Item'] + "#" + doc['Lot/Serial']];
                        else if (h == 'Work Order')
                            obj[h] = objOrders[0]['doc']['Work Order'];
                        else
                            obj[h] = doc[h];
                    });
                    return obj;
                });
                console.log(arrIssue);

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
                    }, {
                        name: 'scanTime',
                        title: 'Scan Time'
                    }],
                    data: arrScanned
                });
                console.log(objWeightedsIDs);
                $('#barcodeScanner').on('input', function () {
                    var barcodeValue = $(this).val();
                    var arrBarcodeValue = barcodeValue.split('#');
                    var materialCode = Object.keys(objMaterialsPerBarcodeCode).filter(elm => {
                        console.log(arrBarcodeValue[0], objMaterialsPerBarcodeCode[elm]);
                        return arrBarcodeValue[0] == objMaterialsPerBarcodeCode[elm]['Barcode Code']
                    })[0];
                    var keyItemNumber = arrBarcodeValue[0] + "#" + arrBarcodeValue[3];
                    if (arrBarcodeValue.length == 4) {
                        if (barcodeValue in objWeightedsBarcode) {
                            console.log(arrBarcodeValue[0], arrWeighteds[arrScanned.length]['Component Item'].substr(0, 6), (arrBarcodeValue[3] * 1) == onNumber);
                            if (arrBarcodeValue[0] == arrWeighteds[arrScanned.length]['Component Item'].substr(0, 6) && (arrBarcodeValue[3] * 1) == onNumber) {
                                l.leaPut({
                                    tid: objWeightedsIDs[keyItemNumber].id,
                                    table: 'weights',
                                    newObj: {
                                        'scanTime': new Date().toISOString()
                                    }
                                }, function () {
                                    alert('Success');
                                    window.location.reload();
                                });
                            } else {
                                $.alert('Wrong Sequence');
                                $('#barcodeScanner').val("");
                            }
                        } else {
                            $.alert('Barcode not found');
                            $('#barcodeScanner').val("");
                        }
                    }
                });
                if (arrScanned.length == objWeights.length || true) {
                    $('#save').removeAttr('disabled');
                }

                $('#save').on('click', function () {
                    $('#finalize').attr('disabled', 'disabled');
                    var sql1 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.orders where COLUMN_GET(doc, "ID" as char) = "' + objOrders[0]['doc']['ID'] + '"';
                    $.when(
                        $.ajax("http://localhost:8877/test?sql=" + escape(sql1))).then(function (buf) {
                        var objOrders = JSON.parse(buf);
                        var docObjOrders = JSON.parse(objOrders[0].doc);
                        if (docObjOrders['Status'] !== 'Finalized') {
                            var jqXhr = $.ajax({
                                url: 'http://localhost:5552',
                                type: 'POST',
                                data: {
                                    'doc': encodeURIComponent(JSON.stringify(arrIssue))
                                }
                            });
                            jqXhr.done(function (data) {
                                putMR('orders', objOrders[0].id, {
                                    'Status': 'Finalized'
                                }, function () {
                                    $.alert('Sukses');
                                });
                            });
                        } else {
                            $.alert('Work Order sudah di finalisasi!');
                        }
                    });
                });

            } else {
                l.promptXml({
                    title: 'Order Number',
                    xml: '<input type="text" id="order" placeholder="Order Number" class="name form-control" required />',
                }, {
                    action: async function () {
                        var orderNumber = this.$content.find('#order').val();
                        var url = window.location.toString() + "?order=" + orderNumber;
                        window.location = url;
                    }
                });
            }
        });
    });
});
document.addEventListener("DOMContentLoaded", function (event) {
    requirejs([
        "/cdn/js/lea.js",
        "/cdn/js/uuidv1.js",
        "/cdn/js/async.min.js"
    ], function (Lea, Uuidv1, oAsync) {
        l = new lea();
        var qs = l.querystring(window.location.search.substring(1));
        var IDPREP = "Prep1";

        l.BrowserReady(async function () {
            if ('order' in qs) {
                var xml = await $.ajax("http://" + HOSTPORT_FS + "/local/index.xml");
                $('#content').html(xml);
                var sql1 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.orders WHERE COLUMN_GET(doc, "Work Order" as char) = "' + qs['order'] + '" AND COLUMN_GET(doc, "Preparation" as char) = "' + IDPREP + '"';
                var objOrders = await $.ajax("http://" + l.HOSTPORT_DB + "/test?sql=" + escape(sql1)).then(l.parsing);
                if( objOrders.length == 0 ) {
                    alert('Wrong Order');
                    window.location = "/verification";
                } else {
                    var itemOrder = objOrders[0].doc;
                    var sql2 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.weights WHERE COLUMN_GET(doc, "ID" as char) = "' + itemOrder['ID'] + '"';
                    var objWeights = await $.ajax("http://" + l.HOSTPORT_DB + "/test?sql=" + escape(sql2)).then(l.parsing);
                    var arrWeighteds = objWeights.map(function (elm, index) {
                        return elm.doc;
                    }); 
                    
                    l.table({
                        idTable: "#table1",
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
                        },{
                            name: 'Verified',
                            title: 'Verify'
                        }
                    ],
                        data: arrWeighteds,
                        additional : [
                            {
                                name: 'Verified',
                                title: '',
                                type: 'Checkbox',
                                class: 'check_verify'
                            }
                        ]
                    });
                    $('#table1').delegate('.check_verify', 'change', function(){
                        var arrCheckBox = Array.from( $('.check_verify')).map(function(e){return $(e)[0].checked});
                        if( arrCheckBox.indexOf(false) == -1 ) {
                            $('#save').removeAttr('disabled');
                        }
                    });

                    $('#save').on('click', function(){
                        $('#save').attr('disabled', 'disabled');
                        oAsync.forEachOf(objWeights, (value, key, callback) => {
                            l.leaPut({tid:value.id, table:'weights', newObj:{'Verified':true}}, function(){
                                callback();
                            });
                        }, err => {
                            if (err) console.error(err.message);
                            l.leaPut({tid:objOrders[0].id, table:'orders', newObj:{'PREP Verified' : true}}, function(){
                                alert('Finished');
                                window.location = "/home";
                            });
                        });
                    });
                }
                
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
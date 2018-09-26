var lea = function(id) {
    return this;
}

lea.prototype = {
    debug_log : function(msg){
        console.log(msg);
    }, 
    table: funCreateTable,
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
    cash: funCash,
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
    },

    createDatatable : function( id, option ){
        $(id).empty();
        var arrData = option.data.map(function( datas ){
            var doc = !("doc" in datas) ? datas : typeof datas.doc === "string" ? JSON.parse(datas.doc) : datas.doc;
            return option.head.map(function( heads ){
                var value = heads.name in doc ? doc[heads.name] : '-';
                return value;
            });
        });
        var objectDatatable = {
            searching: 'searching' in option ? option.searching : false,
            info: 'info' in option ? option.info : false,
            paging: 'paging' in option ? option.paging : false,
            data:arrData,
            columns: option.head
        };
        if( 'buttons' in option ) {
            var btnOption = option.buttons.map(function( button ){
                objectDatatable.columns.push({
                    name: button.name,
                    title: button.title
                });
                return {
                    'targets' : button.index * 1,
                    'data': null,
                    'defaultContent': button.xml
                }
            });
            objectDatatable.columnDefs = btnOption;
        }
        $(id).dataTable(objectDatatable);
    },
    updateDatatable : function( id, option ){
        var table = $(id).DataTable();
        var arrData = option.data.map(function( datas ){
            var doc = !("doc" in datas) ? datas : typeof datas.doc === "string" ? JSON.parse(datas.doc) : datas.doc;
            return option.head.map(function( heads ){
                var value = heads.name in doc ? doc[heads.name] : '-';
                return value;
            });
        });
        table.rows().remove().draw();
        table.rows.add(arrData).draw();
    },
    promptXml : function( option, callback ) {
        option = !option ? {} : option;
        callback = !callback ? {} : callback;
        $.confirm({
            title: 'title' in option ? option.title : 'Prompt!' ,
            content: 
                '<form action="" class="formName">' +
                '<div class="form-group">' +
                ('xml' in option ? option.xml : '') + 
                '</div>' +
                '</form>',
            buttons: {
                formSubmit: {
                    text: 'Submit',
                    btnClass: 'btn-blue',
                    action: 'action' in callback ? callback.action() : function(){}
                },
                cancel: 'cancel' in callback ? callback.cancel() : function(){}
            },
            onContentReady: function() {
                var jc = this;
                this.$content.find('.name').trigger('focus');
                this.$content.find('form').on('submit', function(e) {
                    e.preventDefault();
                    jc.$$formSubmit.trigger('click');
                });
                if( 'ready' in callback) callback.ready();
            }
        });
    }
};

var funCreateTable = function(obj, option) {
    if (!option) option = {};
    var str = '<thead class="thead-inverse"><tr>';
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
            var index = obj.head[i2 - 1];
            if (index in option) {
                str += '<td class="data' + i2 + '">';
                if (option[index]['mode'] == "select") {
                    var nstr = '<select name="select">';
                    if (option[index]['value'].indexOf(e2)) nstr += '<option selected disabled="disabled">-</option>';
                    nstr += option[index]['value'].map(function(val) {
                        if (e2 == val) var ret = '<option value="' + val + '" selected>' + val + '</option>';
                        else var ret = '<option value="' + val + '">' + val + '</option>';
                        return ret
                    }).join('') + '</select>';
                } else if (option[index]['mode'] == "up") {
                    var nstr = '<button class="updown up"><i class="fa fa-caret-up fa-lg" aria-hidden="true"></i></button>';
                } else if (option[index]['mode'] == "down") {
                    var nstr = '<button class="updown down"><i class="fa fa-caret-down fa-lg" aria-hidden="true"></i></button>';
                } else if (option[index]['mode'] == "button") {
                    var nstr = '<button type="button" class="btn btn-primary">' + e2 + '</button>';
                }
                str += nstr + '</td>'
            } else {
                str += '<td class="data' + i2 + '">';
                if (!e2) e2 = '-';
                if (i2 == 2) str += '<span class="' + tag[e2.toLowerCase()] + '">' + e2 + '</span>';
                else str += e2;
                str += '</td>';
            }
        });
        str += '</tr>';
    });
    str += '</tbody>';
    return str;
};
var funCash = (function(sig, sec) {
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
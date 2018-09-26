document.addEventListener("DOMContentLoaded", function (event) {
    var old = 0;
    requirejs(["/cdn/js/mqttws31.js","/cdn/js/elasticlunr.min.js"], function (util, elasticlunr) {
        $.ajax({
            url: 'http://localhost:8877/test',
            type: 'GET',
            data: {
                sql: escape('SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.logsystem limit 100')
            },
            success: function (result) {
                var obj = JSON.parse(result);
                var objStocks = {};
                var limitHead = [
                    'user',
                    'log',	
                    'time'
                ];
                head = limitHead;
                var data = obj.map(function(e){
                    var o = JSON.parse(e.doc);
                    return head.map(function(e2){
                        if( e2 == 'Expire Date' )
                            o[e2] = o[e2].substr(0,10);
                        return o[e2];
                    });
                });
                createTable({
                    'head':head,
                    'data':data
                });
                console.log('on');
                $('#search').change(function(){
                    var val = $(this).val();
                    if( val != '' )
                        var objFiltered = obj.filter(function( e ){
                            return (e.doc).indexOf(val) > -1;
                        });
                    else
                        var objFiltered = obj;
                    var data = objFiltered.map(function(e){
                        var o = JSON.parse(e.doc);
                        return head.map(function(e2){
                            if( e2 == 'Expire Date' )
                                o[e2] = o[e2].substr(0,10);
                            return o[e2];
                        });
                    });
                    createTable({
                        'head':head,
                        'data':data
                    });
                    
                });
            },
            error: function (req, status, error) {
                alert('error', error);
            }
        });
    });
});

function debug(e) {
    console.log(e);
}
var tag = {
    'weighted':'tag tag-progress',
    'created':'tag tag-default',
    'finished':'tag tag-success'
};
function createTable(obj) {
    //var str = '<table id="datatable" class="table"></table>';
    //$('.table-wrap').html(str);
    var str = '<thead class="thead-inverse"><tr>';
        ["#"].concat(obj.head).forEach(function (e) {
        str += '<th>';
        str += e;
        str += '</th>';
    });
    str += '</tr></thead>';
    str += '<tbody>';
    obj.data.forEach(function (e, i) {
        str += '<tr>';
            [i + 1].concat(e).forEach(function (e2, i2) {
            str += '<td class="data' + i2 + '">';
            if(! e2 )
                e2 = '-';
            if (i2 == 2 )
                str += '<span class="'+ tag[e2.toLowerCase()] +'">' + e2 + '</span>';
            else
                str += e2;
            str += '</td>';
        });
        str += '</tr>';
    });
    str += '</tbody>';
    $('#datatable').html(str);
}

function objToArrDB(obj) {
    var arr = [];
    Object.keys(obj).forEach(function (e) {
        arr.push(e);
        arr.push(obj[e]);
    });
    return '"' + arr.join('","') + '"';
}

function putMR(table, tid, newObj, cb) {
    var jqXhr = $.ajax({
        url: 'http://localhost:8877/test',
        type: 'GET',
        data: {
            sql: escape('SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.' + table + ' WHERE id="' + tid + '"')
        }
    });
    jqXhr.done(function (data) {
        var obj = JSON.parse(data);
        if (obj.length >= 0) {
            var id = obj[0].id;
            var doc = JSON.parse(obj[0].doc);
            Object.keys(newObj).forEach(function (e) {
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
            jqXhr2.done(function (data) {
                var jqXhr3 = $.ajax({
                    url: 'http://localhost:8877/test',
                    type: 'GET',
                    data: {
                        sql: escape('INSERT INTO docs.' + table + ' VALUES ("' + id + '", COLUMN_CREATE(' + strData + '));')
                    }
                });
                jqXhr3.done(function (data) {
                    console.log('sukses');
                    cb();
                });
            });
        }
    });
};

var api = function (mtd, url, sql){
    return new Promise( function(resolve, reject) {
        $.get(url + '?sql=' + escape(sql)).then( function(buf){resolve(buf);});
    })
}

var makeRequest = async function (method, url) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.response);
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send();
  });
}
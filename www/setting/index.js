document.addEventListener("DOMContentLoaded", function (event) {
    var old = 0;
    requirejs([
        "/cdn/js/mqttws31.js",
        "/cdn/js/uuidv1.js"
              ], function (util, uuidv1) {
        uid = uuidv1;
        var sql1 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.roles limit 100';
        var sql2 = 'SELECT id , CONVERT(COLUMN_JSON(doc) USING utf8) as doc FROM docs.roleplay limit 100';
        $.when(
            $.ajax("http://localhost:8877/test?sql=" + escape(sql1)), 
            $.ajax("http://localhost:8877/test?sql=" + escape(sql2))).then(function( a , b){
            var arrUsers = JSON.parse(a[0]);
            var arrRoleplay = JSON.parse(b[0]);
            var str = '<h2>List Users</h2>';
            $('#page-content-wrapper2').html(str);
            var head = [
                'username',
                'email',
                'role',
                'suspended',
                'button'
            ];
            var ids = {};
            var data = arrUsers.map(function(user){
                var tag = JSON.parse(user.doc);
                ids[ tag['username'] ] = user.id; 
                return head.map(function(head){
                    if( head == 'button' ) return 'Save';
                    else return tag[head]; 
                });
            });
            var str = '<div id="in_table"></div>';
            $('#page-content-wrapper2').append(str);
            var option = {
                'role': {
                    'mode':'select',
                    'value': ['user', 'guest', 'superuser', 'admin']
                },
                'suspended': {
                    'mode':'select',
                    'value': [ '', 'true' ]
                }
            };
            createTable('#in_table',{'data':data, 'head':head}, option);
            $('td').delegate('button', 'click', function(){
                var parentUser = $(this.parentNode.parentNode).find('td:nth-child(2)').get();
                var parentRole = $(this.parentNode.parentNode).find('td:nth-child(4) select').get();
                var parentSuspend = $(this.parentNode.parentNode).find('td:nth-child(5) select').get();
                var role = $(parentRole[0]).val();
                var user = $(parentUser[0]).text();
                var suspend = $(parentSuspend[0]).val();
                var res = confirm('Anda yakin?');
                if( res ) {
                    putMR('roles', ids[user], {'role':role, 'suspended': suspend}, function(res){
                        alert('sukses');
                        location.reload();
                    });
                }
            });
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
function createTable(id, obj, option) {
    var str = '<table id="datatable" class="table"></table>';
    $(id).html(str);
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
            var index = obj.head[i2 - 1]; 
            if( index in option ) {
                str += '<td class="data' + i2 + '">';
                if( option[index]['mode'] == "select" ) {
                    var nstr = '<select name="select">';
                    nstr += option[index]['value'].map(function(val){
                        if( index == "suspended" )console.log(e2, val, index);
                        if( e2 == val ) var ret = '<option value="'+ val +'" selected>'+ val +'</option>';
                        else var ret = '<option value="'+ val +'">'+ val +'</option>';
                        return  ret
                    }).join('') + '</select>';
                }
                str += nstr + '</td>'
            } else {
                str += '<td class="data' + i2 + '">';
                if( index == 'button' ) {
                    str += '<button type="button" class="btn btn-primary btn-xs">'+ e2 +'</button>';
                } else {
                    if(! e2 ) e2 = '-';
                    if (i2 == 2 ) str += '<span class="'+ tag[e2.toLowerCase()] +'">' + e2 + '</span>';
                    else str += e2;
                }
                str += '</td>';
            }
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
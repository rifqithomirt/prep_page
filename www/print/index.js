document.addEventListener("DOMContentLoaded", function (event) {
    var old = 0;
    requirejs(["/cdn/js/mqttws31.js"], function (util) {
        var queryString = window.location.search;
        queryString = queryString.substring(1);
        qs = parseQueryString(queryString);
        var encode = qs.code+ '-'+ qs.netto;
        var str = '<div id="barcode"><img src="http://localhost:7000/barcode?encode='+ encode +'" alt="http://localhost:7000/barcode?encode='+ encode +'" class="transparent"></div>';
        $('#wrapper').html(str);
        
        //$.ajax({
        //    url: 'http://localhost:7000/barcode?encode='+ qs.code,
        //    type: 'GET',
        //    success: function (result) {
        //        
        //    },
        //    error: function (req, status, error) {
        //        alert('error', error);
        //    }
        //});
        
    });
});

function debug(e) {
    console.log(e);
}
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

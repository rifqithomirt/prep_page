document.addEventListener("DOMContentLoaded", function (event) {
    requirejs([
        "/cdn/js/localforage.js",
        "/cdn/js/bcrypt.js"
    ], function(localForage, Bcrypt) {
        l = new lea();
        BrowserReady( async function(){
            var xml = await $.ajax("http://" + l.HOSTPORT_FS + "/local/index.xml");
            $('#content').html(xml);
            $("#login").click(function () {
                var username = $("#email").val();
                var password = $("#pwd").val();
                $.ajax({
                    url: "http://" + l.HOSTPORT_FS + "/sso",
                    type: 'GET',
                    data: {
                        'username': username,
                        'password': password
                    },
                    success: function (result) {
                        result = result.toString();
                        if(result == 'true')
                            window.location = '/home';
                        else if( result.indexOf('suspended') > -1 ) {
                            alert('Your Account is Suspended');
                            window.location = '/login';
                        }
                        else
                            window.location = '/login';   
                         
                    },
                    error: function (req, status, error) {
                        alert('error', error);
                    }
                });
            });

        });
        /*
        bcrypt = Bcrypt;
        $("#login").click(function () {
            var username = $("#email").val();
            var password = $("#pwd").val();
            console.log(username, password);
            
            
        });
        */
    });
});
var BrowserReady = function(cb) {
    if (document.readyState === "complete") cb();
    else setTimeout(cb, 100);
}

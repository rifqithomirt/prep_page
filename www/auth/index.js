document.addEventListener("DOMContentLoaded", function (event) {
    $("#log").click(function () {
        var username = $("#email").val();
        var password = $("#password").val();
        console.log(username, password);
        $.ajax({
            url: 'http://localhost:4000/sso',
            type: 'GET',
            data: {
                'username': username,
                'password': password
            },
            success: function (result) {
                console.log(result);
                if(result == 'true')
                    window.location = '/ihome';
                else
                    window.location = '/auth';
            },
            error: function (req, status, error) {
                alert('error', error);
            }
        });
        
    });
});

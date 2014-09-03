self.port.on('error', function (err) {
    console.log("on error handler?: " + JSON.stringify(err));
    document.getElementById('error-message').innerHTML = ' ' + err;
});

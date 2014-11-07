/**
 * Copyright (c) 2014 Gerardo Moad
 */
self.port.on('error', function (err) {
    console.log("on error handler?: " + JSON.stringify(err));
    document.getElementById('error-message').textContent = ' ' + err;
});

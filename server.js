const WACO = require("./waco/waco.js");
const path = require('path');
const port = process.env.PORT || 8001;

WACO.app.get('/scan', function (req, res) {
    res.sendFile(path.join(__dirname+'/scan.html'))
});

WACO.app.post('/send-message', WACO.cors, async (req, res) => {
    WACO.send_message(req, res);
});

WACO.app.get('/exit', WACO.cors, async (req, res) => {
    WACO.exit(req, res);
});

WACO.server.listen(port, () => {
    console.log("WACO IS LIVE on PORT: " + port);
});
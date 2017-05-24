var path = require('path'),
    express = require('express'),
    session = require('express-session'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    logger = require('signaling/logger')('RoomRTC');


var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cookieParser());
app.use(session({
    secret: '1234567890',
    saveUninitialized: true,
    resave: true
}));

app.use(express.static(path.join(__dirname, './dist')));

/// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found: ' + req.url);
    err.status = 404;
    next(err);
});

var http = require('http'),
    RoomrtcServer = require('./index');

var port = process.env.PORT || 8123;
var server = require('http').Server(app);
var roomrtc = new RoomrtcServer();

roomrtc.listen(server);
server.listen(port, function () {
    logger.info('server is running at: ', port);
});

module.exports = roomrtc;

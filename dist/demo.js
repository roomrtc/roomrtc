var path = require("path"),
    express = require('express'),
    session = require('express-session'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    logger = console;


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

app.use(express.static(path.join(__dirname, './')));

/// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

var http = require("http"),
    config = require("config"),
    signaling = require("signaling");

var port = process.env.PORT || 8123;
var server = require('http').Server(app);

signaling(server, {
    turnservers: [],
    stunservers: []
});
console.log("Config signaling server is done!");

app.set('port', port);
server.listen(port, function () {
    console.log("server is running at: ", port);
});
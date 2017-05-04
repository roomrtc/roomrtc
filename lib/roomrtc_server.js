const events = require("events");
const signaling = require('signaling');

const Client = require('./client');

/**
 * Roomrtc Server
 * 
 * @desc Signaling and management server
 */
module.exports = class RoomrtcServer extends events.EventEmitter {
    constructor(options) {
        super();
        this.config = {
            autoInitServer: true
        }

        // members
        this.signaling = null;
        this.clients = {};
        this.rooms = {};

        for (let opt in options) {
            if (options.hasOwnProperty(opt)) {
                this.config[opt] = options[opt];
            }
        }
    }

    /**
     * Listen socket connection
     * @param {Signaling} server 
     */
    listen(server) {
        var self = this;
        this.signaling = signaling(server);

        // setup event handlers
        // this.signaling.on('connection', this.addNewClient.bind(this));
        this.signaling.on('join', this.addNewClient.bind(this));
        this.signaling.on('leave', this.removeClient.bind(this));

        // expose all events come from Signaling
        // this.signaling.onAny(function () {
        //     self.emit.apply(self, arguments);
        // });

        return this;
    }

    addNewClient(room, socket) {
        let client = new Client({
            socket: socket
        });

        this.rooms[room] = this.rooms[room] || {};
        this.rooms[room][client.id] = client;
        this.clients[client.id] = client;
        // console.log('new client joined: ', client.id, client.isConnected, Object.keys(this.clients).length);
        socket.emit('ready');
    }

    removeClient(client, roomCount) {
        let id = client.id;
        let roomName = client.room;
        let room = this.getRoom(roomName);
        delete room[id];
        delete this.clients[id];
        // console.log('a client leaved: ', id);
    }

    getRoom(name) {
        // return room or empty.
        return this.rooms[name] || {};
    }

    /**
     * Sets individual option.
     *
     * @param       {Object} option Option name
     * @param       {Object} value  Option value
     * @returns     {Boolean} true on success, false on failure
     */
    setOption(option, value) {
        if (option) {
            this.config[option] = value;
        }
    }
}
const events = require("events");
const Signaling = require('signaling').Signaling;
const logger = require('signaling/logger')('RoomRTC');
const ws = require('socket.io');

const Room = require('./room');
const Peer = require('./peer');

/**
 * Roomrtc Server
 * 
 * @desc Signaling and management server
 */
class RoomrtcServer extends Signaling {
    constructor(options) {
        super(options);

        // members
        this.clients = new Map();
        this._rooms = new Map();

        this.on('signalingReady', (server) => {
            this.httpServer = server;
            logger.info('signaling server is ready!');
        });

        this.on('join', this.newClient.bind(this));
        this.on('leave', this.removeClient.bind(this));
    }

    get rooms() {
        return this._rooms;
    }

    newClient(roomName, socket) {

        if (!this.rooms.has(roomName)) {
            logger.info('Creating a new room:', roomName);
            let room = new Room(roomName);

            room.on('close', () => this.rooms.delete(roomName));
            this.rooms.set(roomName, room);
        }

        // create new Peer
        let room = this.rooms.get(roomName);
        room.createPeer(socket.id, socket)
            .then((peer) => {
                peer.send('ready');
            });
    }

    removeClient(client, roomCount) {
        let id = client.id;
        let roomName = client.room;
        let room = this.getRoom(roomName);
        this._rooms.delete(roomName);
    }

    getRoom(name) {
        // return room or empty.
        return this._rooms.get(name);
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

module.exports = RoomrtcServer;
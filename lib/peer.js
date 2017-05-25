'use strict';
const uuid = require('uuid');
const EventEmitter = require('events').EventEmitter;
const logger = require('signaling/logger')('Peer');

class Peer extends EventEmitter {
    constructor(id, socket, options) {
        super();
        this._config = {
            username: null,
            credential: null,
            isAuthenticated: false,
            profile: {
                video: true,
                audio: false,
                screen: false
            }
        }

        // override default config
        for (let opt in options) {
            if (options.hasOwnProperty(opt)) {
                this._config[opt] = options[opt];
            }
        }

        // socket connection
        this._socket = socket;
        this._id = id;
        this._isClosed = false;

        // members
        this._room = null;
        this.send = socket.emit.bind(socket);
        socket.on('disconnect', () => {
            logger.debug('Socket disconnect', socket.id);
            this.emit('close', id);
        });

        // handle message
        // this._handleMessage();
    }

    get id() {
        return this._id;
    }

    get sid() {
        return this._socket.id;
    }

    get config() {
        return this._config;
    }

    get username() {
        return this._config.username;
    }

    get isConnected() {
        return this._socket.connected;
    }

    get isClosed() {
        return this._isClosed;
    }

    get room() {
        return this._room;
    }

    set room(value) {
        this._room = value;
    }

    close() {
        logger.info('Closing peer:', this.id);
        if (this._isClosed) {
            logger.debug(`Peer(${this.id}) is already closed`);
            return;
        }

        this._isClosed = true;
        this.socket.close();
        this.emit('close', this);
    }

}

module.exports = Peer;
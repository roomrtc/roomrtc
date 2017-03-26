'use strict';
const uuid = require('uuid');

module.exports = class Client {
    constructor(options) {
        this.config = {
            parent: null,
            socket: null,
            profile: {
                video: true,
                audio: false,
                screen: false
            }
        }

        // override default config
        for (let opt in options) {
            if (options.hasOwnProperty(opt)) {
                this.config[opt] = options[opt];
            }
        }

        // variable members
        this.id = null;
        this.username = null;
        this.credential = null;
        this.isAuthenticated = false;
    
        if (this.config.socket) {
            this.id = this.config.socket.id;
        } else {
            this.id = uuid.v4();
        }
    }

    get isConnected () {
        return this.config.socket.connected;
    }

}
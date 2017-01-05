var events = require("events");
var adapter = require("webrtc-adapter");
var socketio = require("socket.io-client");
var Promise = require("promise");

var EventEmitter = events.EventEmitter;

module.exports = class RoomRTC extends EventEmitter {

    constructor(opts) {
        super();
        this.self = this;
        this.logger = console;
        this.options = opts || {};
        this.connection = null;
        this.connectionReady = false;
        this.roomName = null;
        this.config = {
            url: "/",
            media: {
                video: true,
                audio: true,
                data: false,
                screen: false
            },
            peerMedia: {
                offerToReceiveVideo: true,
                offerToReceiveAudio: true
            },
            localVideo: {
                autoplay: true,
                mirror: true,
                muted: true
            }
        }

        // init connection to signaling server
        this.connection = socketio.connect(this.config.url);

        this.connection.on("connect", () => {
            this.connectionReady = true;
            this.connectionId = this.connection.id
            this.emit("connected", this.connectionId);
            this.verifyReady();
        });

    }

    verifyReady() {
        if (this.connectionReady) {
            this.emit("readyToCall", this.connectionId);
        }
    }

    joinRoom(name) {
        if (!name) return Promise.reject("No room to join");
        // set name of the room wanna join
        this.roomName = name;
        return new Promise((resolve, reject) => {
            this.connection.emit("join", name, (err, roomData) => {
                this.logger.debug("join callback: ", err, roomData);
                if (err) {
                    this.emit("error", err);
                    return reject(err);
                } else {
                    this.emit("roomJoined", name);
                    return resolve(roomData);
                }
            });
        });
    }

}
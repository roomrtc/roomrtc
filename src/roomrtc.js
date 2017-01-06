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
        this.localStream = null;
        this.config = {
            url: "/",
            media: {
                audio: true,
                video: true,
                data: false,
                screen: false
            },
            mediaConstraints: {
                audio: true,
                video: true
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

    /**
     * Verify connection ready then emit the event
     */
    verifyReady() {
        if (this.connectionReady) {
            this.emit("readyToCall", this.connectionId);
        }
    }

    /**
     * join to exists room
     * @return roomData(clients, number of participants)
     */
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

    /**
     * Create a new room
     * @return name of the room
     */
    createRoom(name) {
        if (!name) return Promise.reject("No room to create");
        // send command to create a room
        return new Promise((resolve, reject) => {
            this.connection.emit('create', name, (err, roomName) => {
                if (err) {
                    this.emit("error", err);
                } else {
                    this.roomName = roomName;
                    this.emit("roomCreated", roomName);
                    return resolve(roomName);
                }
            });
        });

    }

    /**
     * Request to access a local camera and microphone
     * @return: a promise handle
     */
    initMediaSource(mediaConstraints, devName) {
        this.logger.debug("Requesting local media ...");

        let dev = devName || "default";
        let constrains = mediaConstraints || this.config.mediaConstraints;
        return navigator.mediaDevices.getUserMedia(constrains)
            .then(stream => {
                // TODO: add event all to all tracks of the stream ?
                this.localStream = stream;
                return stream;
            });
    }

    stop(stream) {
        stream = stream || this.localStream;
        this.stopStream(stream);
    }

    /**
     * Replaces the deprecated MediaStream.stop method
     */
    stopStream(stream) {
        if (!stream) return;
        // stop audio tracks
        for (let track of stream.getAudioTracks()) {
            try {
                track.stop();
            } catch (err) {
                this.logger.debug("stop audio track error:", err);
            }
        }
        // stop video tracks
        for (let track of stream.getVideoTracks()) {
            try {
                track.stop();
            } catch (err) {
                this.logger.debug("stop video track error:", err);
            }
        }
        // stop stream
        if (typeof stream.stop === 'function') {
            try {
                stream.stop();
            } catch (err) {}
        }
    }

    /**
     * utils to get, revoke a stream as url
     * @return: blobUrl
     */
    getStreamAsUrl(stream) {
        return URL.createObjectURL(stream);
    }

    /**
     * revokeObjectURL
     */
    revokeObjectURL(url) {
        URL.revokeObjectURL(url);
    }
}
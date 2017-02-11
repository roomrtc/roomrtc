const events = require("eventemitter2");
const adapter = require("webrtc-adapter");
const socketio = require("socket.io-client");
const Promise = require("promise");
const WebRTC = require("./webrtc");

const EventEmitter = events.EventEmitter2;

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
            autoConnect: true,
            url: "https://roomrtc-signaling-server.herokuapp.com",
            media: {
                audio: true,
                video: true,
                data: false,
                screen: false
            },
            localMediaConstraints: {
                audio: false,
                video: true
            },
            peerMediaConstraints: {
                offerToReceiveVideo: true,
                offerToReceiveAudio: true
            },
            localVideo: {
                autoplay: true,
                mirror: true,
                muted: true
            }
        }

        // override default config
        for (let item in this.options) {
            if (this.options.hasOwnProperty(item)) {
                this.config[item] = this.options[item];
            }
        }

        // init webrtc
        this.webrtc = new WebRTC();
        this.webrtc.on("peerStreamAdded", this.handlePeerStreamAdded.bind(this));
        this.webrtc.on("peerStreamRemoved", this.handlePeerStreamRemoved.bind(this));
        this.webrtc.on("message", payload => {
            this.logger.debug("send message command", payload);
            this.connection.emit("message", payload);
        });

        // debug all webrtc events
        this.webrtc.onAny((event, value) => {
            this.emit.call(this, event, value);
        })
        // log all data to the console
        this.onAny(this.logger.debug.bind(this.logger, "RoomRTC event:"));

        if (this.config.autoConnect) {
            // init connection to signaling server
            this.connect();
        }
    }

    connect() {
        
        this.connection = socketio.connect(this.config.url);

        this.connection.on("connect", () => {
            this.connectionReady = true;
            this.connectionId = this.connection.id
            this.emit("connected", this.connectionId);
            this.verifyReady();
        });

        this.connection.on("message", msg => {
            // this.logger.debug("Receive message from singaling server:", msg);
            if (msg.type == "offer") {
                // create answer
                let peer = this.webrtc.peers.find(p => p.sid == msg.sid);
                if (!peer) {
                    this.logger.debug("Creating a new peer connection to:", msg.from);
                    peer = this.webrtc.createPeerConnection({
                        id: msg.from,
                        sid: msg.sid
                    });
                    this.emit("peerCreated", peer);
                }
                peer.processMessage(msg);
            } else {
                // process message
                let peers = this.webrtc.peers;
                peers.forEach(peer => {
                    if (msg.sid) {
                        if (peer.sid === msg.sid) {
                            peer.processMessage(msg);
                        }
                    } else {
                        peer.processMessage(msg);
                    }
                });
            }
        });

        this.connection.on("remove", info => {
            this.logger.info("removePeerConnectionById", info);
            this.webrtc.removePeerConnectionById(info.id);
        })

        this.connection.on("iceservers", servers => {
            this.logger.debug("Got iceservers info", servers);
            // TODO: concat to peer connection
        });
 
    }

    disconnect() {
        if (this.connection) {
            this.connection.disconnect();
            delete this.connection;
        }
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
                    // try to call everyone in the room
                    let clients = roomData.clients || [];
                    for (let id in clients) {
                        // let clientConstraints = clients[id];
                        let peer = this.webrtc.createPeerConnection({
                            id: id
                        });
                        this.emit("peerCreated", peer);
                        peer.start();
                    }

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
        let constrains = mediaConstraints || this.config.localMediaConstraints;
        return navigator.mediaDevices.getUserMedia(constrains)
            .then(stream => {
                // TODO: add event all to all tracks of the stream, multiple streams ?
                this.localStream = stream;
                this.webrtc.addLocalStream(stream);
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
        var URL = window.URL || window.webkitURL;
        return URL.createObjectURL(stream);
    }

    /**
     * revokeObjectURL
     */
    revokeObjectURL(url) {
        var URL = window.URL || window.webkitURL;
        URL.revokeObjectURL(url);
    }

    /**
     * handle streaming
     */
    handlePeerStreamAdded(peer) {
        let stream = peer.stream;
        this.logger.debug("A new remote video added:", peer.id);
        this.emit("videoAdded", peer, stream);
    }

    handlePeerStreamRemoved(peer) {
        this.logger.debug("A remote video removed:", peer.id);
        this.emit("videoRemoved", peer);
    }
}
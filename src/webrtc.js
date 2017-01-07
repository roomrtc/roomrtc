const events = require("eventemitter2");
const adapter = require("webrtc-adapter");
const PeerConnection = require("./peerconnection");

const EventEmitter = events.EventEmitter2;

module.exports = class WebRTC extends EventEmitter {

    constructor(opts) {
        super();
        this.self = this;
        this.logger = console;
        this.config = {
            peerConnectionConfig: {
                iceServers: [{
                    'urls': 'stun:stun.l.google.com:19302'
                }]
            },
            peerConnectionConstraints: {
                optional: []
            },
            receiveMedia: {
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1
            },
            enableDataChannels: true
        }

        // hold peer connections
        this.peers = [];
    }

    createPeerConnection(options) {
        options = options || {};
        options.parent = this;
        let peer = new PeerConnection(options);
        this.peers.push(peer);
        return peer;
    }

}
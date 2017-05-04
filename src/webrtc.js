const events = require('eventemitter2');
const adapter = require('webrtc-adapter');
const browser = require('bowser');
const PeerConnection = require('./peerconnection');

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
        this.localStreams = [];
    }

    /**
     *  Declare fields
     */
    get localStream() {
        // get index 0
        return this.localStreams.length > 0 ? this.localStreams[0] : null;
    }

    /**
     * Private methods
     */
    _removeStream(stream) {
        let index = this.localStreams.indexOf(stream);
        if (index > -1) {
            this.localStream.splice(index, 1);
        }
    }

    setPeerConnectionConfig(config, constraints) {
        this.config.peerConnectionConfig = config;
        this.config.peerConnectionConstraints = constraints;
    }

    isAllTracksEnded(stream) {
        let isEnded = true;
        for (let track of stream.getTracks()) {
            if (track.readyState !== 'ended') {
                isEnded = false;
                break;
            }
        }
        return isEnded;
    }

    addLocalStream(stream) {
        this.localStreams.push(stream);
    }

    createPeerConnection(options) {
        options = options || {};
        options.parent = this;
        let peer = new PeerConnection(options);
        this.peers.push(peer);
        return peer;
    }

    removePeerConnection(stream) {
        let index = this.peers.indexOf(stream);
        if (index) {
            this.peers.splice(index, 1);
        }
    }

    removePeerConnectionById(id) {
        this.peers.some(peer => {
            if (peer.id == id) {
                peer.end();
                return true;
            }
        });
    }

    isPlanB() {
        if (browser.chrome || browser.chromium || browser.opera)
            return true;
        else return false;
    }

}
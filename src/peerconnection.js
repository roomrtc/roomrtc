const events = require("eventemitter2");
const adapter = require("webrtc-adapter");

const EventEmitter = events.EventEmitter2;

module.exports = class PeerConnection extends EventEmitter {

    constructor(config, constraints) {
        super();
        this.logger = console;
        this.config = config || {};
        this.config.iceServers = this.config.iceServers || [];
        this.config.constraints = this.config.constraints || {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        }

        this.id = this.config.id;
        this.sid = this.config.sid || Date.now().toString();
        this.parent = this.config.parent;
        this.localStream = null;

        this.pc = this.createRTCPeerConnection(config, constraints);

        // bind event to handle peer message
        this.getLocalStreams = this.pc.getLocalStreams.bind(this.pc);
        this.getRemoteStreams = this.pc.getRemoteStreams.bind(this.pc);

        // expose event from peer connection
        this.pc.onaddstream = this.emit.bind(this, "addStream");
        this.pc.onremovestream = this.emit.bind(this, "removeStream");
        this.pc.onnegotiationneeded = this.emit.bind(this, "negotiationNeeded");

        // private event handler
        this.pc.onicecandidate = this._onIceCandidate.bind(this);
        this.pc.ondatachannel = this._onDataChannel.bind(this);

        // proxy events to parent
        this.onAny((event, value) => {
            this.logger.debug("PeerConnection onAny event:", event, value);
            this.parent.emit.call(this.parent, event, value);
        });

        // own events processing
        // send offerMsg to signaling server
        this.on("offer", offerMsg => {
            this.send("offer", offerMsg);
        });

        // send answerMsg to signaling server
        this.on("answer", answerMsg => {
            this.send("answer", answerMsg);
        });

    }

    /**
     * check browser supports webrtc
     */
    isSupportsPeerConnections() {
        return typeof RTCPeerConnection !== 'undefined';
    };

    createRTCPeerConnection(config, constraints) {
        if (this.isSupportsPeerConnections()) {
            return new RTCPeerConnection(config, constraints);
        } else {
            throw "The browser does not support WebRTC (RTCPeerConnection)";
        }
    }

    start() {
        this.offer(this.config.constraints);
    }

    /**
     * handle peer message
     */
    offer(constraints, callback) {
        callback = callback || (() => 1);
        var mediaConstraints = constraints || this.config.constraints;
        if (this.pc.signalingState === 'closed') return callback("Signaling state is closed");

        // create offer
        this.pc.createOffer(description => {
            let offerMsg = {
                type: "offer",
                sdp: description.sdp
            }
            this.pc.setLocalDescription(description, () => {
                this.logger.debug("create offer success");
                this.emit("offer", offerMsg);
                callback(null);
            }, (err) => {
                this.emit("error", err);
                callback(err);
            });
        }, (err) => {
            this.emit("error", err);
            callback(err);
        }, mediaConstraints);
    }

    /**
     * Create sdp answer
     */
    answer(constrains, callback) {
        callback = callback || (() => 1);
        var mediaConstraints = constrains || this.config.constrains;

        if (this.pc.signalingState === 'closed') return callback("Signaling state is closed");

        // create an answer
        this.pc.createAnswer(description => {
            let answerMsg = {
                type: "answer",
                sdp: description.sdp
            }
            this.pc.setLocalDescription(description, () => {
                this.logger.debug("create answer success");
                this.emit("answer", answerMsg);
                callback(null);
            }, (err) => {
                this.emit("error", err);
                callback(err);
            });
        }, (err) => {
            this.emit("error", err);
            callback(err);
        }, mediaConstraints);
    }

    processMessage(msg) {
        this.logger.warn("Not implemented");

        if (msg.type === "offer") {

        } else if (msg.type === "answer") {
            
        }

    }

    /**
     * Close the peer connection
     */
    close() {
        this.pc.close();
        this.emit("close");
    }

    /**
     * Add localStream to the peer connection
     */
    addStream(stream) {
        this.localStream = stream;
        this.pc.addStream(stream);
    }

    /**
     * Internal methods
     */
    _onIceCandidate(event) {
        if (event.candidate) {
            let iceCandidate = new RTCIceCandidate(event.candidate);
            this.pc.addIceCandidate(iceCandidate);
            this.logger.debug("Remote ICE candidate: ", event.candidate.candidate);
            this.emit("ice", event);
        } else {
            this.logger.debug("iceEnd_onIceCandidate", event);
            this.emit("iceEnd");
        }
    }

    _onDataChannel(event) {
        let channel = event.channel;
        this.logger.debug("add new channel:", channel);
        this.emit("addChannel", channel);
    }

    /**
     * Handle message
     */
    // send via signaling channel
    send(msgType, payload) {
        let msg = {
            to: this.id,
            sid: this.sid,
            type: msgType,
            payload: payload
        }
        this.logger.debug("sending", msgType, msg);
        this.parent.emit("message", msg);
    }


}
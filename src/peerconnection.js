const events = require("eventemitter2");
const adapter = require("webrtc-adapter");

const EventEmitter = events.EventEmitter2;

// TODO: Change class name PeerConnection to Peer
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
        this.config.mediaAnswerConstraints = {
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            }
        }

        this.id = this.config.id;
        this.sid = this.config.sid || Date.now().toString();
        this.parent = this.config.parent;
        this.localStream = this.parent.localStream;
        this.stream = null;

        this.pc = this.createRTCPeerConnection(this.parent.config.peerConnectionConfig, this.parent.config.peerConnectionConstraints);
        this.pc.addStream(this.localStream);

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
            this.logger.info('send msg offer', offerMsg);
            this.send("offer", offerMsg);
        });

        // send answerMsg to signaling server
        this.on("answer", answerMsg => {
            this.send("answer", answerMsg);
        });

        // send candidateMsg
        this.on("iceCandidate", candidate => {
            this.send("iceCandidate", candidate);
        });

        this.on('iceEnd', offerMsg => {
            this.parent.emit('iceEnd', this, offerMsg);
        });

        this.on("addStream", event => {
            // TODO: Support multiple streams, save them to Set ?
            this.stream = event.stream;
            this.stream.psid = `${this.id || this.sid}_${this.stream.id}`;

            for (let track of this.stream.getTracks()) {
                track.addEventListener("ended", () => {
                    if (this.isAllTracksEnded(this.stream)) {
                        this.logger.debug("stream ended, id:", this.id);
                        this.end();
                    }
                    // notify
                    this.parent.emit('removetrack', track);
                });
            }

            this.stream.addEventListener('addtrack', (event) =>
			{
				let track = event.track;

				this.logger.debug('stream "addtrack" event [track:%o]', track);
                this.parent.emit('addtrack', track);

				// Firefox does not implement 'stream.onremovetrack' so let's use 'track.ended'.
				// But... track "ended" is neither fired.
				// https://bugzilla.mozilla.org/show_bug.cgi?id=1347578
				track.addEventListener('ended', () =>
				{
					this.logger.debug('track "ended" event [track:%o]', track);
                    this.end();
					
                    this.parent.emit('removetrack', track);
				});
            });

            this.parent.emit("peerStreamAdded", this);
        });

    }

    /**
     * check browser supports webrtc
     */
    isSupportsPeerConnections() {
        return typeof RTCPeerConnection !== 'undefined';
    };

    isAllTracksEnded(stream) {
        for (let track of stream.getTracks()) {
            if (track.readyState !== 'ended') {
                return false;
            }
        }
        return true;
    }

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

    end() {
        if (this.isClosed) return;

        this.close();
        this.isClosed = true;
        this.parent.removePeerConnection(this);
        this.parent.emit("peerStreamRemoved", this);
    }

    /**
     * Process local messages
     */
    offer(constraints, cb) {
        var callback = this._safeCallback(cb);
        var mediaConstraints = constraints || this.config.constraints;
        if (this.pc.signalingState === 'closed') return callback("Signaling state is closed");

        // create offer
        this.pc.createOffer(description => {
            let offerMsg = {
                type: "offer",
                sdp: description.sdp
            }
            if (this.config.connectMediaServer) {
                return this.emit("offer", offerMsg);
            }
            // set local sdp
            this.pc.setLocalDescription(description, () => {
                this.logger.debug("create offer success");
                if (!cb) {
                    this.emit("offer", offerMsg);
                } else {
                    callback(null, offerMsg);
                }
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
    answer(constraints, callback) {
        callback = this._safeCallback(callback);
        var mediaConstraints = constraints || this.config.mediaAnswerConstraints;

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
                callback(null, answerMsg);
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
     * Process remote messages
     */
    processMessage(msg) {
        this.logger.debug("Preparing proccess peer message", msg.type, msg);

        if (msg.type === "offer") {
            this.processMsgOffer(msg.payload, err => {
                if (!err) {
                    this.answer(this.config.mediaAnswerConstraints, err => {
                        if (err) {
                            this.logger.error("Cannot create an answer message", err, msg);
                        } else {
                            this.logger.info("Sent the answer message to ", msg);
                        }
                    });
                } else {
                    this.logger.error("Cannot process msgOffer:", err);
                }
            });
        } else if (msg.type === "answer") {
            this.processMsgAnswer(msg.payload, err => {
                if (err) {
                    this.logger.error('Cannot process msgAnswer:', err, msg);
                }
            });
        } else if (msg.type === "iceCandidate") {
            this.processMsgCandidate(msg.payload, err => {
                if (err) {
                    this.logger.error('Cannot process msgCandidate:', err, msg);
                }
            });
        } else if (msg.type === "welcome") {
            this.emit("welcome", msg);
        } else {
            this.logger.warn("Unknow message", msg);
        }

    }

    processMsgOffer(msgOffer, callback) {
        callback = this._safeCallback(callback);
        let description = new RTCSessionDescription(msgOffer);
        this.pc.setRemoteDescription(description, () => {
            callback(null);
        }, err => {
            callback(err);
        });
    }

    processMsgAnswer(msgAnswer, callback) {
        callback = this._safeCallback(callback);
        let description = new RTCSessionDescription(msgAnswer);
        this.pc.setRemoteDescription(description, () => {
            callback(null);
        }, err => {
            callback(err);
        })
    }

    processMsgCandidate(msgIce, callback) {
        callback = this._safeCallback(callback);
        // IPv6 candidates are only accepted with a= syntax in addIceCandidate
        // https://bugs.chromium.org/p/webrtc/issues/detail?id=3669
        if (msgIce.candidate && msgIce.candidate.candidate.indexOf("a=") !== 0) {
            msgIce.candidate.candidate = "a=" + msgIce.candidate.candidate;
        }

        let iceCandidate = new RTCIceCandidate(msgIce.candidate);
        this.pc.addIceCandidate(iceCandidate, () => {}, (err) => {
            this.emit("error", err);
        });
        callback(null);
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
        this.logger.debug("Got the stream!");
        this.localStream = stream;
        this.pc.addStream(stream);
    }

    /**
     * Internal methods
     */
    _safeCallback(cb) {
        return cb || (() => 1);
    }

    _onIceCandidate(event) {
        if (event.candidate) {
            if (this.config.connectMediaServer) {
                // do nothing.
                this.logger.debug('Dont send ice candidate: ', this.id);
                return;
            }
            let ice = event.candidate;
            // let iceCandidate = new RTCIceCandidate(ice.candidate);
            // this.pc.addIceCandidate(iceCandidate);
            let iceCandidate = {
                candidate: {
                    candidate: ice.candidate,
                    sdpMid: ice.sdpMid,
                    sdpMLineIndex: ice.sdpMLineIndex
                }
            }
            // this.logger.debug("Got an ICE candidate: ", iceCandidate);
            this.emit("iceCandidate", iceCandidate);
        } else {
            this.logger.debug("iceEnd_onIceCandidate", event);
            let offerMsg = {
                type: "offer",
                sdp: this.pc.localDescription.sdp
            }
            this.emit("iceEnd", offerMsg);
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
'use strict';
const EventEmitter = require('events').EventEmitter;
const logger = require('signaling/logger')('Room');
const Peer = require('./peer');

class Room extends EventEmitter
{
    constructor(name) {
        super();
        this.setMaxListeners(Infinity);

        this._name = name;
        this._isClosed = false;
        this._peers = new Map();
    }

    get isClosed() {
        return this._isClosed;
    }

    get peers() {
        return Array.from(this.peers.values());
    }

    get name() {
        return this._name;
    }

    createPeer(peerId, socket) {
        logger.info('createPeer()', peerId);

        if (!socket) {
            return Promise.reject('Socket is required');
        }

        if (!peerId || typeof peerId !== 'string') {
            socket.close();
            return Promise.reject('peerId must be a string');
        }

        if (this._peers.has(peerId)) {
            socket.close();
            return Promise.reject(`Already exists a peer with the same name:  ${peerId}`);
        }

        let peer = new Peer(peerId, socket);
        this._peers.set(peerId, peer);

        // cache room on peer
        peer.room = this._name;
        // remove peer if it closes
        peer.on('close', () => {
            logger.info('Peer leave:', peer.id, 'remove from:', this._name);
            this._peers.delete(peer.id);
        });

        return Promise.resolve(peer);
    }

    hasPeer(peerId) {
        return this._peers.has(peerId);
    }

    getPeer(peerId) {
        return this._peers.get(peerId);
    }

    close() {
        logger.debug('preparing close the room:', this._name);
        if (this._isClosed) {
            logger.debug(`Room(${this._name}) is already closed`);
            return;
        }

        this._isClosed = true;

        // close all the peers
        this._peers.forEach((peer) => peer.close());
        this.emit('close', this._name);
    }

}

module.exports = Room;
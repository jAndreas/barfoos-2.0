'use strict';

import { win, doc, undef } from './domkit.js';
import io from 'socket.io-client';

const	socket = io( 'http://der-vegane-germane.de', {
	transports:	[ 'websocket' ]
});

const	maxTimeout	= 3000,
		connected	= false;

socket.on( 'reconnect_attempt', () => {
	socket.io.opts.transport = [ 'polling', 'websocket' ];
});

socket.on( 'connect', () => {
	connected = true;
	console.log('server connection established.');
});

socket.on( 'reconnect', attempts => {
	connected = true;
	console.log('server connection established.');
});

socket.on( 'connect_timeout', timeout => {
	connected = false;
	console.log('server connection timed out: ', timeout);
});

socket.on( 'disconnect', reason => {
	connected = false;
	console.log('server connection disconnected: ', reason);
});

socket.on( 'error', error => {
	console.log('server connection error: ', error);
});

let ServerConnection = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	init() {
		super.init && super.init( ...arguments );
	}

	send( data = { } ) {
		if( typeof data.type === 'string' && 'payload' in data ) {
			return new Promise( ( resolve, reject ) => {
				socket.emit( data.type, data.payload, response => {
					resolve( response );
				});

				win.setTimeout(() => {
					recject( `Server answer for ${ data.type } timed out.` );
				}, maxTimeout);
			});
		} else {
			this.error( `send() requires a type as string and a payload property.` );
		}
	}

	recv( data ) {
		return new Promise( ( resolve, reject ) => {
			socket.on( data.type, recvData => {
				resolve( recvData );
			});
		});
	}
}

export default ServerConnection;

'use strict';

import { win, doc, undef } from './domkit.js';
import io from 'socket.io-client';

const	socket = io( ENV_PROD ? 'http://der-vegane-germane.de' : 'http://dev.der-vegane-germane.de', {
			transports:	[ 'websocket' ]
		}),
		maxTimeout	= 3000;

let		connected	= false;

socket.on( 'reconnect_attempt', () => {
	connected = false;
	console.log('Reconnecting, also allowing xhr polling...');
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
				let responseTimeout = win.setTimeout(() => {
					if( this.id ) {
						reject( `Server answer for ${ data.type } timed out.` );
					}
				}, maxTimeout);

				socket.emit( data.type, data.payload, response => {
					win.clearTimeout( responseTimeout );

					try {
						this.handleServerReponse( response );
					} catch( ex ) {
						reject( ex );
					}

					if( this.id ) {
						resolve( response );
					}
				});
			});
		} else {
			this.error( `send() requires a type as string and a payload property.` );
		}
	}

	recv( data ) {
		return new Promise( ( resolve, reject ) => {
			socket.on( data.type, recvData => {
				try {
					this.handleServerReponse( response );
				} catch( ex ) {
					if( this.id ) {
						reject( ex );
					}
				}

				if( this.id ) {
					resolve( recvData );
				}
			});
		});
	}

	handleServerReponse( response ) {
		if( response.error || response.errorCode ) {
			// handle errors
			throw response.error || response.errorCode;
		}
	}
}

export default ServerConnection;

'use strict';

import { win, doc, undef } from './domkit.js';
import { makeClass } from './toolkit.js';
import Mediator from './mediator.js';
import io from 'socket.io-client';

const	socket = io( ENV_PROD ? 'https://der-vegane-germane.de' : 'https://dev.der-vegane-germane.de', {
			transports:	[ 'websocket' ],
			secure:		true
		}),
		maxTimeout	= 3000;

const	eventLoop	= makeClass( class ServerComEventLoop{ }, { id: 'ServerComEventLoop' } ).mixin( Mediator );

socket.on( 'reconnect_attempt', () => {
	if( ENV_PROD === false ) console.log('Reconnecting, also allowing xhr polling...');
	socket.io.opts.transport = [ 'polling', 'websocket' ];
});

socket.on( 'connect', () => {
	if( ENV_PROD === false ) console.log('server connection established.');
});

socket.on( 'reconnect', attempts => {
	eventLoop.fire( 'reconnect.server' );
	if( ENV_PROD === false ) console.log('server connection (re-) established.');
});

socket.on( 'connect_timeout', timeout => {
	if( ENV_PROD === false ) console.log('server connection timed out: ', timeout);
});

socket.on( 'disconnect', reason => {
	eventLoop.fire( 'disconnect.server' );
	if( ENV_PROD === false ) console.log('server connection disconnected: ', reason);
});

socket.on( 'error', error => {
	if( ENV_PROD === false ) console.log('server connection error: ', error);
});

let ServerConnection = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	init() {
		super.init && super.init( ...arguments );
	}

	send( { type = '', payload = { } } = { }, { noTimeout = false, simplex = false } = { } ) {
		let self = this;
		let responseTimeout;

		return new Promise( async ( resolve, reject ) => {
			if(!noTimeout ) {
				responseTimeout = win.setTimeout(() => {
					if( self.id ) {
						reject( `Server answer for ${ type } timed out.` );
					}
				}, maxTimeout);
			}

			socket.emit( type, payload, response => {
				win.clearTimeout( responseTimeout );

				try {
					self.handleServerResponse( response );
				} catch( ex ) {
					reject( ex );
				}

				if( self.id ) {
					resolve( response );
				}
			});

			if( simplex ) {
				resolve();
			}
		});
	}

	recv( type, callback ) {
		let self = this;

		socket.on( type, recvData => {
			try {
				self.handleServerResponse && self.handleServerResponse( recvData );
			} catch( ex ) {
				throw new Error( ex );
			}

			if( self.id ) {
				callback( recvData );
			}
		});
	}

	handleServerResponse( response ) {
		if( response.error || response.errorCode ) {
			// handle errors
			throw response.error || response.errorCode;
		}
	}
}

export default ServerConnection;

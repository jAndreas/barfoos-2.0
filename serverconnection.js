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

let		session		= null;

socket.on( 'reconnect_attempt', () => {
	if( ENV_PROD === false ) console.log('Reconnecting, also allowing xhr polling...');
	socket.io.opts.transport = [ 'polling', 'websocket' ];
});

socket.on( 'connect', () => {
	socket.sendBuffer = [ ];
	eventLoop.fire( 'connect.server' );
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
	eventLoop.fire( 'disconnect.server', reason );
	if( ENV_PROD === false ) console.log('server connection disconnected: ', reason);
});

socket.on( 'error', error => {
	if( ENV_PROD === false ) console.log('server connection error: ', error);
});

eventLoop.on( 'waitForConnection.server', () => socket.connected || new Promise(( res, rej ) => {
	socket.on( 'connect', () => res( true ) );
}));

eventLoop.on( 'startNewSession.server', user => {
	console.log('starting new session: ', user);
	session = Object.create( null );
	Object.assign( session, user );
});

eventLoop.on( 'userLogout.server', user => {
	session = null;
});

eventLoop.on( 'getUserSession.server', () => {
	return session;
});

let ServerConnection = target => class extends target {
	constructor() {
		super( ...arguments );

		this.instanceListeners = Object.create( null );
	}

	destroy() {
		for( let [ type, callback ] of Object.entries( this.instanceListeners ) ) {
			socket.removeListener( type, callback );
		}

		super.destroy && super.destroy( ...arguments );
	}

	send( { type = '', payload = { } } = { }, { noTimeout = false, simplex = false } = { } ) {
		let self = this;
		let responseTimeout;

		return new Promise( ( resolve, reject ) => {
			if(!noTimeout ) {
				responseTimeout = win.setTimeout(() => {
					if( self.id ) {
						reject( new Error( `Es konnte keine Verbindung zum Server aufgebaut werden (${ type }).` ) );
					}
				}, maxTimeout);
			}

			if( session ) {
				Object.assign( payload, session );
			}

			socket.emit( type, payload, response => {
				win.clearTimeout( responseTimeout );

				try {
					self.handleServerResponse( response );

					if( self.id ) {
						resolve( response );
					}
				} catch( ex ) {
					reject( ex );
					return;
				}
			});

			if( simplex ) {
				resolve();
			}
		});
	}

	recv( type, callback ) {
		let self = this;

		this.instanceListeners[ type ] = callback;

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
			throw new Error( response.error + ' (r)' || response.errorCode );
		}
	}
}

export default ServerConnection;

'use strict';

import { win, doc, undef } from './domkit.js';
import { MakeClass, isAgentCrawler } from './toolkit.js';
import Mediator from './mediator.js';
import io from 'socket.io-client';

const	socket = io( win.location.protocol + '//' + win.location.hostname, {
			transports:		isAgentCrawler ? [ 'polling' ] : [ 'websocket', 'polling' ],
			secure:			true,
			autoConnect:	false
		}),
		maxTimeout	= 5000;

const	eventLoop	= MakeClass( class ServerComEventLoop{ }, { id: 'ServerComEventLoop' } ).Mixin( Mediator );

let		session				= null,
		socketCloseTimeout	= null;

socket.on( 'reconnect_attempt', () => {
	if( ENV_PROD === false ) console.log('Reconnecting, also allowing for XHR.');
	socket.io.opts.transports = [ 'polling', 'websocket' ];
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
	session = Object.create( null );
	Object.assign( session, user );

	if( session ) {
		socket.emit( 'clientHasReturned', session );
	}
});

eventLoop.on( 'userLogout.server', user => {
	session = null;
});

eventLoop.on( 'getUserSession.server', () => {
	return session;
});

function idleWatcher( active ) {
	if( active ) {
		if(!socket.connected && socket.io.readyState !== 'opening' ) {
			if( ENV_PROD === false ) console.log('re-opening socket for client.');

			if(!isAgentCrawler ) {
				socket.open();
			}
		} else {
			if( ENV_PROD === false ) console.log('client returned, canceling timer for socket close.');
			win.clearTimeout( socketCloseTimeout );
			socketCloseTimeout = null;
		}
	} else {
		if( socketCloseTimeout === null ) {
			if( ENV_PROD === false ) console.log('client has gone idle, initiating timer for socket close.');

			win.clearTimeout( socketCloseTimeout );

			socketCloseTimeout = win.setTimeout(() => {
				//if( doc.visibilityState === 'hidden' ) {
					if( ENV_PROD === false ) console.log('client idle for 10 minutes, closing socket connection.');

					if( session ) {
						socket.emit( 'clientIsIdle', session );
					}

					socket.close();
				//}
			}, 60 * 1000 * 10);
		}
	}
}

eventLoop.on( 'appVisibilityChange.appEvents appFocusChange.appEvents', idleWatcher );

if(!isAgentCrawler ) {
	socket.open();
}

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

				if( response ) {
					try {
						self.handleServerResponse( response );

						if( self.id ) {
							resolve( response );
						} else {
							throw new Error( 'Unidentified or Obsolete Module Instance.' );
						}
					} catch( ex ) {
						reject( ex );
						return;
					}
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

	disableSocketAutoClose() {
		eventLoop.off( 'appVisibilityChange.appEvents', idleWatcher );
		win.clearTimeout( socketCloseTimeout );
	}

	tryReconnectServer() {
		socket.close();

		win.setTimeout(() => {
			socket.open();
		}, 2000);
	}

	handleServerResponse( response ) {
		if( response ) {
			if( response.error || response.errorCode ) {
				// handle errors
				throw new Error( response.error + ' (r)' || response.errorCode );
			}
		}
	}
}

export default ServerConnection;

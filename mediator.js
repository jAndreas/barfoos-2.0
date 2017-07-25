"use strict";

import { extend } from './toolkit.js';

const	registerContainer	= Object.create( null ),
		maxLoopTime			= 100,
		undef				= void 0;

class Mediator {
	constructor( data = { } ) {
		extend( this ).with( data );

		if( typeof this.register === 'string' ) {
			if( registerContainer[ this.register ] === undef ) {
				registerContainer[ this.register ] = Object.create( null );
			}

			this.container = registerContainer[ this.register ];
		} else {
			throw new TypeError( 'mediator register name must be a string.' );
		}
	}

	on( eName, handler, scope ) {
		if( typeof eName === 'string' && typeof handler === 'function' ) {
			for( let singleName of eName.split( /\s+/ ) ) {
				if( this.container[ singleName ] === undef ) {
					this.container[ singleName ] = [ ];
				}

				this.container[ singleName ].unshift({ handler: scope ? handler.bind( scope ) : handler });
			}
		} else {
			throw new TypeError( 'on() was called with wrong arguments.' );
		}

		return this;
	}

	off( eName, handler ) {
		if( typeof eName === 'string' ) {
			if( typeof handler === 'function' ) {
				this.container[ eName ] = this.container[ eName ].filter( eventData => eventData.handler !== handler );
			} else {
				delete this.container[ eName ];
			}
		} else {
			throw new TypeError( 'off() was called with wrong arguments.' );
		}
	}

	fire( eName, data = { }, callback ) {
		if( arguments.length === 2 && typeof data === 'function' ) {
			// just in case we want to dispatch an event without any data, but with a callback handler
			callback = data;
		}

		if( typeof eName === 'string' ) {
			if( this.container[ eName ] ) {
				return new Promise(( res, rej ) => {
					let listener		= this.container[ eName ],
						listenersMax	= listener.length - 1,
						resultData		= [ ],
						eventData, result, start;

					(function _asyncLoop() {
						start	= Date.now();

						do {
							eventData	= listener[ listenersMax ];
							result		= eventData.handler( data );

							// push whatever result was into data to our promises array
							resultData.push( result );

							// in case of a "per iteration" - callback, call it now with the current data
							if( typeof callback === 'function' ) {
								callback( result );
							}

							// returning false explicitly from an event handler just means to stop any further propagation
							if( data.stopPropagation ) {
								listenersMax = -1;
								break; // while()
							}

							listenersMax--;
						} while( listenersMax > -1 && Date.now() - start < maxLoopTime );

						// if there are still entries in our queue, we ran out of allowed dispatch time frame
						if( listenersMax > -1 ) {
							setTimeout( _asyncLoop, maxLoopTime );
						} else {
							Promise.all( resultData ).then( res, rej );
						}
					}());
				});
			}
		} else { throw new TypeError( 'event name must be a string.' ); }

		return Promise.resolve( 'fire() warning' );
	}
}

export { Mediator };

"use strict";

import { extend } from './toolkit.js';

const	namespaceContainer			= Object.create( null ),
		maxLoopTime					= 100,
		undef						= void 0;

		namespaceContainer.global	= Object.create( null );

let Mediator = target => class extends target {
	constructor( data = { } ) {
		super( ...arguments );

		extend( this ).with( data );
	}

	on( eventLocators, handler, scope ) {
		if( typeof eventLocators === 'string' && typeof handler === 'function' ) {
			for( let singleLocation of eventLocators.split( /\s+/ ) ) {
				let [ eventName, eventNameSpace = 'global' ] = singleLocation.split( '.' );

				if( namespaceContainer[ eventNameSpace ] === undef ) {
					namespaceContainer[ eventNameSpace ] = Object.create( null );
				}

				if( namespaceContainer[ eventNameSpace ][ eventName ] === undef ) {
					namespaceContainer[ eventNameSpace ][ eventName ] = [ ];
				}

				namespaceContainer[ eventNameSpace ][ eventName ].unshift({ handler: scope ? handler.bind( scope ) : handler });
			}
		} else {
			throw new TypeError( 'on() was called with wrong arguments.' );
		}

		return this;
	}

	off( eventLocators, handler ) {
		if( typeof eventLocators === 'string' ) {
			let eventName, eventNameSpace;

			for( let singleLocation of eventLocators.split( /\s+/ ) ) {
				[ eventName, eventNameSpace = 'global' ] = singleLocation.split( '.' );
			}

			if( eventNameSpace in namespaceContainer ) {
				if( typeof handler === 'function' ) {
					namespaceContainer[ eventNameSpace ][ eventName ] = namespaceContainer[ eventNameSpace ][ eventName ].filter( eventData => eventData.handler !== handler );
				} else {
					delete namespaceContainer[ eventNameSpace ][ eventName ];
				}
			} else {
				throw new Error( `There is no "${ eventNameSpace }" namespace.` );
			}

		} else {
			throw new TypeError( 'off() was called with wrong arguments.' );
		}
	}

	fire( eventLocators, data = { }, callback ) {
		if( arguments.length === 2 && typeof data === 'function' ) {
			// just in case we want to dispatch an event without any data, but with a callback handler
			callback = data;
		}

		if( typeof eventLocators === 'string' ) {
			let eventName, eventNameSpace;

			for( let singleLocation of eventLocators.split( /\s+/ ) ) {
				[ eventName, eventNameSpace = 'global' ] = singleLocation.split( '.' );
			}

			if( namespaceContainer[ eventNameSpace ] && namespaceContainer[ eventNameSpace ][ eventName ] ) {
				return new Promise(( res, rej ) => {
					let container		= namespaceContainer[ eventNameSpace ][ eventName ],
						listenersMax	= container.length - 1,
						resultData		= [ ],
						event			= Object.create( null ),
						listener, result, start;

					extend( event ).with({
						name:		eventName,
						namespace:	eventNameSpace,
						listeners:	container.length
					});

					(function _asyncLoop() {
						start	= Date.now();

						do {
							listener	= container[ listenersMax ];
							result		= listener.handler( data, event );

							// push whatever result was into data to our promises array
							resultData.push( result );

							// in case of a "per iteration" - callback, call it now with the current data
							if( typeof callback === 'function' ) {
								callback( result );
							}

							// setting "stopPropagation" to a truthy value within an means to stop any further propagation
							if( event.stopPropagation ) {
								listenersMax = -1;
								break; // while()
							}

							listenersMax--;
						} while( listenersMax > -1 && Date.now() - start < maxLoopTime );

						// if there are still entries in our queue, we ran out of allowed dispatch time frame
						if( listenersMax > -1 ) {
							setTimeout( _asyncLoop, maxLoopTime );
						} else {
							Promise.all( resultData ).then( localResult => {
								if( localResult.length === 1 ) {
									res( localResult[ 0 ] );
								} else {
									res( localResult );
								}
							}, rej );
						}
					}());
				});
			} else {
				this.log && this.log( `There is no listener for ${eventName} in ${eventNameSpace} at present. Async The has Matrix you?` );
			}
		} else { throw new TypeError( 'event name must be a string.' ); }

		return Promise.resolve( 'fire() warning' );
	}
}

export { Mediator };

'use strict'

import { extend, isMobileDevice } from './toolkit.js';

const		win			= window,
			doc			= win.document,
			undef		= void 0;

const		skippedPropagationElements	= /INPUT|BUTTON/,
			mappedMobileEvents			= Object.create( null ),
			touchStartPos				= Object.create( null );

if( isMobileDevice ) {
	mappedMobileEvents[ 'click' ]		= 'touchend';
	mappedMobileEvents[ 'mousedown' ]	= 'touchstart';
	mappedMobileEvents[ 'mouseup' ]		= 'touchend';
}

/*****************************************************************************************************
 * Mixin Class NodeTools: Provides some HTMLElement helper tools and magic trickery
 *****************************************************************************************************/
let NodeTools = target => class extends target {
	constructor() {
		super( ...arguments );

		this._alreadyDelegatedEvents = Object.create( null );

		this._delegatedEventHandler = (event) => {
			if( this.modalOverlay ) {
				return;
			}

			let callbackResult = [ ];

			if( this && Object.keys( this ).length && this.data ) {
				if( this.data.get( event.target ) ) {
					if( this.data.get( event.target ).events[ event.type ] ) {
						this.data.get( event.target ).events[ event.type ].every( fnc => {
							let retV = fnc.call( this, event );

							callbackResult.push( retV );

							if( retV === -1 ) {
								return false;
							} else {
								return true;
							}
						});

						if( callbackResult.indexOf( false ) > -1 ) {
							return false;
						}

						if( callbackResult.indexOf( -1 ) > -1 ) {
							return false;
						}
					}

					if( this && this.data && this.data.get( event.target ) === undef ) {
						this.cleanDelegations();
						return false;
					}

					if( this && this.data && this.data.get( event.target ).oneTimeEvents[ event.type ] ) {
						this.data.get( event.target ).oneTimeEvents[ event.type ].every( fnc => {
							let retV = fnc.call( this, event );

							callbackResult.push( retV );

							if( retV === -1 ) {
								return false;
							}
						});

						if( callbackResult.indexOf( false ) > -1 ) {
							return false;
						}

						this.data.get( event.target ).oneTimeEvents[ event.type ] = [ ];
						this.cleanDelegations();
					}
				}

				if( event.target && event.target.parentElement ) {
					/*if( skippedPropagationElements.test( event.target.nodeName ) ) {
						if( event.target.getAttribute( 'type' ) !== 'text') {
							return false;
						}
					}*/

					if( event.target.classList.contains( 'noPropagation' ) ) {
						return false;
					}

					let root	= Object.keys( this.dialogElements ).length ? this.dialogElements.root : this.nodes.root,
						shadow	= Object.create( null ),
						filter	= {
							get:	function( target, prop ) {
								if( prop in shadow ) {
									return shadow[ prop ];
								} else {
									if( typeof target[ prop ] === 'function' ) {
										return target[ prop ].bind( event );
									} else {
										return target[ prop ];
									}
								}
							},
							set:	function( target, prop, value ) {
								shadow[ prop ] = value;
								return true;
							}
						},
					ev		= new Proxy( event, filter );

					while( ev.target && ev.target !== root ) {
						ev.originalTarget	= ev.target;
						ev.target			= ev.target.parentElement;
						if( this._delegatedEventHandler( ev, event ) === false ) {
							return false;
						}
					}
				}
			}
		};
	}

	addNodeEvent( nodes, types, fnc ) {
		if( typeof nodes === 'string' ) {
			nodes = nodes.split( /\s+|,\s+/ );
		} else if( nodes instanceof HTMLElement ) {
			nodes = [ nodes ];
		} else if( Array.isArray( nodes ) ) {
			nodes = nodes;
		} else {
			this.error( `Wrong argument types.` );
		}

		if( typeof types === 'string' ) {
			types = types.split( /\s+|,\s+/ );
		} else {
			this.error( `Parameter "types" must be a String (possibly separated by whitespaces or commas), received ${typeof type} instead.` );
		}

		for( let node of nodes ) {
			if( typeof node === 'string' ) {
				node = this.nodes[ node ] || this.dialogElements[ node ];
			}

			if( node instanceof HTMLElement ) {
				for( let type of types ) {
					type = mappedMobileEvents[ type ] || type;

					if( type === 'touchend' ) {
						node.addEventListener( 'touchstart', this.hitMarker, false );
						node.addEventListener( 'touchend', this.hitMarkerCheck, false );
					}

					if(!this._alreadyDelegatedEvents[ type ] ) {
						this._alreadyDelegatedEvents[ type ] = true;

						if( this.dialogElements && Object.keys( this.dialogElements ).length ) {
							this.dialogElements.root.addEventListener( type, this._delegatedEventHandler, false );
						} else {
							this.nodes.root.addEventListener( type, this._delegatedEventHandler, false );
						}
					}

					if( this.data.get( node ).events[ type ] === undef ) {
						this.data.get( node ).events[ type ] = [ ];
					}

					if( this.data.get( node ).events[ type ].indexOf( fnc ) === -1 ) {
						this.data.get( node ).events[ type ].push( fnc );
					} else {
						this.warn( node, `identical event handlers are not allowed ->`, fnc );
					}
				}
			} else {
				this.error( `Parameter "node" must be of type HTMLElement or String (referencing a valid node-name).` );
			}
		}
	}

	addNodeEventOnce( node, types, fnc ) {
		if( typeof node === 'string' ) {
			node = this.nodes[ node ] || this.dialogElements[ node ];
		}

		if( typeof types === 'string' ) {
			types = types.split( /\s+/ );
		} else {
			this.error( `Parameter "types" must be a String (possibly separated by whitespaces), received ${typeof type} instead.` );
		}

		if( node instanceof HTMLElement ) {
			for( let type of types ) {
				type = mappedMobileEvents[ type ] || type;

				if( type === 'touchend' ) {
					node.addEventListener( 'touchstart', this.hitMarker, false );
					node.addEventListener( 'touchend', this.hitMarkerCheck, false );
				}

				if(!this._alreadyDelegatedEvents[ type ] ) {
					this._alreadyDelegatedEvents[ type ] = true;

					if( Object.keys( this.dialogElements ).length ) {
						this.dialogElements.root.addEventListener( type, this._delegatedEventHandler, false );
					} else {
						this.nodes.root.addEventListener( type, this._delegatedEventHandler, false );
					}
				}

				if( this.data.get( node ).oneTimeEvents[ type ] === undef ) {
					this.data.get( node ).oneTimeEvents[ type ] = [ ];
				}

				if( this.data.get( node ).oneTimeEvents[ type ].indexOf( fnc ) === -1 ) {
					this.data.get( node ).oneTimeEvents[ type ].push( fnc );
				} else {
					this.warn( node, `identical event handlers are not allowed ->`, fnc );
				}
			}
		} else {
			this.error( `node must be of type HTMLElement, received ${ typeof node } instead.` );
		}
	}

	removeNodeEvent( node, types, fnc ) {
		if( typeof node === 'string' ) {
			node = this.nodes[ node ] || this.dialogElements[ node ];
		}

		if( typeof types === 'string' ) {
			types = types.split( /\s+/ );
		} else {
			this.error( `Parameter "types" must be a String (possibly separated by whitespaces), received ${typeof type} instead.` );
		}

		if( node instanceof HTMLElement ) {
			for( let type of types ) {
				type = mappedMobileEvents[ type ] || type;

				if( type === 'touchend' ) {
					node.removeEventListener( 'touchstart', this.hitMarker, false );
					node.removeEventListener( 'touchend', this.hitMarkerCheck, false );
				}

				if( typeof fnc === 'function' ) {
					if( Array.isArray( this.data.get( node ).events[ type ] ) ) {
						this.data.get( node ).events[ type ] = this.data.get( node ).events[ type ].filter( currentFnc => currentFnc !== fnc );
					}

					if( Array.isArray( this.data.get( node ).oneTimeEvents[ type ] ) ) {
						this.data.get( node ).oneTimeEvents[ type ] = this.data.get( node ).oneTimeEvents[ type ].filter( currentFnc => currentFnc !== fnc );
					}
				} else if( fnc === undef ) {
					if( type ) {
						if( Array.isArray( this.data.get( node ).events[ type ] ) ) {
							this.data.get( node ).events[ type ] = [ ];
						}

						if( Array.isArray( this.data.get( node ).oneTimeEvents[ type ] ) ) {
							this.data.get( node ).oneTimeEvents[ type ] = [ ];
						}
					} else {
						this.data.get( node ).events = Object.create( null );
						this.data.get( node ).oneTimeEvents = Object.create( null );
					}
				}
			}

			this.cleanDelegations();
		} else {
			this.error( `node must be of type HTMLElement, received ${ typeof node } instead.` );
		}
	}

	removeAllNodeEvents( types = '' ) {
		if( typeof types === 'string' ) {
			types = types.split( /\s+/ ).filter( Boolean );
		} else {
			this.error( `Parameter "types" must be a String (possibly separated by whitespaces), received ${typeof type} instead.` );
		}

		for( let type of types ) {
			for( let [ key, node ] of Object.entries( this.nodes ) ) {
				if( types.length ) {
					if( this.data.get( node ).events[ type ] ) {
						this.data.get( node ).events[ type ] = null;
						delete this.data.get( node ).events[ type ];
					}
				} else {
					this.data.get( node ).events = Object.create( null );
				}
			}

			for( let [ key, node ] of Object.entries( this.dialogElements ) ) {
				if( types.length ) {
					if( this.data.get( node ).events[ type ] ) {
						this.data.get( node ).events[ type ] = null;
						delete this.data.get( node ).events[ type ];
					}
				} else {
					this.data.get( node ).events = Object.create( null );
				}
			}

			if( this._alreadyDelegatedEvents[ type ] ) {
				delete this._alreadyDelegatedEvents[ type ];
			}
		}

		this.cleanDelegations( true );
	}

	cleanDelegations( force ) {
		let validDelegation;

		for( let delegatedEvent in this._alreadyDelegatedEvents ) {
			validDelegation = false;

			for( let [ key, node ] of Object.entries( this.nodes ) ) {
				let nodeData			= this.data.get( node );

				if( nodeData ) {
					let persistEvents	= this.data.get( node ).events[ delegatedEvent ],
						oneTimeEvents	= this.data.get( node ).oneTimeEvents[ delegatedEvent ];

					if( (persistEvents && persistEvents.length) || (oneTimeEvents && oneTimeEvents.length) ) {
						validDelegation = true;
						break;
					}
				}
			}

			for( let [ key, node ] of Object.entries( this.dialogElements ) ) {
				let nodeData			= this.data.get( node );

				if( nodeData ) {
					let persistEvents		= this.data.get( node ).events[ delegatedEvent ],
						oneTimeEvents		= this.data.get( node ).oneTimeEvents[ delegatedEvent ];

					if( (persistEvents && persistEvents.length) || (oneTimeEvents && oneTimeEvents.length) ) {
						validDelegation = true;
						break;
					}
				}
			}

			if(!validDelegation || force ) {
				delete this._alreadyDelegatedEvents[ delegatedEvent ];

				if( Object.keys( this.dialogElements ).length ) {
					this.dialogElements.root.removeEventListener( delegatedEvent, this._delegatedEventHandler );
				} else {
					this.nodes.root.removeEventListener( delegatedEvent, this._delegatedEventHandler );
				}
			}
		}
	}

	resolveNodeNameFromRef( ref ) {
		for( let [ name, nodeRef ] of Object.entries( this.nodes ) ) {
			if( nodeRef === ref ) {
				return name;
			}
		}

		for( let [ name, nodeRef ] of Object.entries( this.dialogElements ) ) {
			if( nodeRef === ref ) {
				return name;
			}
		}
	}

	animate( { node, id = 'last', rules:{ delay = 0, duration = 200, timing = 'linear', iterations = 1, direction = 'normal', mode = 'forwards', name = '' } = { } } = { } ) {
		let rules = { delay, duration, timing, iterations, direction, mode, name };

		let promise = new Promise(async ( res, rej ) => {
			if( node instanceof HTMLElement ) {
				let store			= this.data.get( node ).storage,
					cancelOrigin	= null;

				//if( store.animations[ id ] ) {
				//	this.warn( `It seems like there is a pending or finished transition for ${ node } - ID: ${ id }.` );
				//	res();
				//}

				store.animations.running = store.animations.running || [ ];

				node.style.animation = `${ duration }ms ${ timing } ${ delay }ms ${ iterations } ${ direction } ${ mode } ${ name }`;

				this.addNodeEventOnce( node, 'animationend', animationEndEvent );

				cancelOrigin = win.setTimeout(() => {
					if( this && Object.keys( this ).length ) {
						try {
							this.data.get( node ).storage.animations.running = [ ];
							res( 'animation timed out');
						} catch( ex ) {
							/* noop */
						}
					}
				}, duration + delay + (duration*0.3));

				function animationEndEvent( event ) {
					let options = {
						undo:		() => {
							let undoPromise = new Promise(( undoRes, undoRej ) => {
								let cancelUndo	= null,
									undoEnd		= event => {
										node.style.animationDelay = '';
										node.style.animationDuration = '';
										node.style.animationName = '';
										node.style.animationTimingFunction = '';
										node.style.animationIterationCount = '';
										node.style.animationDirection = '';
										node.style.animationFillMode = '';
										node.style.animationPlayState = '';

										delete this.data.get( node ).storage.animations[ id ];

										win.clearTimeout( cancelUndo );
										undoRes( event );
									};

								this.addNodeEventOnce( node, 'animationend', undoEnd );

								node.style.animation = '';
								this.reflow();
								node.style.animation = `${ name } ${ duration }ms ${ timing } ${ delay }ms ${ iterations } reverse ${ mode }`;

								cancelUndo = win.setTimeout(() => {
									if( this && Object.keys( this ).length ) {
										try {
											this.data.get( node ).storage.animations.running = [ ];
											res( 'animation (undo) timed out');
										} catch( ex ) {
											/* noop */
										}
									}
								}, duration + delay + (duration*0.3));
							});

							let running = this.data.get( node ).storage.animations.running;

							undoPromise.then(() => running.splice( running.indexOf( undoPromise ), 1 ), () => running.splice( running.indexOf( undoPromise ), 1 ) );

							this.data.get( node ).storage.animations.running.push( undoPromise );

							return undoPromise;
						},
						finalize:	() => {
							node.style.animation = '';
							delete this.data.get( node ).storage.animations[ id ];
						}
					};

					//store.animations[ id ] = options;

					win.clearTimeout( cancelOrigin );
					res( options );

					return false;
				}
			} else {
				rej( `node must be of type HTMLElement, received ${ typeof node } instead.` );
			}
		});

		let running = this.data.get( node ).storage.animations.running;
		promise.then(() => running.splice( running.indexOf( promise ), 1 ), () => running.splice( running.indexOf( promise ), 1 ) );

		this.data.get( node ).storage.animations.running.push( promise );

		return promise;
	}

	transition( { node, style, className, id = 'last', rules:{ delay = '0', duration = 200, property = 'all', timing = 'linear' } = { } } = { } ) {
		let rules = { delay, duration, property, timing };

		return new Promise(async ( res, rej ) => {
			let oldStyleValues = Object.create( null );

			if( node instanceof HTMLElement ) {
				if( this.data.get( node ) === undef ) {
					this.data.set(node, {
						storage:		{
							animations:		{
								running:	[ ]
							},
							nodeData:		{ }
						},
						temp:			true
					});
				}

				let store = this.data.get( node ).storage;

				if( store.transitions === undef ) {
					store.transitions = Object.create( null );
				}

				if( store.transitions[ id ] ) {
					rej( `It seems like there is a pending transition for ${ node } - ID: ${ id }.` );
				}

				node.style.transition = `${ property } ${ duration }ms ${ timing } ${ delay }ms`;

				if( typeof style === 'object' ) {
					for( let [ name, newValue ] of Object.entries( style ) ) {
						oldStyleValues[ name ]	= newValue.from;
						node.style[ name ]		= newValue.to;
					}
				}

				if( typeof className === 'string' ) {
					className = className.split( /\s+/ );
					className.forEach( cls => node.classList.add( cls ) );
				} else {
					className = [ ];
				}

				await this.timeout( duration );

				let options = {
					undo:		() => {
						return new Promise(async ( undoRes, undoRej ) => {
							//node.style.transition = '';
							//node.style.transition = `${ property } ${ duration }ms ${ timing } ${ delay }ms`;

							for( let [ name, oldValue ] of Object.entries( oldStyleValues ) ) {
								this.reflow();
								node.style[ name ] = oldValue;
							}

							className.forEach( cls => node.classList.remove( cls ) );

							await this.timeout( duration );

							node.style.transitionDelay = '';
							node.style.transitionDuration = '';
							node.style.transitionProperty = '';
							node.style.transitionTimingFunction = '';

							delete this.data.get( node ).storage.transitions[ id ];

							if( this.data.get( node ).temp ) {
								this.data.delete( node );
							}

							undoRes();
						});
					},
					finalize:	() => {
						node.style.transition = '';
						delete this.data.get( node ).storage.transitions[ id ];
					}
				};

				//store.transitions[ id ] = options;

				res( options );
			} else {
				rej( `node must be of type HTMLElement, received ${ typeof node } instead.` );
			}
		});
	}

	reflow( element ) {
		doc.body.offsetHeight;
	}

	hitMarker( event ) {
		if( event.changedTouches && event.changedTouches.length ) {
			this.touchStartPos = event.changedTouches[ 0 ];
		} else {
			this.touchStartPos = { pageX: event.pageX, pageY: event.pageY };
		}
	}

	hitMarkerCheck( event ) {
		let touchEndPos;

		if(!this.touchStartPos	) {
			return false;
		}
		
		if( event && event.changedTouches && event.changedTouches.length ) {
			touchEndPos = event.changedTouches[ 0 ];
		} else {
			touchEndPos	= event;
		}

		if( event === 0 || (Math.abs( this.touchStartPos.pageX - touchEndPos.pageX ) < 10 && Math.abs( this.touchStartPos.pageY - touchEndPos.pageY ) < 10) ) {
			event.CLICKRANGE = true;
		} else {
			try {
				event.preventDefault();
				event.stopPropagation();
			} catch( ex ) {
				console.log( ex.message );
			}

			return false;
		}
	}
};

export default NodeTools;

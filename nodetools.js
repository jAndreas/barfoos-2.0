'use strict'

import { extend } from './toolkit.js';

const		win			= window,
			doc			= win.document,
			undef		= void 0;

const		skippedPropagationElements = /INPUT|BUTTON/;

/*****************************************************************************************************
 * Mixin Class NodeTools: Provides some HTMLElement helper tools and magic trickery
 *****************************************************************************************************/
let NodeTools = target => class extends target {
	constructor() {
		super( ...arguments );

		this._alreadyDelegatedEvents = Object.create( null );

		this._delegatedEventHandler = event => {
			let callbackResult;

			if( this && this.data ) {
				if( this.data.get( event.target ) ) {
					if( this.data.get( event.target ).events[ event.type ] ) {
						this.data.get( event.target ).events[ event.type ].forEach( fnc => callbackResult = fnc.call( this, event ) );

						if( callbackResult === false ) {
							return false;
						}
					}

					if( this.data.get( event.target ).oneTimeEvents[ event.type ] ) {
						this.data.get( event.target ).oneTimeEvents[ event.type ].forEach( fnc => callbackResult = fnc.call( this, event ) );

						if( callbackResult === false ) {
							return false;
						}

						this.data.get( event.target ).oneTimeEvents[ event.type ] = [ ];
						this.cleanDelegations();
					}
				}

				if( event.target && event.target.parentElement ) {
					if( skippedPropagationElements.test( event.target.nodeName ) ) {
						return;
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
								return prop in shadow ? shadow[ prop ] : target[ prop ];
							},
							set:	function( target, prop, value ) {
								shadow[ prop ] = value;
								return true;
							}
						},
					ev		= new Proxy( event, filter );

					while( ev.target && ev.target !== root ) {
						ev.target	= ev.target.parentElement;
						if( this._delegatedEventHandler( ev, event ) === false ) {
							return false;
						}
					}
				}
			}
		};
	}

	addNodeEvent( node, types, fnc ) {
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
				if(!this._alreadyDelegatedEvents[ type ] ) {
					this._alreadyDelegatedEvents[ type ] = true;

					if( Object.keys( this.dialogElements ).length ) {
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
					this.error( node, `identical event handlers are not allowed ->`, fnc );
				}
			}
		} else {
			this.error( `Parameter "node" must be of type HTMLElement or String (referencing a valid node-name).` );
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
					this.error( node, `identical event handlers are not allowed ->`, fnc );
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
			types = types.split( /\s+/ );
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

		this.cleanDelegations();
	}

	cleanDelegations() {
		let validDelegation;

		for( let delegatedEvent in this._alreadyDelegatedEvents ) {
			validDelegation = false;

			for( let [ key, node ] of Object.entries( this.nodes ) ) {
				let persistEvents	= this.data.get( node ).events[ delegatedEvent ],
					oneTimeEvents	= this.data.get( node ).oneTimeEvents[ delegatedEvent ];

				if( (persistEvents && persistEvents.length) || (oneTimeEvents && oneTimeEvents.length) ) {
					validDelegation = true;
					break;
				}
			}

			for( let [ key, node ] of Object.entries( this.dialogElements ) ) {
				let persistEvents	= this.data.get( node ).events[ delegatedEvent ],
					oneTimeEvents	= this.data.get( node ).oneTimeEvents[ delegatedEvent ];

				if( (persistEvents && persistEvents.length) || (oneTimeEvents && oneTimeEvents.length) ) {
					validDelegation = true;
					break;
				}
			}

			if(!validDelegation ) {
				delete this._alreadyDelegatedEvents[ delegatedEvent ];

				if( Object.keys( this.dialogElements ).length ) {
					this.dialogElements.root.removeEventListener( delegatedEvent, this._delegatedEventHandler );
				} else {
					this.nodes.root.removeEventListener( delegatedEvent, this._delegatedEventHandler );
				}
			}
		}
	}

	resolveNodeNameFrom( ref ) {
		for( let [ name, nodeRef ] of Object.entries( this.nodes ) ) {
			if( nodeRef === ref ) {
				return name;
			}
		}
	}

	animate( { node, id = 'last', rules:{ delay = '0', duration = 200, timing = 'linear', iterations = 1, direction = 'normal', mode = 'forwards', name = '' } = { } } = { } ) {
		let rules = { delay, duration, timing, iterations, direction, mode, name };

		let promise = new Promise(( res, rej ) => {
			if( node instanceof HTMLElement ) {
				let store = this.data.get( node ).storage;

				if( store.animations[ id ] ) {
					rej( `It seems like there is a pending transition for ${ node } - ID: ${ id }.` );
				}

				store.animations.running = store.animations.running || [ ];

				node.style.animation = `${ duration }ms ${ timing } ${ delay }ms ${ iterations } ${ direction } ${ mode } ${ name }`;

				this.addNodeEventOnce( node, 'animationend', animationEndEvent );

				function animationEndEvent( event ) {
					let options = {
						undo:		() => {
							let undoPromise = new Promise(( undoRes, undoRej ) => {
								let undoEnd = event => {
									node.style.animationDelay = '';
									node.style.animationDuration = '';
									node.style.animationName = '';
									node.style.animationTimingFunction = '';
									node.style.animationIterationCount = '';
									node.style.animationDirection = '';
									node.style.animationFillMode = '';
									node.style.animationPlayState = '';

									delete this.data.get( node ).storage.animations[ id ];

									undoRes( event );
								};

								this.addNodeEventOnce( node, 'animationend', undoEnd );

								node.style.animation = '';
								this.reflow();
								node.style.animation = `${ name } ${ duration }ms ${ timing } ${ delay }ms ${ iterations } reverse ${ mode }`;
							});

							let running = this.data.get( node ).storage.animations.running;
							undoPromise.then(() => running.splice( running.indexOf( undoPromise ), 1 ), () => running.splice( running.indexOf( undoPromise ), 1 ) );

							this.data.get( node ).storage.animations.running.push( undoPromise );

							return false;
						},
						finalize:	() => {
							node.style.animation = '';
							delete this.data.get( node ).storage.animations[ id ];
						}
					};

					store.animations[ id ] = options;

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
						oldStyleValues[ name ]	= node.style[ name ];
						node.style[ name ]		= newValue;
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
							for( let [ name, oldValue ] of Object.entries( oldStyleValues ) ) {
								node.style[ name ] = oldValue;
							}

							className.forEach( cls => node.classList.remove( cls ) );

							await this.timeout( duration );

							node.style.transitionDelay = '';
							node.style.transitionDuration = '';
							node.style.transitionProperty = '';
							node.style.transitionTimingFunction = '';

							delete this.data.get( node ).storage.transitions[ id ];

							undoRes();
						});
					},
					finalize:	() => {
						node.style.transition = '';
						delete this.data.get( node ).storage.transitions[ id ];
					}
				};

				store.transitions[ id ] = options;

				res( options );
			} else {
				rej( `node must be of type HTMLElement, received ${ typeof node } instead.` );
			}
		});
	}

	reflow( element ) {
		doc.body.offsetHeight;
	}
};

export default NodeTools;

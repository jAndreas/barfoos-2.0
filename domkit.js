"use strict";

import { Composition, extend, intToRGB, hashCode, type } from './toolkit.js';
import { Mediator } from './mediator.js';

const		win			= window,
			doc			= win.document,
			undef		= void 0,
			query		= Object.create( null );

let NodeTools = target => class extends target {
	constructor() {
		super( ...arguments );

		this._alreadyDelegatedEvents = Object.create( null );

		this._delegatedEventHandler = event => {
			if( this.data.get( event.target ) && this.data.get( event.target ).events[ event.type ] ) {
				this.data.get( event.target ).events[ event.type ].forEach( fnc => fnc.call( this, event ) );
			}
		};
	}

	addNodeEvent( node, type, fnc ) {
		if( typeof node === 'string' ) {
			node = this.nodes[ node ];
		}

		if( node instanceof HTMLElement ) {
			if(!this._alreadyDelegatedEvents[ type ] ) {
				this._alreadyDelegatedEvents[ type ] = true;
				this.nodes.root.addEventListener( type, this._delegatedEventHandler, false );
			}

			if( typeof this.data.get( node ).events[ type ] === 'undefined' ) {
				this.data.get( node ).events[ type ] = [ ];
			}

			if( this.data.get( node ).events[ type ].indexOf( fnc ) === -1 ) {
				this.data.get( node ).events[ type ].push( fnc );
			} else {
				this.error( `${ node }: identical event handlers are not allowed -> ${ fnc }` );
			}
		} else {
			this.error( `node must be of type HTMLElement, received ${ typeof node } instead.` );
		}
	}

	removeNodeEvent( node, type, fnc ) {
		if( typeof node === 'string' ) {
			node = this.nodes[ node ];
		}

		if( node instanceof HTMLElement ) {
			if( typeof fnc === 'function' ) {
				if( Array.isArray( this.data.get( node ).events[ type ] ) ) {
					this.data.get( node ).events[ type ] = this.data.get( node ).events[ type ].filter( currentFnc => currentFnc !== fnc );
				}
			} else if( typeof fnc === 'undefined' ) {
				if( type ) {
					if( Array.isArray( this.data.get( node ).events[ type ] ) ) {
						this.data.get( node ).events[ type ] = [ ];
					}
				} else {
					this.data.get( node ).events = Object.create( null );
				}
			}
		} else {
			this.error( `node must be of type HTMLElement, received ${ typeof node } instead.` );
		}
	}

	removeAllNodeEvents( type ) {
		for( let [ key, node ] of Object.entries( this.nodes ) ) {
			this.data.get( node ).events[ type ] = null;
			delete this.data.get( node ).events[ type ];
		}
	}

	animate( { node, id = 'last', rules:{ delay = '0', duration = 200, timing = 'linear', iterations = 1, direction = 'normal', mode = 'forwards', name = '' } = { } } = { } ) {
		let rules = { delay, duration, timing, iterations, direction, mode, name };

		return new Promise(( res, rej ) => {
			if( node instanceof HTMLElement ) {
				let store = this.data.get( node ).storage;

				if( store.animations === undef ) {
					store.animations = Object.create( null );
				}

				if( store.animations[ id ] ) {
					rej( `It seems like there is a pending transition for ${ node } - ID: ${ id }.` );
				}

				node.style.animation = `${ duration }ms ${ timing } ${ delay }ms ${ iterations } ${ direction } ${ mode } ${ name }`;

				this.addNodeEvent( node, 'animationend', animationEndEvent );

				function animationEndEvent( event ) {
					this.removeNodeEvent( node, 'animationend', animationEndEvent );

					let options = {
						undo:		() => {
							return new Promise(( undoRes, undoRej ) => {
								let undoEnd = event => {
									this.removeNodeEvent( node, 'animationend', undoEnd );

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

								this.addNodeEvent( node, 'animationend', undoEnd );

								node.style.animation = '';
								this.reflow();
								node.style.animation = `${ name } ${ duration }ms ${ timing } ${ delay }ms ${ iterations } reverse ${ mode }`;
							});
						},
						finalize:	() => {
							node.style.animation = '';
							delete this.data.get( node ).storage.animations[ id ];
						}
					};

					store.animations[ id ] = options;

					res( options );
				}
			} else {
				rej( `node must be of type HTMLElement, received ${ typeof node } instead.` );
			}
		});
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

/*****************************************************************************************************
 * Mixin Class LogTools: Provides a logging with hash-generated color from base class constructor name
 *****************************************************************************************************/
let LogTools = target => class extends target {
	constructor( options = { } ) {
		super( ...arguments );

		extend( this ).with({
			id:		options.id || this.constructor.name,
			color:	intToRGB( hashCode( options.id || this.constructor.name ) )
		});
	}

	log( ...args ) {
		if( ENV_PROD ) {
			return;
		}

		let prefixed = args.slice( 0 );

		prefixed.unshift( `%c${this.id}: `, `color: #${this.color};font-weight: normal;text-shadow: 1px 1px 1px white,-1px -1px 1px black;` );

		console.groupCollapsed( ...prefixed );
		this.nodes && console.log( this.nodes.root );
		console.trace();
		console.groupEnd();

		super.log && super.log( ...args );
	}

	error( ...args ) {
		console.groupCollapsed( ...prefixed );
		this.nodes && console.log( this.nodes.root );
		throw new Error( args );
		console.groupEnd();

		super.error && super.error( ...args );
	}
};
/********************************************* LogTools End ******************************************/

/*****************************************************************************************************
 * Class DOMTools: Provides a DOM toolset for transpiling html-strings into Node-References, watching
 * DOM ready events and providing request-events.
 *****************************************************************************************************/
let DOMTools = target => class extends target {
	constructor( data = { } ) {
		super( ...arguments );

		extend( this ).with( data ).and({
			id:			this.constructor.name,
			vDom:		doc.implementation.createHTMLDocument()
		});
	}

	transpile( html = '' )  {
		this.vDom.body.innerHTML = html;

		let [ nodes, dataHash ] = this.cacheNodes( this.vDom.body.firstChild.cloneNode( true ) );

		this.vDom.body.firstChild.remove();

		return [ nodes, dataHash ];
	}

	waitForDOM( event ) {
		return doc.readyState === 'complete' || new Promise( (res, rej) => {
			doc.addEventListener( 'DOMContentLoaded', () => res( doc.readyState ) );
		});
	}

	addNodes( nodeData, optionalName ) {
		if( nodeData instanceof HTMLElement && typeof optionalName === 'string' ) {
			if( optionalName in this.nodes ) {
				this.error( `${ optionalName } already exists in Components Node Hash.` );
			} else {
				this.nodes[ optionalName ]			= nodeData;

				this.data.set( nodeData, Object.create( null ) );
				this.data.get( nodeData ).storage	= Object.create( null );
				this.data.get( nodeData ).events	= Object.create( null );

				return nodeData;
			}
		} else if( typeof nodeData === 'object' ) {
			for( let [ name, nodeRef ] of Object.entries( nodeData ) ) {
				if( name in this.nodes ) {
					this.error( `${ optionalName } already exists in Components Node Hash.` );
				} else {
					this.nodes[ name ]					= nodeRef;

					this.data.set( nodeRef, Object.create( null ) );
					this.data.get( nodeRef ).storage	= Object.create( null );
					this.data.get( nodeRef ).events		= Object.create( null );
				}
			}
		} else {
			this.error( `addNodes was called with wrong arguments. You need to pass either a hash or nodes or provide a single node with a name as second argument.` );
		}
	}

	removeNodes( name, removePhysically ) {
		name = Array.isArray( name ) ? name : [ name ];

		name.forEach( n => {
			if( removePhysically ) {
				this.nodes[ n ].remove();
			}

			this.data.delete( this.nodes[ n ] );
			delete this.nodes[ n ];
		});
	}

	cacheNodes( rootNode ) {
		let nodeHash		= Object.create( null ),
			availableNames	= Object.create( null ),
			dataHash		= new WeakMap(),
			self			= this;

		nodeHash.root = rootNode;

		(function crawlNodes( node ) {
			let currentTag = null;

			if( node instanceof HTMLElement ) {
				currentTag = node.nodeName.toLowerCase() + ( node.id ? ('#' + node.id) : node.className ? ('.' + node.className.split( /\s+/ )[ 0 ]) : '' );
				currentTag = currentTag.replace( /\s+/, '' );

				// avoid duplicates, keep track on the number of identical identifiers
				if( typeof availableNames[ currentTag ] === 'undefined' ) {
					availableNames[ currentTag ] = 1;
				}
				else {
					availableNames[ currentTag ]++;
				}

				// fill nodeHash lookup
				if( typeof nodeHash[ currentTag ] === 'undefined' ) {
					nodeHash[ currentTag ] = node;
				}
				else {
					nodeHash[ currentTag + '_' + availableNames[ currentTag ] ] = node;
				}

				let alias					= node.getAttribute( 'alias' ),
					defaultChildContainer	= node.getAttribute( 'defaultChildContainer' );

				if( alias ) {
					nodeHash[ alias ] = node;
				}

				if( defaultChildContainer ) {
					Object.defineProperty(nodeHash, 'defaultChildContainer', {
						value:			node,
						enumerable:		true,
						configurable:	false,
						writable:		false
					});
				}

				dataHash.set( node, Object.create( null ) );
				dataHash.get( node ).storage	= Object.create( null );
				dataHash.get( node ).events		= Object.create( null );

				// loop over every childnode, if we have children of children, recursively call crawlNodes()
				if( node.children.length ) {
					for( let i = 0, len = node.children.length; i < len; i++ ) {
						crawlNodes( node.children[ i ] );
					}
				}
			} else if( node instanceof NodeList ) {
				// handle each node of NodeList
				self.error('NodeList not implemented yet');
			} else if( node instanceof HTMLCollection ) {
				// handle each node of HTMLCollection
				self.error('HTMLCollection not implemented yet');
			}
		}( rootNode ));

		if(!nodeHash.defaultChildContainer ) {
			nodeHash.defaultChildContainer = nodeHash.root;
		}

		return [ nodeHash, dataHash ];
	}

	timeout( ms = 200 ) {
		return new Promise(( res, rej ) => {
			win.setTimeout( res, ms );
		});
	}

	init() {
		super.init && super.init( ...arguments );

		doc.onreadystatechange = () => {
			if( doc.readyState === 'complete' ) {
				this.fire( 'DOMReady.appEvents' );
			}
		}

		this.on( 'waitForDOM.appEvents', this.waitForDOM, this );
	}
};
/********************************************* DOMTools End ******************************************/

/*****************************************************************************************************
 * query is a native, simple DOM selector API.
 *****************************************************************************************************/
extend( query ).with({
	By:	{
		'id':		function byId( id, ctx ) {
			return Array.from([ this.makeCtx( ctx ).getElementById( id ) ]);
		},
		'tag':		function byTagName( tag, ctx ) {
			return Array.from( this.makeCtx( ctx ).getElementsByTagName( tag ) );
		},
		'class':	function byClass( className, ctx ) {
			return Array.from( this.makeCtx( ctx ).getElementsByClassName( className ) );
		},
		'name':		function byName( name, ctx ) {
			return Array.from( this.makeCtx( ctx ).getElementsByName( name ) );
		},
		'qsa':		function byQuery( query, ctx ) {
			return Array.from( this.makeCtx( ctx ).querySelectorAll( query ) );
		},
		'qs':		function byQueryOne( query, ctx ) {
			return Array.from([ this.makeCtx( ctx ).querySelector( query ) ]);
		},
		'makeCtx':	function makeContext( ctx ) {
			if( typeof ctx === 'string' ) {
				switch( ctx.charAt( 0 ) ) {
					case '#':	return this.id( ctx.slice( 1 ) )[ 0 ];
					case '.':	return this.class( ctx.slice( 1 ) );
					default:	return this.qsa( ctx );
				}
			} else if( ctx instanceof HTMLElement || ctx instanceof HTMLDocument || ctx instanceof Array ) {
				return ctx;
			} else if( ctx === undef ) {
				return doc;
			} else {
				throw new TypeError( 'By() requires a node reference or a query string as context argument' );
			}
		}
	}
});
/********************************************* query End ******************************************/

if(!('console' in win) ) {
	win.console = Object.create( null );
	'debug error info log warn dir dirxml table trace group groupCollapsed groupEnd clear count assert markTimeline profile profileEnd timeline timelineEnd time timeEnd timeStamp memory'.split( /\s+/ ).forEach( fncName => win.console[ fncName ] = () => undef );
}

export { win, doc, query, DOMTools, LogTools, NodeTools };

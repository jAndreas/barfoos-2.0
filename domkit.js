"use strict";

import { Composition, extend, intToRGB, hashCode, type } from './toolkit.js';
import { Mediator } from './mediator.js';

const		win			= window,
			doc			= win.document,
			undef		= void 0,
			query		= Object.create( null );

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
class DOMTools extends Composition( LogTools, Mediator ) {
	constructor( data = { } ) {
		super( ...arguments );

		extend( this ).with( data ).and({
			id:			this.constructor.name,
			vDom:		doc.implementation.createHTMLDocument()
		});

		this.init();
	}

	transpile( html = '' )  {
		this.vDom.body.innerHTML = html;

		let [ nodes, dataHash ] = this.cacheNodes( this.vDom.body.firstChild.cloneNode( true ) );

		this.vDom.body.firstChild.remove();

		return [ nodes, dataHash ];
	}

	waitForDOM( event ) {
		return doc.readyState === 'complete' || new Promise( (res, rej) => {
			this.log(`waitForDOM: document readyState not complete(${doc.readyState}), adding to DCL.`);
			doc.addEventListener( 'DOMContentLoaded', () => res( doc.readyState ) );
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

				dataHash[ node ]			= Object.create( null );
				dataHash[ node ].storage	= Object.create( null );
				dataHash[ node ].events		= Object.create( null );

				// loop over every childnode, if we have children of children, recursively call crawlNodes()
				if( node.children.length ) {
					for( let i = 0, len = node.children.length; i < len; i++ ) {
						crawlNodes( node.children[ i ] );
					}
				}
			} else if( node instanceof NodeList ) {
				// handle each node of NodeList
				self.log('NodeList not implemented yet');
			} else if( node instanceof HTMLCollection ) {
				// handle each node of HTMLCollection
				self.log('HTMLCollection not implemented yet');
			}
		}( rootNode ));

		if(!nodeHash.defaultChildContainer ) {
			nodeHash.defaultChildContainer = nodeHash.root;
		}

		return [ nodeHash, dataHash ];
	}

	init() {
		doc.onreadystatechange = () => {
			this.log('onreadystatechange DOMContentLoaded..: ', doc.readyState);
			if( doc.readyState === 'complete' ) {
				this.fire( 'DOMReady.appEvents' );
			}
		}

		this.on( 'waitForDOM.appEvents', this.waitForDOM, this );
	}
}
/********************************************* DOMTools End ******************************************/

function transition( { node, style, className, rules:{ delay = '0', duration = 200, property = 'all', timing = 'linear' } = { } } = { } ) {
	let rules = { delay, duration, property, timing };

	return new Promise(( res, rej ) => {
		let oldStyleValues = Object.create( null );

		if( node instanceof HTMLElement ) {
			node.style.transition = `${ property } ${ duration }ms ${ timing } ${ delay }ms`;
			node.style.offsetHeight = node.style.offsetHeight;

			if( typeof style === 'object' ) {
				for( let [ name, newValue ] of Object.entries( style ) ) {
					oldStyleValues[ name ]	= node.style[ name ];
					node.style[ name ]		= newValue;
				}
			}

			if( typeof className === 'string' ) {
				node.classList.add( className );
			}

			node.addEventListener('transitionend', transitionEndEvent, false );

			function transitionEndEvent( event ) {
				node.removeEventListener( 'transitionend', transitionEndEvent );

				res({
					undo:		() => {
						return new Promise(( undoRes, undoRej ) => {
							for( let [ name, oldValue ] of Object.entries( oldStyleValues ) ) {
								node.style[ name ] = oldValue;
							}

							node.classList.remove( className );

							node.style.offsetHeight = node.style.offsetHeight;

							node.addEventListener('transitionend', undoEnd, false );

							function undoEnd( event ) {
								node.removeEventListener( 'transitionend', undoEnd );
								node.style.transition = '';
								undoRes( event );
							}
						});
					},
					finalize:	() => {
						node.style.transition = '';
					},
					event:		event
				});
			}
		} else {
			rej( 'node must be of type HTMLElement.' );
		}
	});
}

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

export { win, doc, query, transition, DOMTools, LogTools };

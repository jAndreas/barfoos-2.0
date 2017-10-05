'use strict';

import { extend, type } from './toolkit.js';

const		win			= window,
			doc			= win.document,
			undef		= void 0,
			query		= Object.create( null );

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
				this.nodes[ optionalName ]				= nodeData;

				this.data.set( nodeData, Object.create( null ) );
				this.data.get( nodeData ).storage		= Object.create( null );
				this.data.get( nodeData ).events		= Object.create( null );
				this.data.get( nodeData ).oneTimeEvents	= Object.create( null );

				return nodeData;
			}
		} else if( typeof nodeData === 'object' ) {
			for( let [ name, nodeRef ] of Object.entries( nodeData ) ) {
				if( name in this.nodes ) {
					this.error( `${ optionalName } already exists in Components Node Hash.` );
				} else {
					this.nodes[ name ]						= nodeRef;

					this.data.set( nodeRef, Object.create( null ) );
					this.data.get( nodeRef ).storage		= Object.create( null );
					this.data.get( nodeRef ).events			= Object.create( null );
					this.data.get( nodeRef ).oneTimeEvents	= Object.create( null );
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
				dataHash.get( node ).storage		= Object.create( null );
				dataHash.get( node ).events			= Object.create( null );
				dataHash.get( node ).oneTimeEvents	= Object.create( null );

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

export { win, doc, undef, query, DOMTools };

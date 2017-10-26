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
			vDom:		doc.implementation.createHTMLDocument(),
			data:		new WeakMap(),
			nodes:		Object.create( null )
		});
	}

	transpile({ nodeData, nodeName, htmlData, renderInstructions = { } })  {
		let nodes;

		if( typeof htmlData === 'string' ) {
			this.vDom.body.innerHTML = htmlData;

			nodes = this.cacheNodes( this.vDom.body.firstChild.cloneNode( true ) );

			this.vDom.body.firstChild.remove();
		} else if( nodeData instanceof HTMLElement && typeof nodeName === 'string' ) {
			nodes = this.cacheNodes( nodeData, nodeName );
		}

		// performance virtual DOM manipulation based on renderInstructions HERE
		// YES RIGHT HERE
		// before the cloning of the whole thing !!!!!

		return nodes;
	}

	waitForDOM( event ) {
		return doc.readyState === 'complete' || new Promise( (res, rej) => {
			doc.addEventListener( 'DOMContentLoaded', () => res( doc.readyState ) );
		});
	}

	addNodes({ nodeData, htmlData, reference = { }, nodeName, renderInstructions } = { }) {
		if( nodeData instanceof HTMLElement ) {
			if( typeof nodeName === 'string' && reference.node instanceof HTMLElement && typeof reference.position === 'string' ) {
				if( nodeName in this.nodes ) {
					this.error( `${ nodeName } already exists in Components Node Hash.` );
				} else {
					extend( this.nodes ).with( this.transpile({ nodeData, nodeName, renderInstructions }) );

					reference.node.insertAdjacentElement( reference.position, nodeData );
				}
			} else {
				this.error( `addNodes was called with wrong arguments. When passing in a node reference, you need to specify a node name and a reference-node with position.` );
			}
		}

		if( typeof htmlData === 'string' ) {
			extend( this.nodes ).with( this.transpile({ nodeData, nodeName, renderInstructions }) );
		}

		return this;
	}

	removeNodes( name, removePhysically ) {
		name = Array.isArray( name ) ? name : [ name ];

		name.forEach( n => {
			if( this.nodes[ n ] ) {
				// if there are any children of this node, remove them aswell from all structures
				for( let i = 0, len = this.nodes[ n ].children.length; i < len; i++ ) {
					this.removeNodes( this.resolveNodeNameByRef( this.nodes[ n ].children[ i ] ), removePhysically );
				}

				// if removePhysically is set, the node will get removed from the live DOM
				if( removePhysically ) {
					this.nodes[ n ].remove();
				}

				// delete all data- and events for this node from internal structures
				this.data.delete( this.nodes[ n ] );
				delete this.nodes[ n ];
			}
		});
	}

	cacheNodes( rootNode, nodeName ) {
		let nodeHash		= Object.create( null ),
			availableNames	= Object.create( null ),
			self			= this;

		if( nodeName === undef ) {
			nodeHash.root = rootNode;
		}

		(function crawlNodes( node, nodeName ) {
			let currentTag = null;

			if( node instanceof HTMLElement ) {
				currentTag = nodeName || node.nodeName.toLowerCase() + ( node.id ? ('#' + node.id) : node.className ? ('.' + node.className.split( /\s+/ )[ 0 ]) : '' );
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

				self.data.set( node, Object.create( null ) );
				self.data.get( node ).storage			= Object.create( null );
				self.data.get( node ).events			= Object.create( null );
				self.data.get( node ).oneTimeEvents		= Object.create( null );

				// loop over every childnode, if we have children of children, recursively call crawlNodes()
				for( let i = 0, len = node.children.length; i < len; i++ ) {
					crawlNodes( node.children[ i ] );
				}
			} else if( node instanceof NodeList ) {
				// handle each node of NodeList
				self.error('NodeList not implemented yet');
			} else if( node instanceof HTMLCollection ) {
				// handle each node of HTMLCollection
				self.error('HTMLCollection not implemented yet');
			}
		}( rootNode, nodeName ));

		if(!nodeHash.defaultChildContainer && !nodeName ) {
			nodeHash.defaultChildContainer = nodeHash.root;
		}

		return nodeHash;
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

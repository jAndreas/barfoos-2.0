"use strict";

import { extend } from './toolkit.js';
import { mediator } from './mediator.js';

const		win			= window,
			doc			= win.document,
			undef		= void 0,
			query		= Object.create( null );

class DOMTools {
	constructor( data = { } ) {
		extend( this ).with( data );

		extend( this ).with({
			vDom:		doc.implementation.createHTMLDocument(),
			appEvents:	new mediator({ register: 'ApplicationEvents' }) 
		}, true);
		
		this.init();
	}

	transpile( html = '' )  {
		this.vDom.body.innerHTML = html;

		let nodes = this.cacheNodes( this.vDom.body.firstChild.cloneNode( true ) );

		this.vDom.body.firstChild.remove();

		return nodes;
	}

	waitForDOM() {
		return doc.readyState === 'complete' || new Promise( (res, rej) => {
			doc.onreadystatechange = () => {
				if( doc.readyState === 'complete' ) {
					res( doc.readyState );
				}
			}
		});
	}

	cacheNodes( rootNode ) {
		let nodeHash		= Object.create( null ),
			availableNames	= Object.create( null ),
			firstRun		= true;

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
					
					if( firstRun ) {
						nodeHash.root = node;
					}
				}
				else {
					nodeHash[ currentTag + '_' + availableNames[ currentTag ] ] = node;
				}

				firstRun = false;
				// loop over every childnode, if we have children of children, recursively call crawlNodes()
				if( node.children.length ) {
					for( let i = 0, len = node.children.length; i < len; i++ ) {
						crawlNodes( node.children[ i ] );
					}
				}
			} else if( node instanceof NodeList ) {
				// handle each node of NodeList
				console.log('NodeList not implemented yet');
			} else if( node instanceof HTMLCollection ) {
				// handle each node of HTMLCollection
				console.log('HTMLCollection not implemented yet');
			}
		}( rootNode ));

		return nodeHash;
	}

	init() {
		doc.onreadystatechange = () => {
			if( doc.readyState === 'complete' ) {
				this.appEvents.fire( 'DOMReady' );
			}
		}

		this.appEvents.on( 'waitForDOM', this.waitForDOM )
	}
}

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

export { win, doc, query, DOMTools };
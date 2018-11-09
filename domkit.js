'use strict';

import { extend, type } from './toolkit.js';

// private data
const		win				= window,
			doc				= win.document,
			undef			= void 0,
			query			= Object.create( null ),
			globalShadowDOM	= doc.implementation.createHTMLDocument( null );

/*****************************************************************************************************
 * Class DOMTools: Provides a DOM toolset for transpiling html-strings into Node-References, watching
 * DOM ready events and providing request-events.
 *****************************************************************************************************/
let DOMTools = target => class extends target {
	constructor( data = { } ) {
		super( ...arguments );

		extend( this ).with( data ).and({
			id:					this.constructor.name,
			vDom:				globalShadowDOM,
			data:				new WeakMap(),
			nodes:				Object.create( null ),
			availableNames:		Object.create( null )
		});
	}

	makeNode( htmlData ) {
		if( typeof htmlData === 'string' ) {
			this.vDom.body.innerHTML = htmlData;

			let node	= this.vDom.body.firstChild.cloneNode( true );

			this.vDom.body.innerHTML = '';

			return node;
		} else {
			this.error && this.error( 'makeNode was called with wrong arguments, htmlData needs to be a String.' );
		}
	}

	transpile({ nodeData, nodeName, htmlData, moduleRoot, standalone })  {
		let nodes;

		if( typeof htmlData === 'string' ) {
			this.vDom.body.innerHTML = htmlData;

			nodes = this.cacheNodes({ rootNode: this.vDom.body.firstChild.cloneNode( true ), moduleRoot, standalone });

			this.vDom.body.firstElementChild.remove();
		} else if( nodeData instanceof HTMLElement && typeof nodeName === 'string' ) {
			this.vDom.body.insertAdjacentElement( 'afterbegin', nodeData );

			nodes = this.cacheNodes({ rootNode: this.vDom.body.firstChild.cloneNode( true ), nodeName, moduleRoot, standalone });
		}

		this.vDom.body.innerHTML = '';

		return nodes;
	}

	addNodes({ nodeData, htmlData, reference = { }, nodeName, standalone = false } = { }) {
		if( typeof reference.node === 'string' ) {
			reference.node = this.nodes[ reference.node ];
		}

		if( reference.node instanceof HTMLElement === false ) {
			this.error( `addNodes requires a valid node identifier as String or a HTMLElement reference.` );
		}

		if( nodeData instanceof HTMLElement ) {
			if( typeof nodeName === 'string' && typeof reference.position === 'string' ) {
				if( nodeName in this.nodes ) {
					this.error && this.error( `${ nodeName } already exists in Components Node Hash.` );
				} else {
					let nodeHash = this.transpile({ nodeData, nodeName, standalone });

					if( reference.position === 'replace' ) {
						reference.node.replaceWith( nodeHash.localRoot );
					} else {
						reference.node.insertAdjacentElement( reference.position, nodeHash.localRoot );
					}

					if(!standalone ) {
						delete nodeHash.localRoot;
						extend( this.nodes ).with( nodeHash );
					} else {
						return nodeHash;
					}
				}
			} else {
				this.error && this.error( `addNodes was called with wrong arguments. When passing in a node reference, you need to specify a node name and a reference-node with position.` );
			}
		}

		if( typeof htmlData === 'string' ) {
			let nodeHash = this.transpile({ htmlData, standalone });

			if( reference.position === 'replace' ) {
				reference.node.replaceWith( nodeHash.localRoot );
			} else {
				reference.node.insertAdjacentElement( reference.position, nodeHash.localRoot );
			}

			if(!standalone ) {
				delete nodeHash.localRoot;
				extend( this.nodes ).with( nodeHash );
			} else {
				return nodeHash;
			}
		}

		return this;
	}

	removeNodes( name, removePhysically ) {
		name = Array.isArray( name ) ? name : [ name ];

		name.forEach( n => {
			let localRef;

			if( n instanceof HTMLElement ) {
				localRef	= n;
				n			= this.resolveNodeNameFromRef( localRef );

				if( n === undef ) {
					this.error( 'passed in node reference does not match anything in modules node hash.' );
				}
			} else if( typeof n === 'string' ) {
				localRef = this.dialogElements[ n ] || this.nodes[ n ];
			}

			if( localRef ) {
				let localChildren = Array.from( localRef.children ).concat();
				// if there are any children of this node, remove them aswell from all structures
				for( let i = 0, len = localChildren.length; i < len; i++ ) {
					let resolvedName = this.resolveNodeNameFromRef( localChildren[ i ] );

					if(!resolvedName ) {
						this.warn( 'Unable to resolve hash name for: ', localChildren[ i ], ' of ', localRef );
						localChildren[ i ].remove();
						continue;
					};

					this.removeNodes( resolvedName, removePhysically );
				}

				// if removePhysically is set, the node will get removed from the live DOM
				if( removePhysically ) {
					localRef.remove();
				}

				// delete all data- and events for this node from internal structures
				this.data.delete( localRef );
				delete this.nodes[ n ];
				delete this.dialogElements[ n ];
				delete this.availableNames[ n ];
			} else {
				//this.warn( `${ n } could not be found in local node hash and therefore could not be removed.` );
			}
		});
	}

	cacheNodes({ rootNode, nodeName, moduleRoot, standalone }) {
		let nodeHash		= Object.create( null ),
			self			= this;

		if( moduleRoot ) {
			nodeHash.root		= rootNode;
		} else {
			nodeHash.localRoot	= rootNode;
		}

		//if( standalone ) {
		//	return nodeHash;
		//}

		(function crawlNodes( node, nodeName ) {
			if( node instanceof HTMLElement ) {
				if( standalone ) {
					for( let { name, value } of Array.from( node.attributes ).slice( 0 ) ) {
						if( name.startsWith( 'on' ) ) {
							node.addEventListener( name.slice( 2 ), self[ value ].bind( self ), false );
							node.removeAttribute( name );
						}
					}
				} else {
					let currentTag = nodeName || node.nodeName.toLowerCase() + ( node.id ? ('#' + node.id) : node.className ? ('.' + node.className.split( /\s+/ )[ 0 ]) : '' );
					currentTag = currentTag.replace( /\s+/, '' );

					// avoid duplicates, keep track on the number of identical identifiers
					if( typeof self.availableNames[ currentTag ] === 'undefined' ) {
						self.availableNames[ currentTag ] = 1;
					}
					else {
						self.availableNames[ currentTag ]++;
					}

					// fill nodeHash lookup
					if( self.availableNames[ currentTag ] === 1 ) {
						nodeHash[ currentTag ] = node;
					}
					else {
						nodeHash[ currentTag + '_' + self.availableNames[ currentTag ] ] = node;

						self.warn && self.warn( `cacheNodes(): Duplicate node identifier on ${ currentTag }(${ self.availableNames[ currentTag ] }) -> `, node );
					}

					let alias				= node.getAttribute( 'alias' ),
					defaultDialogContainer	= node.getAttribute( 'defaultDialogContainer' ),
					defaultChildContainer	= node.getAttribute( 'defaultChildContainer' );

					if( alias ) {
						nodeHash[ alias ] = node;
					}

					if( defaultChildContainer !== null ) {
						Object.defineProperty(nodeHash, 'defaultChildContainer', {
							value:			node,
							enumerable:		true,
							configurable:	false,
							writable:		false
						});
					}

					if( defaultDialogContainer !== null ) {
						Object.defineProperty(nodeHash, 'defaultDialogContainer', {
							value:			node,
							enumerable:		true,
							configurable:	false,
							writable:		false
						});
					}

					self.data.set(node, {
						storage:		{
							animations:		{
								running:	[ ]
							},
							nodeData:		{ }
						},
						events:			Object.create( null ),
						oneTimeEvents:	Object.create( null )
					});

					for( let { name, value } of Array.from( node.attributes ).slice( 0 ) ) {
						if( name.startsWith( 'on' ) ) {
							self.addNodeEvent( node, name.slice( 2 ), self[ value ] );
							node.removeAttribute( name );
						}

						if( name.startsWith( 'data-' ) ) {
							self.data.get( node ).storage.nodeData[ name.slice( 5 ) ] = value;
						}
					}
				}

				// loop over every childnode, if we have children of children, recursively call crawlNodes()
				for( let i = 0, len = node.children.length; i < len; i++ ) {
					if( node.children[ i ].tagName !== 'BR' ) {
						crawlNodes( node.children[ i ] );
					}
				}
			} else if( node instanceof NodeList ) {
				// handle each node of NodeList
				self.error && self.error('NodeList not implemented yet');
			} else if( node instanceof HTMLCollection ) {
				// handle each node of HTMLCollection
				self.error && self.error('HTMLCollection not implemented yet');
			}
		}( rootNode, nodeName ));

		if(!standalone ) {
			if(!nodeHash.defaultChildContainer && moduleRoot ) {
				nodeHash.defaultChildContainer = nodeHash.root;
			}

			if(!nodeHash.defaultDialogContainer && moduleRoot ) {
				nodeHash.defaultDialogContainer = nodeHash.root;
			}
		}

		return nodeHash;
	}

	timeout( ms = 200 ) {
		return new Promise(( res, rej ) => {
			win.setTimeout( res, ms );
		});
	}

	async init() {
		super.init && await super.init( ...arguments );
	}
};
/********************************************* DOMTools End ******************************************/

/*****************************************************************************************************
 * query is a native, simple DOM selector API.
 *****************************************************************************************************/
extend( query ).with({
	by:	{
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

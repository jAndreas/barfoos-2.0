'use strict';

import { extend, type } from './toolkit.js';

// private data
const		win				= window,
			doc				= win.document,
			undef			= void 0,
			query			= Object.create( null ),
			globalShadowDOM	= doc.implementation.createHTMLDocument( null );

/*****************************************************************************************************
 * Class NodeGroup: Scoped container for dynamically rendered nodes with full framework API access.
 * Returned by render({ scoped: 'myId' }).with().at(). Owns its own node hash and availableNames counter.
 * All nodes are registered in the parent component's WeakMap, enabling addNodeEvent/animate/transition.
 * Call destroy() to remove DOM, clean WeakMap entries, and release all references.
 * Named groups (scoped: 'stringId') are accessible via this.nodeGroup('stringId') from the module.
 * Anonymous groups (scoped: true) are only accessible via the returned reference.
 *****************************************************************************************************/
class NodeGroup {
	constructor( owner, groupId, nodeHash ) {
		this.owner			= owner;
		this.groupId		= groupId;
		this.nodes			= Object.create( null );
		this._template		= null;
		this._renderData	= null;
		this._crlf			= false;
		this._eventRegs		= [];

		for( let [ key, value ] of Object.entries( nodeHash ) ) {
			if( key === 'localRoot' ) {
				this.nodes.root = value;
			} else {
				this.nodes[ key ] = value;
			}
		}
	}

	addNodeEvent( nodes, types, fnc ) {
		let nodeStr = typeof nodes === 'string' ? nodes : null;

		if( typeof nodes === 'string' ) {
			nodes = nodes.split( /\s+|,\s+/ ).map( n => this.nodes[ n ] ).filter( Boolean );
		}

		this.owner.addNodeEvent( nodes, types, fnc );

		if( nodeStr && this._eventRegs ) {
			this._eventRegs.push({ nodes: nodeStr, types, fnc, once: false });
		}
	}

	addNodeEventOnce( nodes, types, fnc ) {
		let nodeStr = typeof nodes === 'string' ? nodes : null;

		if( typeof nodes === 'string' ) {
			nodes = nodes.split( /\s+|,\s+/ ).map( n => this.nodes[ n ] ).filter( Boolean );
		}

		this.owner.addNodeEventOnce( nodes, types, fnc );

		if( nodeStr && this._eventRegs ) {
			this._eventRegs.push({ nodes: nodeStr, types, fnc, once: true });
		}
	}

	removeNodeEvent( node, types, fnc ) {
		let nodeStr = typeof node === 'string' ? node : null;

		if( typeof node === 'string' ) {
			node = this.nodes[ node ];
		}

		this.owner.removeNodeEvent( node, types, fnc );

		if( nodeStr && this._eventRegs ) {
			this._eventRegs = this._eventRegs.filter( reg => {
				let nodesMatch	= reg.nodes === nodeStr || reg.nodes.split( /\s+|,\s+/ ).includes( nodeStr );
				let typesMatch	= !types || reg.types === types;
				let fncMatch	= !fnc || reg.fnc === fnc;

				return !( nodesMatch && typesMatch && fncMatch );
			});
		}
	}

	animate( options ) {
		if( typeof options.node === 'string' ) {
			options.node = this.nodes[ options.node ];
		}

		return this.owner.animate( options );
	}

	transition( options ) {
		if( typeof options.node === 'string' ) {
			options.node = this.nodes[ options.node ];
		}

		return this.owner.transition( options );
	}

	destroy() {
		if( !this.owner ) return;

		for( let [ key, node ] of Object.entries( this.nodes ) ) {
			if( node instanceof HTMLElement && this.owner.data ) {
				this.owner.data.delete( node );
			}
		}

		if( this.nodes.root ) {
			this.nodes.root.remove();
		}

		this.owner._nodeGroups.delete( this.groupId );
		this.owner.cleanDelegations();
		this.nodes			= null;
		this.groupId		= null;
		this._template		= null;
		this._renderData	= null;
		this._eventRegs		= null;
		this._crlf			= false;
		this.owner			= null;
	}

	rerender( newData = {} ) {
		if(!this._template || !this.owner ) return this;

		Object.assign( this._renderData, newData );

		let htmlData = this._template;

		for( let [ searchFor, value ] of Object.entries( this._renderData ) ) {
			if( typeof value === 'object' ) continue;

			if( this._crlf ) {
				htmlData = htmlData.replace( new RegExp( '%' + searchFor + '%', 'g' ), (value !== undef ? value : '').toString().replace( /<br>|<br\/>/g, '\n' ) );
			} else {
				htmlData = htmlData.replace( new RegExp( '%' + searchFor + '%', 'g' ), (value !== undef ? value : '').toString().replace( /\n/g, '<br/>') );
			}
		}

		this.owner.vDom.body.innerHTML = htmlData;
		let newRoot = this.owner.vDom.body.firstChild.cloneNode( true );
		this.owner.vDom.body.innerHTML = '';

		let newNodeHash = this.owner.cacheNodes({ rootNode: newRoot, standalone: false, scoped: true });

		this.owner._processTemplateLogic( newRoot, this._renderData, this._crlf );

		for( let [ key, node ] of Object.entries( this.nodes ) ) {
			if( node instanceof HTMLElement && this.owner.data ) {
				this.owner.data.delete( node );
			}
		}

		if( this.nodes.root && this.nodes.root.parentNode ) {
			this.nodes.root.replaceWith( newRoot );
		}

		this.nodes = Object.create( null );

		for( let [ key, value ] of Object.entries( newNodeHash ) ) {
			if( key === 'localRoot' ) {
				this.nodes.root = value;
			} else {
				this.nodes[ key ] = value;
			}
		}

		for( let reg of this._eventRegs ) {
			let resolvedNodes = reg.nodes.split( /\s+|,\s+/ ).map( n => this.nodes[ n ] ).filter( Boolean );

			if( resolvedNodes.length ) {
				if( reg.once ) {
					this.owner.addNodeEventOnce( resolvedNodes, reg.types, reg.fnc );
				} else {
					this.owner.addNodeEvent( resolvedNodes, reg.types, reg.fnc );
				}
			} else {
				this.owner.warn && this.owner.warn( `rerender: event target "${ reg.nodes }" no longer exists in group "${ this.groupId }"` );
			}
		}

		this.owner.cleanDelegations();

		return this;
	}
}

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
			availableNames:		Object.create( null ),
			_nodeGroups:		new Map(),
			_anonGroupCounter:	0
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

	transpile({ nodeData, nodeName, htmlData, moduleRoot, standalone, scoped })  {
		let nodes;

		if( typeof htmlData === 'string' ) {
			this.vDom.body.innerHTML = htmlData;

			nodes = this.cacheNodes({ rootNode: this.vDom.body.firstChild.cloneNode( true ), moduleRoot, standalone, scoped });

			this.vDom.body.firstElementChild.remove();
		} else if( nodeData instanceof HTMLElement && typeof nodeName === 'string' ) {
			this.vDom.body.insertAdjacentElement( 'afterbegin', nodeData );

			nodes = this.cacheNodes({ rootNode: this.vDom.body.firstChild.cloneNode( true ), nodeName, moduleRoot, standalone, scoped });
		}

		this.vDom.body.innerHTML = '';

		return nodes;
	}

	addNodes({ nodeData, htmlData, reference = { }, nodeName, standalone = false, scoped = false } = { }) {
		if(!reference.node) {
			if( this.nodes.defaultChildContainer instanceof HTMLElement ) {
				reference.node = this.nodes.defaultChildContainer;
			} else if( this.nodes.defaultDialogContainer instanceof HTMLElement ) {
				reference.node = this.nodes.defaultDialogContainer;
			}
		}

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
					let nodeHash = this.transpile({ nodeData, nodeName, standalone, scoped });

					if( reference.position === 'replace' ) {
						reference.node.replaceWith( nodeHash.localRoot );
					} else {
						reference.node.insertAdjacentElement( reference.position || 'afterbegin', nodeHash.localRoot );
					}

					if( scoped ) {
						return this._createNodeGroup( scoped, nodeHash );
					} else if(!standalone ) {
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
			let nodeHash = this.transpile({ htmlData, standalone, scoped });

			if( reference.position === 'replace' ) {
				reference.node.replaceWith( nodeHash.localRoot );
			} else {
				reference.node.insertAdjacentElement( reference.position || 'afterbegin', nodeHash.localRoot );
			}

			if( scoped ) {
				return this._createNodeGroup( scoped, nodeHash );
			} else if(!standalone ) {
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

	cacheNodes({ rootNode, nodeName, moduleRoot, standalone, scoped }) {
		let nodeHash		= Object.create( null ),
			self			= this,
			nameCounter		= scoped ? Object.create( null ) : self.availableNames;

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
				if( standalone && !scoped ) {
					for( let { name, value } of Array.from( node.attributes ).slice( 0 ) ) {
						if( name.startsWith( 'on' ) ) {
							node.addEventListener( name.slice( 2 ), self[ value ].bind( self ), false );
							node.removeAttribute( name );
						}
					}
				} else if( !standalone || scoped ) {
					let currentTag = nodeName || node.nodeName.toLowerCase() + ( node.id ? ('#' + node.id) : node.className ? ('.' + node.className.split( /\s+/ )[ 0 ]) : '' );
					currentTag = currentTag.replace( /\s+/, '' );

					// avoid duplicates, keep track on the number of identical identifiers
					if( typeof nameCounter[ currentTag ] === 'undefined' ) {
						nameCounter[ currentTag ] = 1;
					}
					else {
						nameCounter[ currentTag ]++;
					}

					// fill nodeHash lookup
					if( nameCounter[ currentTag ] === 1 ) {
						nodeHash[ currentTag ] = node;
					}
					else {
						nodeHash[ currentTag + '_' + nameCounter[ currentTag ] ] = node;

						self.warn && self.warn( `cacheNodes(): Duplicate node identifier on ${ currentTag }(${ nameCounter[ currentTag ] }) -> `, node );
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

		if( !standalone && !scoped ) {
			if(!nodeHash.defaultChildContainer && moduleRoot ) {
				nodeHash.defaultChildContainer = nodeHash.root;
			}

			if(!nodeHash.defaultDialogContainer && moduleRoot ) {
				nodeHash.defaultDialogContainer = nodeHash.root;
			}
		}

		return nodeHash;
	}

	_createNodeGroup( scoped, nodeHash ) {
		let groupId = typeof scoped === 'string' ? scoped : `_anon_${ ++this._anonGroupCounter }`;

		if( this._nodeGroups.has( groupId ) ) {
			this._nodeGroups.get( groupId ).destroy();
		}

		let group = new NodeGroup( this, groupId, nodeHash );
		this._nodeGroups.set( groupId, group );
		return group;
	}

	nodeGroup( id ) {
		return this._nodeGroups.get( id ) || null;
	}

	removeNodeGroup( id ) {
		let group = this._nodeGroups.get( id );

		if( group ) {
			group.destroy();
		}
	}

	_processTemplateLogic( rootNode, replacementHash, crlf ) {
		let templateLogic = Array.from( rootNode.querySelectorAll( '[logic]' ) );

		templateLogic.push( rootNode );

		if( templateLogic.length ) {
			for( let node of templateLogic ) {
				let instructions = node.getAttribute( 'logic' );

				if(!instructions ) continue;

				instructions = JSON.parse( instructions );
				node.removeAttribute( 'logic' );

				if( instructions ) {
					for( let [ cmd, src ] of Object.entries( instructions ) ) {
						switch( cmd ) {
							case 'loop':
								let nodeHTML	= node.outerHTML,
									parent		= node.parentElement;

								node.remove();

								if( Array.isArray( replacementHash[ src ] ) ) {
									for( let entry of replacementHash[ src ] ) {
										if( entry ) {
											let updatedHTML;

											if( crlf ) {
												if( typeof entry === 'string' ) {
													updatedHTML = nodeHTML.replace( new RegExp( `%${ src }%`, 'g' ), entry.toString().replace( /<br>|<br\/>/g, '\n' ) );
												}
												if( typeof entry === 'object' ) {
													updatedHTML = nodeHTML;

													for( let [ ph, ctn ] of Object.entries( entry ) ) {
														updatedHTML = updatedHTML.replace( new RegExp( `%${ ph }%`, 'g' ), ctn.toString().replace( /<br>|<br\/>/g, '\n' ) );
													}
												}
											} else {
												if( typeof entry === 'string' ) {
													updatedHTML = nodeHTML.replace( new RegExp( `%${ src }%`, 'g' ), entry.toString().replace( /\n/g, '<br/>') );
												}
												if( typeof entry === 'object' ) {
													updatedHTML = nodeHTML;

													for( let [ ph, ctn ] of Object.entries( entry ) ) {
														updatedHTML = updatedHTML.replace( new RegExp( `%${ ph }%`, 'g' ), ctn.toString().replace( /\n/g, '<br/>') );
													}
												}
											}

											parent.insertAdjacentHTML( 'beforeend', updatedHTML );
										}
									}
								}

								parent = null;
								break;
							case 'if':
								for( let [ condition, action ] of Object.entries( src ) ) {
									if( replacementHash[ condition ] ) {
										for( let [ name, opt ] of Object.entries( action ) ) {
											switch( name ) {
												case 'addclass':
													node.classList.add( opt );
													break;
											}
										}
									}
								}
								break;
							case 'eq':
								for( let [ key, condition ] of Object.entries( src ) ) {
									for( let [ cmpValue, action ] of Object.entries( condition ) ) {
										if( +replacementHash[ key ] === +cmpValue ) {
											switch( action ) {
												case 'remove':
													node.remove();
													break;
											}
										}
									}
								}
								break;
						}
					}

					node.removeAttribute( 'logic' );
				}
			}
		}
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

'use strict';

import { extend, Composition, makeClass, props, type } from './toolkit.js';
import { win, doc, undef, DOMTools } from './domkit.js';
import { moduleLocations } from './defs.js';
import Mediator from './mediator.js';
import NodeTools from './nodetools.js';
import LogTools from './logtools.js';
import worldMarkup from './html/world.html';
import spinnerStyle from './css/spinner.scss';
import overlayStyle from './css/modaloverlay.scss';
import normalizeStyle from './css/normalize.scss';
import worldStyle from './css/world.scss';

const	eventLoop	= makeClass( class coreEventLoop{ }, { id: 'coreEventLoop' } ).mixin( Mediator ),
		console		= makeClass( class core{ }, { id: 'core'} ).mixin( LogTools ),
		DOM			= makeClass( class DOM{ }, { id: 'DOM'} ).mixin( Mediator, DOMTools ),
		modules		= Object.create( null );

		modules.online		= Object.create( null );
		modules.awaiting	= Object.create( null );

const 	nodes		= DOM.transpile({ htmlData: worldMarkup }),
		scrollSpeed	= 20;

/*****************************************************************************************************
 * Class Component is the basic GUI Module set of BarFoos 2. It provides automatic html-string transpiling,
 * appending of module nodes, creating and waiting any async events (promises) to keep things in order and will
 * also be augmented with other classes to support GUI modules (Logging, internal Events, DOM utilities)
 *****************************************************************************************************/
class Component extends Composition( LogTools, Mediator, DOMTools, NodeTools ) {
	constructor( options = { } ) {
		super( ...arguments );

		extend( this ).with( options ).and({
			id:						this.constructor.name,
			runtimeDependencies:	[ ]
		});

		if( typeof this.tmpl === 'string' ) {
			extend( this ).with({
				nodes:				this.transpile({ htmlData: this.tmpl, moduleRoot: true }),
				dialogElements:		Object.create( null ),
				spinnerNode:		this.makeNode( '<div class="loading-spinner"></div>' ),
				overlayNode:		this.makeNode( '<div class="BFModalOverlay"></div>' ),
				confirmNode:		this.makeNode( '<div class="BFConfirm"></div>' ),
				location:			this.location,
				nodeLocation:		'beforeend'
			});

			this.data.set( this, Object.create( null ) );

			this.runtimeDependencies.push(
				this.fire( 'waitForDOM.appEvents' )
			);
		} else {
			this.log('worker..?');
		}

		this.fire( 'moduleLaunch.appEvents', {
			id:	this.id
		});
	}

	init() {
		if(!ENV_PROD ) {
			win.bfdebug = () => {
				console.log( this );
			};
		}

		this.on( `newChildModule.${ this.id }`, this.newChildModule, this );
		this.on( `getModuleRootElement.${ this.id }`, this.getModuleRootElement, this );
		this.on( `getModuleDimensions.${ this.id }`, this.getModuleDimensions, this );
		this.on( `dialogMode.core`, this.onDialogModeChange, this );
		this.installModule();

		return Promise.all( this.runtimeDependencies );
	}

	destroy() {
		this.fire( 'moduleDestruction.appEvents', {
			id:	this.id
		});

		this.removeAllNodeEvents();
		this.removeNodes( 'root', true );
		this.removeNodes( 'dialogRoot', true );
		this.data.delete( this );
		this.data	= null;
		this.nodes	= null;

		this.off();

		let refList	= props( this ),
			len		= refList.length;

		while( len-- ) {
			this[ refList[ len ] ] = null;
			delete this[ refList[ len ] ];
		}

		this.__proto__ = null;

		console.log('That is all what remains: ', this);
	}

	installModule() {
		if( typeof this.location === 'string' ) {
			if( this.location in moduleLocations ) {
				if(!this.nodes.dialogRoot ) {
					this.nodes.root.classList.add( 'BFComponent' );
				}

				nodes[ `section.${ this.location }` ].appendChild( this.nodes.dialogRoot || this.nodes.root );
			} else if( this.location in modules.online ) {
				this.fire( `newChildModule.${ this.location }`, {
					node:			this.nodes.dialogRoot || this.nodes.root,
					nodeLocation:	this.nodeLocation
				});
			} else {
				if( typeof modules.awaiting[ this.location ] === undef ) {
					modules.awaiting[ this.location ] = [ ];
				}

				modules.awaiting[ this.location ].push({
					node:			this.nodes.root,
					nodeLocation:	this.nodeLocation
				});
			}
		}
	}

	newChildModule( hookData, event ) {
		this.nodes.defaultChildContainer.insertAdjacentElement( hookData.nodeLocation, hookData.node );
	}

	getModuleRootElement() {
		return this.nodes.root;
	}

	getModuleDimensions() {
		return this.nodes.root.getBoundingClientRect();
	}

	onDialogModeChange( active ) {
		if( active ) {
			this.nodes.root.style.background	= 'inherit';
		} else {
			this.nodes.root.style.background	= '';
		}
	}

	activateSpinner( { at, opts: { location = 'afterbegin', position = { x:0, y:0 }, anchorRect = { }, fitToSize = true } = { } } = { } ) {
		let opts = { location, position, fitToSize, anchorRect };

		this.addNodes({
			nodeData:	this.spinnerNode.cloneNode(),
			nodeName:	'overlaySpinner',
			reference:	{
				node:		at,
				position:	location
			}
		});

		if( opts.fitToSize ) {
			let calcSize					= opts.anchorRect.height / 2;
			this.nodes.overlaySpinner.style.width		= `${calcSize}px`;
			this.nodes.overlaySpinner.style.height		= `${calcSize}px`;
			this.nodes.overlaySpinner.style.borderWidth	= `${calcSize / 10}px`;
		}

		return {
			fulfill:	() => {
				this.removeNodes( 'overlaySpinner', true );
				this.addNodes({
					nodeData:	this.confirmNode.cloneNode(),
					nodeName:	'overlayConfirm',
					reference:	{
						node:		at,
						position:	location
					}
				});
				this.animate({
					node:	this.nodes.overlayConfirm,
					rules:	{
						duration:	1000,
						name:		'unfold'
					}
				});
			},
			cleanup:	() => {
				this.removeNodes( 'overlaySpinner', true );
			}
		};
	}

	createModalOverlay( { at, opts: { location = 'afterbegin', spinner = false } = { } } = { } ) {
		let opts				= { location, spinner },
			controlInterface	= Object.create( null );

		this.addNodes({
			nodeData:	this.overlayNode.cloneNode(),
			nodeName:	'modalOverlay',
			reference:	{
				node:		at,
				position:	location
			}
		});

		if( spinner ) {
			this.nodes.modalOverlay.classList.add( 'flex' );

			controlInterface.spinner = this.activateSpinner({
				at:			this.nodes.modalOverlay,
				opts:		{
					fitToSize:	true,
					anchorRect:	at.getBoundingClientRect()
				}
			});
		}

		controlInterface.cleanup = () => {
			this.removeNodes( 'modalOverlay', true );
		};

		controlInterface.fulfill = async () => {
			this.nodes.modalOverlay.classList.add( 'fulfilled' );

			if( this.nodes.overlayConfirm ) {
				await Promise.all( this.data.get( this.nodes.overlayConfirm ).storage.animations.running );
			}

			let fadeOut = this.animate({
				node:	this.nodes.modalOverlay,
				rules:	{
					duration:	1000,
					name:		'fadeOutOverlay'
				}
			});

			fadeOut.then(() => {
				controlInterface.cleanup();
			});

			return fadeOut;
		};

		return controlInterface;
	}
}
/****************************************** Component End ******************************************/

/*****************************************************************************************************
 * Core entry point
 *****************************************************************************************************/
(async function main() {
	[ normalizeStyle, worldStyle, spinnerStyle, overlayStyle ].forEach( style => style.use() );

	await eventLoop.fire( 'waitForDOM.appEvents' );

	doc.body.appendChild( nodes[ 'div#world' ] );

	// all eyes on us!
	nodes[ 'div#world' ].focus();
}());

/*****************************************************************************************************
 * Core Event handling
 *****************************************************************************************************/
eventLoop.on( 'dialogMode.core', active => {
	if( active ) {
		nodes[ 'section.center' ].style.background	= 'inherit';
	} else {
		nodes[ 'section.center' ].style.background	= '';
	}
});

eventLoop.on( 'getRootNodeOfSection.core', sectionName => {
	return nodes[ `section.${ sectionName }` ];
});

eventLoop.on( 'getSectionDimensions.core', sectionName => {
	return nodes[ `section.${ sectionName }` ].getBoundingClientRect();
});

eventLoop.on( 'mouseWheelUp.appEvents', () => {
	nodes[ 'div#world' ].scrollTop -= scrollSpeed;
});

eventLoop.on( 'mouseWheelDown.appEvents', () => {
	nodes[ 'div#world' ].scrollTop += scrollSpeed;
});

eventLoop.on( 'moduleLaunch.appEvents', ( module, event ) => {
	if( module.id in modules.online ) {
		modules.online[ module.id ]++;
	} else {
		modules.online[ module.id ] = 1;
	}

	if( modules.awaiting[ module.id ] ) {
		for( let hookData of modules.awaiting[ module.id ] ) {
			this.fire( `newChildModule.${ module.id }`, hookData );
		}

		delete modules.awaiting[ module.id ];
	}

	console.log( `module ${module.id} was launched( ${modules.online[module.id]}x )` );
});

eventLoop.on( 'moduleDestruction.appEvents', ( module, event ) => {
	if( module.id in modules.online ) {
		modules.online[ module.id ]--;
	} else {

	}
});

eventLoop.on( 'configApp.core', app => {
	console.log( `Setting up BarFoos Application ${ app.name } version ${ app.version }(${ app.status }).` );

	doc.title	= app.title || 'BarFoos Application';

	if( app.background ) {
		if( typeof app.background.objURL === 'string' ) {
			nodes[ 'div#world' ].style.background = `url( ${ app.background.objURL } )`;
			nodes[ 'div#world' ].classList.add( 'backgroundImage' );

			for( let [ prop, value ] of Object.entries( app.background.css ) ) {
				nodes[ 'div#world' ].style[ prop ] = value;
			}

			nodes[ 'div#world' ].classList.remove( 'blurred' );
		}
	}
});
/****************************************** Event Handling End ****************************************/

export { Component };

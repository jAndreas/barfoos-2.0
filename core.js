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
		scrollSpeed	= 20,
		EaseOut		= power => {return t => { return (.04 - .04 / t) * Math.sin(25 * t) + 1 }},
		ease		= EaseOut( 5 );

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
				nodes:				this.transpile({
										htmlData: this.renderData ? this.render({ htmlData: this.tmpl }).with( this.renderData ).get() : this.tmpl,
										moduleRoot: true
									}),
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

		if( this.dialogElements ) {
			delete this.nodes.root;

			this.removeNodes( 'dialogRoot', true );
		} else {
			this.removeNodes( 'root', true );
		}

		this.data.delete( this );
		this.data			= null;
		this.nodes			= null;
		this.dialogElements	= null;

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
					isDialog:		!!this.nodes.dialogRoot,
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
		if( hookData.isDialog ) {
			this.nodes.defaultDialogContainer.insertAdjacentElement( hookData.nodeLocation, hookData.node );
		} else {
			this.nodes.defaultChildContainer.insertAdjacentElement( hookData.nodeLocation, hookData.node );
		}
	}

	getModuleRootElement() {
		return this.nodes.root;
	}

	getModuleDimensions() {
		return this.nodes.root.getBoundingClientRect();
	}

	async scrollContainerIntoView() {
		let rootElementFromParent = await this.fire( `getModuleRootElement.${ this.location }` );

		if( rootElementFromParent === null ) {
			rootElementFromParent = await this.fire( `getRootNodeOfSection.core`, this.location );
		}

		if( rootElementFromParent instanceof HTMLElement ) {
			rootElementFromParent.scrollIntoView();
		}
	}

	onDialogModeChange( active ) {
		if( active ) {
			this.nodes.root.style.background	= 'inherit';
			this._dialogMode = true;
		} else {
			this.nodes.root.style.background	= '';
			this._dialogMode = false;
		}
	}

	activateSpinner( { at, opts: { location = 'afterbegin', position = { x:0, y:0 }, anchorRect = null, fitToSize = true, relative = false, lowblur = false } = { } } = { } ) {
		let opts = { location, position, fitToSize, anchorRect, relative, lowblur };

		this.addNodes({
			nodeData:	this.spinnerNode.cloneNode(),
			nodeName:	'overlaySpinner',
			reference:	{
				node:		at,
				position:	location
			}
		});

		if( opts.relative ) {
			this.nodes.overlaySpinner.style.position	= 'relative';
		}

		if( opts.lowblur ) {
			this.nodes.overlaySpinner.style.filter		= 'blur(2px)';
		}

		if( opts.anchorRect === null ) {
			opts.anchorRect = at.getBoundingClientRect();
		}

		if( opts.fitToSize ) {
			let calcSize								= opts.anchorRect.height / 2;
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

				if( opts.relative ) {
					this.nodes.overlayConfirm.style.position	= 'relative';
				}

				if( opts.anchorRect === null ) {
					opts.anchorRect = at.getBoundingClientRect();
				}

				if( opts.fitToSize ) {
					let calcSize								= opts.anchorRect.height / 2;
					this.nodes.overlayConfirm.style.width		= `${calcSize}px`;
					this.nodes.overlayConfirm.style.height		= `${calcSize}px`;
					this.nodes.overlayConfirm.style.borderWidth	= `${calcSize / 10}px`;
				}

				return this.animate({
					node:	this.nodes.overlayConfirm,
					rules:	{
						duration:	1000,
						name:		'unfold'
					}
				});
			},
			cleanup:	async ( duration ) => {
				if( duration ) {
					await this.animate({
						node:	this.nodes.overlaySpinner,
						rules:	{
							duration:	duration,
							name:		'fadeOutOverlay'
						}
					});
				}

				this.removeNodes( 'overlaySpinner', true );
				this.removeNodes( 'overlayConfirm', true );
			}
		};
	}

	createModalOverlay( { at, opts: { location = 'afterbegin', spinner = false, inheritBackground = false } = { } } = { } ) {
		let opts				= { location, spinner },
			controlInterface	= Object.create( null );

		if( this.modalOverlay && typeof this.modalOverlay.cleanup === 'function' ) {
			this.modalOverlay.cleanup();
			this.modalOverlay = null;
		}

		this.addNodes({
			nodeData:	this.overlayNode.cloneNode(),
			nodeName:	'modalOverlay',
			reference:	{
				node:		at,
				position:	location
			}
		});

		this.nodes.modalOverlay.classList.add( 'flex' );

		if( inheritBackground ) {
			this.nodes.modalOverlay.classList.add( 'inheritBackground' );
		}

		if( spinner ) {
			controlInterface.spinner = this.activateSpinner({
				at:			this.nodes.modalOverlay,
				opts:		{
					fitToSize:	true,
					anchorRect:	at.getBoundingClientRect()
				}
			});
		}

		controlInterface.cleanup = () => {
			if( spinner ) {
				controlInterface.spinner.cleanup();
			}

			this.removeNodes( 'modalOverlay', true );
			delete this.modalOverlay;
		};

		controlInterface.log = async ( msg, duration = 3000 ) => {
			if(!this.nodes.modalOverlay ) {
				return;
			}

			this.nodes.modalOverlay.innerHTML = `<div style="word-wrap:break-word;font-size:2vh;width:80%">${ msg }</div>`;
			return this.timeout( duration );
		};

		controlInterface.fulfill = async ( duration = 1000 ) => {
			if(!this.nodes.modalOverlay ) {
				return;
			}

			if(!inheritBackground ) {
				this.nodes.modalOverlay.classList.add( 'fulfilled' );
			}

			if( this.nodes.overlayConfirm ) {
				await Promise.all( this.data.get( this.nodes.overlayConfirm ).storage.animations.running );
			}

			let fadeOut = this.animate({
				node:	this.nodes.modalOverlay,
				rules:	{
					duration:	duration,
					name:		'fadeOutOverlay'
				}
			});

			fadeOut.then(() => {
				controlInterface.cleanup();
			});

			return fadeOut;
		};

		this.modalOverlay = controlInterface;
	}

	render({ htmlData = '', standalone = false }) {
		return {
			with:	replacementHash => {
				for( let [ searchFor, value ] of Object.entries( replacementHash ) ) {
					htmlData = htmlData.replace( new RegExp( '%' + searchFor + '%', 'g' ), value.toString().replace( /\n/g, '<br/>') );
				}

				return {
					at:		reference => {
						this.addNodes({ htmlData, reference, standalone });
					},
					get:	() => {
						return htmlData;
					}
				};
			}
		};
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

nodes[ 'section.center' ].addEventListener( 'scroll', event => {
	eventLoop.fire( 'centerScroll.appEvents', {
		offsetTop:		nodes[ 'section.center' ].scrollTop,
		innerHeight:	win.innerHeight
	});
}, false);

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

eventLoop.on( 'setScrollingStatus.core', status => {
	switch( status ) {
		case 'disable':
			nodes[ 'section.center' ].style.overflowY = 'hidden';
			break;

		case 'enable':
			nodes[ 'section.center' ].style.overflowY = 'scroll';
			break;
	}
});

eventLoop.on( 'getRootNodeOfSection.core', sectionName => {
	return nodes[ `section.${ sectionName }` ];
});

eventLoop.on( 'getSectionDimensions.core', sectionName => {
	return nodes[ `section.${ sectionName }` ].getBoundingClientRect();
});

eventLoop.on( 'getScrollOffset.core', () => {
	return {
		scrollTop: nodes[ 'section.center' ].scrollTop,
		scrollLeft: nodes[ 'section.center' ].scrollLeft
	};
});

/*eventLoop.on( 'mouseWheelUp.appEvents', () => {
	//nodes[ 'section.center' ].scrollTop -= scrollSpeed;
});

eventLoop.on( 'mouseWheelDown.appEvents', () => {
	//nodes[ 'section.center' ].scrollTop += scrollSpeed;
});*/

eventLoop.on( 'slideDownTo.appEvents', node => {
	let	count		= 1,
		prog		= 1 / 100,
		accel		= 0,
		endValue	= nodes[ 'section.center' ].scrollTop + node.getBoundingClientRect().top;

	function step() {
		nodes[ 'section.center' ].scrollTop += ease( count ) + (5*accel);
		count -= prog;
		accel += 5;

		if( node.getBoundingClientRect().top > 0 ) {
			win.requestAnimationFrame( step );
		} else {
			nodes[ 'section.center' ].scrollTop = endValue;
		}
	}

	win.requestAnimationFrame( step );
});

eventLoop.on( 'slideUpTo.appEvents', node => {
	let	count		= 1,
		prog		= 1 / 100,
		accel		= 0,
		endValue	= node.getBoundingClientRect().top - nodes[ 'section.center' ].scrollTop;

	function step() {
		nodes[ 'section.center' ].scrollTop -= ease( count ) + (5 * accel);
		count -= prog;
		accel += 5;

		if( node.getBoundingClientRect().top < 0 ) {
			win.requestAnimationFrame( step );
		} else {
			nodes[ 'section.center' ].scrollTop = endValue;
		}
	}

	win.requestAnimationFrame( step );
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

		console.log( `module ${module.id} was destroyed( ${modules.online[module.id]}x instances left )` );
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

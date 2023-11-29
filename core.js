'use strict';

import { extend, Composition, MakeClass, props, Seconds, type, isMobileDevice } from './toolkit.js';
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

const	eventLoop		= MakeClass( class coreEventLoop{ }, { id: 'coreEventLoop' } ).Mixin( Mediator ),
		console			= MakeClass( class core{ }, { id: 'core'} ).Mixin( LogTools ),
		DOM				= MakeClass( class DOM{ }, { id: 'DOM'} ).Mixin( Mediator, DOMTools ),
		loadedScripts	= Object.create( null ),
		modules			= Object.create( null );

		modules.online		= Object.create( null );
		modules.awaiting	= Object.create( null );

const 	nodes			= DOM.transpile({ htmlData: worldMarkup }),
		scrollSpeed		= 20,
		EaseOut			= power => {return t => { return (.04 - .04 / t) * Math.sin(25 * t) + 1 }},
		ease			= EaseOut( 5 );

let		lastScrollEvent	= 0,
		observerTimer	= 0,
		overlayTimeout	= Seconds( 3 ),
		anotherWorld	= false,
		noFrame			= false,
		greenScreenMode	= false;

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
				nodeLocation:		this.nodeLocation || 'beforeend',
				_insightViewport:	null,
				DOMParsingSpeed:	'performance' in win ? win.performance.timing.domComplete - win.performance.timing.domLoading : null
			});

			this.runtimeDependencies.push(
				this.fire( 'waitForDOM.appEvents' )
			);

			this.data.set( this, Object.create( null ) );
		} else {
			this.log('worker..?');
		}
	}

	async init() {
		super.init && super.init( ...arguments );

		if( typeof ENV_PROD === 'undefined' ) {
			win.bfdebug = () => {
				console.log( this );
			};
		}

		this._boundMediaChange = this.mediaChanged.bind( this );
		this.setupMediaQueryWatchers();

		this.on( `newChildModule.${ this.name }`, this.newChildModule, this );
		this.on( `getModuleRootElement.${ this.name }`, this.getModuleRootElement, this );
		this.on( `getModuleDimensions.${ this.name }`, this.getModuleDimensions, this );
		this.on( `findModule.${ this.name }`, this.findModule, this );
		this.on( `getModuleDimensionsByName.${ this.name }`, this.getModuleDimensions, this );
		this.on( `slideDownTo.${ this.name }`, this.slideDownTo, this );
		this.on( `switchTo.${ this.name }`, this.switchTo, this );
		this.on( 'dialogMode.core', this.onDialogModeChange, this );
		this.on( 'mobileNavMenuChange.core', this.onMobileNavMenuChange, this );
		this.on( 'centerScroll.appEvents', this.onCenterScrollCore, this );
		this.on( 'moduleDestruction.appEvents', this.onModuleDestruction, this );

		if(!anotherWorld ) {
			// disabled the overlay spinner because it seems like it serves no reasonable purpose at this point
			await this.installModule();

			let overlayTimeoutId;

			if( this.loadWithSpinner ) {
				this.createModalOverlay({
					opts:	{
						spinner: true
					}
				});

				this.modalOverlay && this.modalOverlay.suspend();

				overlayTimeoutId = win.setTimeout(() => {
					this.modalOverlay && this.modalOverlay.log( 'Irgendetwas stimmt nicht...' );
					this.modalOverlay && this.modalOverlay.return();
				}, overlayTimeout);
			}


			this._depsResolve = await Promise.all( this.runtimeDependencies );

			win.clearTimeout( overlayTimeoutId );

			if( this.loadWithSpinner ) {
				if( this.loadingMessage ) {
					this.modalOverlay && this.modalOverlay.log( this.loadingMessage, this.loadingMessageDelay || 0 );
				}
			}

			this.onCenterScrollCore( true );

			this.fire( 'moduleLaunch.appEvents', {
				id:		this.name,
				name:	this.name,
				state:	this
			});

			if( this.loadWithSpinner ) {
				this.modalOverlay && this.modalOverlay.fulfill();
			}
		}
	}

	async destroy() {
		this.fire( 'moduleDestruction.appEvents', {
			id:		this.id,
			name:	this.name,
			root:	this.nodes.root
		});

		this.destroyMediaQueryWatchers();
		this.removeAllNodeEvents();

		if( Object.keys( this.dialogElements ).length ) {
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

		if( ENV_PROD === false ) console.log('That is all what remains: ', this);
	}

	async installModule() {
		if( typeof this.location === 'string' ) {
			if( this.location in moduleLocations ) {
				if(!this.nodes.dialogRoot ) {
					this.nodes.root.classList.add( 'BFComponent' );
				}

				nodes[ `section.${ this.location }` ].appendChild( this.nodes.dialogRoot || this.nodes.root );
			} else if( this.location in modules.online ) {
				await this.fire( `newChildModule.${ this.location }`, {
					isDialog:		!!this.nodes.dialogRoot,
					node:			this.nodes.dialogRoot || this.nodes.root,
					nodeLocation:	this.nodeLocation,
					nodeAnchor:		this.nodeAnchor
				});
			} else {
				if(!(this.location in modules.awaiting) ) {
					modules.awaiting[ this.location ] = [ ];
				}

				modules.awaiting[ this.location ].push({
					node:			this.nodes.root,
					nodeLocation:	this.nodeLocation,
					nodeAnchor:		this.nodeAnchor
				});
			}
		}
	}

	onModuleDestruction( module ) {
		if( (this.location === module.id || this.location === module.name) && module.root.contains( this.nodes.root ) ) {
			this.destroy();
		}
	}

	setupMediaQueryWatchers() {
		extend( this ).with({
			res360:			win.matchMedia( '(min-width:415px) and (min-height:370px)' ),
			res480:			win.matchMedia( '(min-width:736px) and (min-height:490px)' ),
			res480wide:		win.matchMedia( '(min-width:870px)' ),
			res720:			win.matchMedia( '(min-width:1300px) and (min-height:900px)' )
		});

		[ this.res360, this.res480, this.res480wide, this.res720 ].forEach( res => {
			res.addListener( this._boundMediaChange );
		});
	}

	destroyMediaQueryWatchers() {
		[ this.res360, this.res480, this.res480wide, this.res720 ].forEach( res => {
			res.removeListener( this._boundMediaChange );
		});
	}

	mediaChanged( data ) {
		switch( data.media ) {
			case '(min-height: 370px) and (min-width: 415px)':
				this._mediaMode = 'iPhone6Portrait';
				break;
			case '(min-height: 490px) and (min-width: 736px)':
				this._mediaMode = 'iPhone6Landscape';
				break;
			default:
				this._mediaMode = 'desktop';
		}

		super.mediaChanged && super.mediaChanged( mode );
	}

	newChildModule( hookData, event ) {
		if( hookData.isDialog ) {
			if( hookData.nodeAnchor ) {
				this.nodes[ hookData.nodeAnchor ].replaceWith( hookData.node );
			} else if( this.nodes.defaultDialogContainer instanceof HTMLElement ) {
				this.nodes.defaultDialogContainer.insertAdjacentElement( hookData.nodeLocation, hookData.node );
			} else {
				this.log( `Error: No defaultDialogContainer set` );
			}
		} else {
			if( hookData.nodeAnchor ) {
				this.nodes[ hookData.nodeAnchor ].replaceWith( hookData.node );
			} else if( this.nodes.defaultChildContainer instanceof HTMLElement ) {
				this.nodes.defaultChildContainer.insertAdjacentElement( hookData.nodeLocation, hookData.node );
			} else {
				this.log( `Error: No defaultChildContainer set` );
			}
		}
	}

	findModule() {
		return true;
	}

	getModuleRootElement() {
		return this.nodes.root;
	}

	getModuleDimensions() {
		return this.nodes.dialogRoot ? this.nodes.dialogRoot.getBoundingClientRect() : this.nodes.root.getBoundingClientRect();
	}

	slideDownTo() {
		this.fire( 'slideDownTo.appEvents', this.nodes.root );
	}

	switchTo() {
		this.nodes.root.scrollIntoView();
	}

	async scrollContainerIntoView() {
		let rootElementFromParent = await this.fire( `getModuleRootElement.${ this.location }` );

		if( rootElementFromParent === null ) {
			rootElementFromParent = await this.fire( `getRootNodeOfSection.core`, this.location );
		}

		if( rootElementFromParent instanceof HTMLElement ) {
			rootElementFromParent.scrollIntoView();
			rootElementFromParent.scrollTop = 0;
		}
	}

	onDialogModeChange( active ) {
		if( active ) {
			//this.nodes.root.style.background	= 'inherit';
			this._dialogMode = true;
		} else {
			//this.nodes.root.style.background	= '';
			this._dialogMode = false;
		}
	}

	onMobileNavMenuChange( state ) {
		if( this.location === moduleLocations.center && this.name !== 'NavSection' ) {
			if( state === 'open' ) {
				this.nodes.root.classList.add( 'navBlur' );
			} else {
				this.nodes.root.classList.remove( 'navBlur' );
			}
		}
	}

	onCenterScrollCore( skipReturn ) {
		let clientRect			= this.nodes.root.getBoundingClientRect(),
			centerOfViewport	= win.innerHeight / 2;

		if( clientRect.top <= centerOfViewport && clientRect.bottom >= centerOfViewport ) {
			if(!this._insightViewport ) {
				this._insightViewport = true;
				this.inViewport({ enteredFrom: clientRect.top > 0 ? 'top' : 'bottom', skipReturn });
			}
		} else {
			if( this._insightViewport ) {
				this._insightViewport = false;
				this.offViewport();
			}
		}

		super.onCenterScrollCore  && super.onCenterScrollCore( ...arguments );
	}

	inViewport({ enteredFrom = '', skipReturn = false } = { }) {
		super.inViewport && super.inViewport( ...arguments );

		if(!skipReturn ) {
			this.modalOverlay && this.modalOverlay.return();
		}
	}

	offViewport() {
		super.offViewport && super.offViewport( ...arguments );

		this.modalOverlay && this.modalOverlay.suspend();
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
			let calcSize								= ( opts.anchorRect.height / 2 ) * ( 0.8 );
			this.nodes.overlaySpinner.style.width		= `${calcSize}px`;
			this.nodes.overlaySpinner.style.height		= `${calcSize}px`;
			this.nodes.overlaySpinner.style.borderWidth	= `${calcSize / 14}px`;
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
					let calcSize								= ( opts.anchorRect.height / 2 ) * ( 0.8 );
					this.nodes.overlayConfirm.style.width		= `${calcSize}px`;
					this.nodes.overlayConfirm.style.height		= `${calcSize}px`;
					this.nodes.overlayConfirm.style.borderWidth	= `${calcSize / 14}px`;
				}

				let overlayConfirmAnimation = this.animate({
					node:	this.nodes.overlayConfirm,
					rules:	{
						duration:	200,
						name:		'unfold'
					}
				});

				if( this.modalOverlay ) {
					this.modalOverlay.possibleDelays.push( overlayConfirmAnimation );
				}

				return overlayConfirmAnimation;
			},
			cleanup:	async ( duration ) => {
				if( duration ) {
					let overlaySpinnerAnimation = this.animate({
						node:	this.nodes.overlaySpinner,
						rules:	{
							duration:	duration,
							name:		'fadeOutOverlay'
						}
					});

					if( this.modalOverlay ) {
						this.modalOverlay.possibleDelays.push( overlaySpinnerAnimation );
					}

					await overlaySpinnerAnimation;
				}

				this.removeNodes( 'overlaySpinner', true );
				this.removeNodes( 'overlayConfirm', true );
				this.removeNodes( 'modalOverlay', true );
			},
			log:		( msg ) => {
				this.nodes.overlaySpinner.insertAdjacentHTML( 'afterend', `<div style="word-wrap:break-word;font-size:2vh;color:white;text-align:center;background:#00000094;border-radius:10px;padding:5px;">${ msg }</div>` );
				this.nodes.overlaySpinner.classList.add( 'blurred' );
			},
			hide:		() => {
				if( this.nodes.overlaySpinner ) {
					this.nodes.overlaySpinner.style.display = 'none';
				}
			},
			show:		() => {
				if( this.nodes.overlaySpinner ) {
					this.nodes.overlaySpinner.style.display = 'block';
				}
			}
		};
	}

	async createModalOverlay( { at = this.nodes.root, opts: { location = 'afterbegin', spinner = false, inheritBackground = false } = { } } = { } ) {
		let opts				= { location, spinner },
			controlInterface	= Object.create( null );

		if( this.modalOverlay ) {
			//await Promise.all( this.data.get( this.nodes.modalOverlay ).storage.animations.running );
			this.modalOverlay && this.modalOverlay.cleanup();
			this.modalOverlay = null;
			delete this.modalOverlay;
		}

		if( this.nodes.modalOverlay ) {
			this.removeNodes( 'modalOverlay', true );
			delete this.modalOverlay;
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

		controlInterface.log = async ( msg, duration ) => {
			if(!this.nodes.modalOverlay ) {
				return;
			}

			if( spinner ) {
				controlInterface.spinner.log( msg );
			} else {
				this.nodes.modalOverlay.innerHTML = `<div style="word-wrap:break-word;font-size:2vh;color:white;text-align:center;width:85%">${ msg }</div>`;
			}

			if( duration ) {
				let timeoutPromise = this.timeout( duration );

				controlInterface.possibleDelays.push( timeoutPromise );

				return timeoutPromise;
			} else {
				return null;
			}
		};

		controlInterface.fulfill = async ( duration = 200 ) => {
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

			controlInterface.possibleDelays.push( fadeOut );

			return fadeOut;
		};

		controlInterface.suspend = () => {
			if( this.nodes.modalOverlay && spinner ) {
				controlInterface.spinner.hide();
				controlInterface.suspended = true;
			}
		};

		controlInterface.return = () => {
			if( this.nodes.modalOverlay && spinner ) {
				controlInterface.spinner.show();
			}
		};

		controlInterface.possibleDelays = [ ];
		
		this.modalOverlay = controlInterface;
	}

	render({ htmlData = '', standalone = false, crlf = false }) {
		return {
			with:	replacementHash => {
				for( let [ searchFor, value ] of Object.entries( replacementHash ) ) {
					if( typeof value === 'object' ) {
						continue;
					}

					if( crlf ) {
						htmlData = htmlData.replace( new RegExp( '%' + searchFor + '%', 'g' ), (value !== undef ? value : '').toString().replace( /<br>|<br\/>/g, '\n' ) );
					} else {
						htmlData = htmlData.replace( new RegExp( '%' + searchFor + '%', 'g' ), (value !== undef ? value : '').toString().replace( /\n/g, '<br/>') );
					}
				}

				return {
					at:		reference => {
						let hash = this.addNodes({ htmlData, reference, standalone });

						let templateLogic = Array.from( hash.localRoot.querySelectorAll( '[logic]' ) );
						templateLogic.push( hash.localRoot );

						if( templateLogic.length ) {
							for( let node of templateLogic ) {
								let instructions = JSON.parse( node.getAttribute( 'logic' ) );
								
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
						return hash;
					},
					get:	() => {
						return htmlData;
					}
				};
			}
		};
	}

	loadImage( url ) {
		try {
			return fetch( url ).then( res => res.blob() ).then( blob => URL.createObjectURL( blob ) );
		} catch ( ex ) {
			this.log( `Error: ${ ex.message }` );
		}
	}

	loadScript( url ) {
		return new Promise( ( res, rej ) => {
			try {
				if( loadedScripts[ url ] ) {
					res();
					return;
				}

				let scr		= doc.createElement( 'script' );
				scr.type	= 'text/javascript';
				scr.src		= url;
				scr.async	= true;
				scr.defer	= true;
				scr.onload	= () => { res(); };

				doc.head.appendChild( scr );

				loadedScripts[ url ] = true;
			} catch( ex ) {
				this.log( `Error: ${ ex.message }` );
				rej( ex.message );
			}
		});
	}
}
/****************************************** Component End ******************************************/

/*****************************************************************************************************
 * Core entry point
 *****************************************************************************************************/
async function main( performanceCheck = true ) {
	[ normalizeStyle, worldStyle, spinnerStyle, overlayStyle ].forEach( style => style.use() );

	await eventLoop.fire( 'waitForDOM.appEvents' );

	anotherWorld = !!doc.querySelector( 'div#world' );

	if( anotherWorld ) {
		return;
	}

	if( performanceCheck ) {
		if( 'performance' in win ) {
			let renderSpeed = win.performance.timing.domComplete - win.performance.timing.domLoading;

			if( renderSpeed > 700 ) {
				nodes[ 'div#world' ].classList.add( 'lowRes' );
			}
		} else {
			nodes[ 'div#world' ].classList.add( 'lowRes' );
		}
	}

	doc.body.appendChild( nodes[ 'div#world' ] );

	// all eyes on us!
	nodes[ 'div#world' ].focus();
};

nodes[ 'section.center' ].addEventListener( 'scroll', event => {
	if( Date.now() - lastScrollEvent > 100 ) {
		eventLoop.fire( 'centerScroll.appEvents', nodes[ 'section.center' ].scrollTop );

		lastScrollEvent = Date.now();
	}

	// clear current offset timeout
	win.clearTimeout( observerTimer );

	// make sure centerScroll fires at least one time	
	observerTimer = win.setTimeout(() => {
		eventLoop.fire( 'centerScroll.appEvents', nodes[ 'section.center' ].scrollTop );
	}, 200);
}, false);

/*****************************************************************************************************
 * Core Event handling
 *****************************************************************************************************/
eventLoop.on( 'greenScreenMode.appEvents', () => {
	nodes[ 'section.right' ].remove();
	nodes[ 'section.footer' ].remove();
	nodes[ 'section.center' ].style.height = '100vh';
	nodes[ 'section.center' ].style.flexBasis = '100%';
	nodes[ 'div#world' ].style.backgroundImage = 'none';
	nodes[ 'div#world' ].style.backgroundColor = 'transparent';
	nodes[ 'div#world' ].classList.remove( 'backgroundImage' );
	greenScreenMode = true;
});

eventLoop.on( 'noFrame.appEvents', () => {
	nodes[ 'section.right' ].remove();
	nodes[ 'section.left' ].remove();
	nodes[ 'section.footer' ].remove();
	nodes[ 'section.head' ].remove();
	nodes[ 'section.center' ].style.height = '100vh';
	nodes[ 'section.center' ].style.flexBasis = '100%';
	noFrame = true;
});

eventLoop.on( 'dialogMode.core', data => {
	if( data.active ) {
		//nodes[ 'section.center' ].style.background	= 'inherit';
		nodes[ 'section.center' ].classList.add( 'dialogBlur' );
		nodes[ 'section.head' ].classList.add( 'dialogBlur' );

		if(!data.visibleChat) {
			nodes[ 'section.right' ].classList.add( 'dialogBlur' );
		}
	} else {
		//nodes[ 'section.center' ].style.background	= '';
		nodes[ 'section.center' ].classList.remove( 'dialogBlur' );
		nodes[ 'section.right' ].classList.remove( 'dialogBlur' );
		nodes[ 'section.head' ].classList.remove( 'dialogBlur' );
	}
});

eventLoop.on( 'dialogModeModal.core', data => {
	if( data.active ) {
		nodes[ 'section.center' ].classList.add( 'dialogNoPointerEvents' );
	} else {
		nodes[ 'section.center' ].classList.remove( 'dialogNoPointerEvents' );
	}
});

eventLoop.on( 'mobileNavMenuChange.core', state => {
	if( state === 'open' ) {
		nodes[ 'section.right' ].classList.add( 'dialogBlur' );
	} else {
		nodes[ 'section.right' ].classList.remove( 'dialogBlur' );
	}
});

eventLoop.on( 'pushToSky.core', elem => {
	nodes[ 'div#world' ].insertAdjacentElement( 'beforebegin', elem );
});

eventLoop.on( 'getWorld.core', () => {
	return nodes[ 'div#world' ];
});

eventLoop.on( 'enableChatSideBar.core', () => {
	nodes[ 'section.center' ].classList.add( 'chatSideBar' );
});

eventLoop.on( 'disableChatSideBar.core', () => {
	nodes[ 'section.center' ].classList.remove( 'chatSideBar' );
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
	return new Promise(( res, rej ) => {
		/*let	count		= 1,
		prog		= 1 / 100,
		accel		= 0,
		endValue	= nodes[ 'section.center' ].scrollTop + node.getBoundingClientRect().top;

		function step() {
			nodes[ 'section.center' ].scrollTop += ease( count ) + (5*accel);
			count -= prog;
			accel += 3;

			if( Math.round( node.getBoundingClientRect().top ) > 0 ) {
				win.requestAnimationFrame( step );
			} else {
				nodes[ 'section.center' ].scrollTop = endValue;
				nodes[ 'section.center' ].scrollIntoView();
				eventLoop.fire( 'centerScroll.appEvents' );
				res();
			}
		}

		win.requestAnimationFrame( step );*/
		node.scrollIntoView();
		res();
	});
});

eventLoop.on( 'slideUpTo.appEvents', node => {
	return new Promise(( res, rej ) => {
		/*let	count		= 1,
		prog		= 1 / 100,
		accel		= 0,
		endValue	= nodes[ 'section.center' ].scrollTop - Math.abs( node.getBoundingClientRect().top );

		function step() {
			nodes[ 'section.center' ].scrollTop -= ease( count ) + (5 * accel);
			count -= prog;
			accel += 3;

			if( node.getBoundingClientRect().top < 0 ) {
				win.requestAnimationFrame( step );
			} else {
				nodes[ 'section.center' ].scrollTop = endValue;
				nodes[ 'section.center' ].scrollIntoView();
				res();
			}
		}

		win.requestAnimationFrame( step );*/
		node.scrollIntoView();
		res();
	});
});

eventLoop.on( 'moduleLaunch.appEvents', ( module, event ) => {
	if( module.name in modules.online ) {
		modules.online[ module.name ]++;
	} else {
		modules.online[ module.name ] = 1;
	}

	if( modules.awaiting[ module.name ] ) {
		for( let hookData of modules.awaiting[ module.name ] ) {
			eventLoop.fire( `newChildModule.${ module.name }`, hookData );
		}

		delete modules.awaiting[ module.name ];
	}

	if( ENV_PROD === false ) console.log( `module ${module.name} was launched( ${modules.online[module.name]}x )` );
});

eventLoop.on( 'moduleDestruction.appEvents', ( module, event ) => {
	if( module.name in modules.online ) {
		modules.online[ module.name ]--;

		if( ENV_PROD === false ) console.log( `module ${module.name} was destroyed( ${modules.online[module.name]}x instances left )` );

		if( modules.online[ module.name ] === 0 ) {
			delete modules.online[ module.name ];
		}
	} else {

	}
});

eventLoop.on( 'requestMobileNavigation.core', state => {
	if( nodes[ 'section.center' ].classList.contains( 'mobileNavMode' ) ) {
		nodes[ 'section.center' ].classList.remove( 'mobileNavMode' );
		nodes[ 'section.center' ].removeEventListener( 'touchstart', endNavMode );
	} else {
		nodes[ 'section.center' ].classList.add( 'mobileNavMode' );
		nodes[ 'section.center' ].removeEventListener( 'touchstart', endNavMode );
		nodes[ 'section.right' ].scrollIntoView();

	//	win.setTimeout(() => {
			nodes[ 'section.center' ].addEventListener( 'touchstart', endNavMode, false );
	//	},100);
	}

	function endNavMode() {
		nodes[ 'section.center' ].classList.remove( 'mobileNavMode' );
		nodes[ 'section.center' ].removeEventListener( 'touchstart', endNavMode );
		eventLoop.fire( 'remoteNavigate.appEvents' );
	}
});

eventLoop.on( 'loadScript.core', ( src = '' ) => {
	return new Promise(( res, rej ) => {
		let scr			= doc.createElement( 'script' );
			scr.src		= src;
			scr.async	= true;
			scr.defer	= true;
			scr.onload	= () => {
				res();
			};
			scr.onerror	= () => {
				rej();
			};

		doc.body.appendChild( scr );
	});
});

eventLoop.on( 'configApp.core', app => {
	if( ENV_PROD === false ) console.log( `Setting up BarFoos Application ${ app.name } version ${ app.version }(${ app.status }).` );

	doc.title	= app.title || 'BarFoos Application';

	if( app.background && !greenScreenMode ) {
		if( typeof app.background.objURL === 'string' ) {
			nodes[ 'div#world' ].style.backgroundImage = `${ app.background.gradient || 'linear-gradient(0deg, rgba(56, 55, 46, 0.6), rgba(50, 48, 46, 0.9))' }, url( ${ app.background.objURL } )`;
			nodes[ 'div#world' ].classList.add( 'backgroundImage' );

			for( let [ prop, value ] of Object.entries( app.background.css ) ) {
				nodes[ 'div#world' ].style[ prop ] = value;
			}
		}
	}
});
/****************************************** Event Handling End ****************************************/

export { main, Component };

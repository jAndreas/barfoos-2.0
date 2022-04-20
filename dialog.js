'use strict';

import { Component } from './core.js';
import { VK } from './defs.js';
import { extend, MakeClass, isMobileDevice } from './toolkit.js';
import { win, doc, undef } from './domkit.js';

import dialogStyle from './css/dialog.scss';
import dialogMarkup from './html/dialog.html';

let overlayInstances = 0;

class Overlay extends Component {
	constructor( input = { }, options = { } ) {
		super( ...arguments  );

		extend( this ).with({
			relativeCursorPositionLeft:		0,
			relativeCursorPositionTop:		0,
			dialogElements:					this.transpile({ htmlData: dialogMarkup, moduleRoot: true })
		});

		this.dialogElements[ 'div.title' ].textContent = this.title || '';
	}

	async init() {
		if( typeof this.location !== 'string' ) {
			this.error( `Destonation is required for options.location. Received ${ this.location } instead.` );
		}

		overlayInstances++;

		if( overlayInstances === 1 ) {
			this.fire( 'dialogMode.core', { active: !this.standAlone, visibleChat: this.visibleChat } );
		}

		this.on( 'appOrientationChange.appEvents', this.orientationChange, this );
		this.on( 'down.keys', this.onKeyDown, this );

		if(!this.avoidOutsideClickClose ) {
			this.on( 'mousedown.appEvents', this.onBackgroundMouseDown, this );
		}

		super.init && await super.init();
	}

	async destroy() {
		//if( !this.fixed ) {
			overlayInstances--;
		//}

		this.dialogElements[ 'div.bfDialogWrapper' ].style.display = 'none';

		if( this.modalDialog ) {
			//this.removeNodes( 'div#__modalDialogOverlay', true );
			this.fire( 'dialogModeModal.core', { active: false } );
		}

		if( overlayInstances === 0 ) {
			if( this.modalOverlay ) {
				await this.modalOverlay.fulfill();
			}

			//this.fire( 'setScrollingStatus.core', 'enable' );
			this.fire( 'dialogMode.core', false );
		}

		super.destroy && await super.destroy();
	}

	async installModule() {
		this.dialogElements[ 'div.bfContentDialogBody' ].insertAdjacentElement( 'beforeend', this.nodes.root );
		this.nodes.dialogRoot = this.dialogElements.root;

		super.installModule && super.installModule();

		if( this.hoverOverlay ) {
			this.dialogElements[ 'div.overlayTitle' ].textContent = this.title || '';
			this.nodes.dialogRoot.classList.add( 'hoverOverlay' );

			if( this.hoverOverlay.maximize ) {
				if(!isMobileDevice ) {
					this.addNodeEvent( 'div.overlayMax', 'click', this.onOverlayCloseMax );
					this.dialogElements[ 'div.overlayMax' ].style.display = 'flex';
				}
			}

			if( this.hoverOverlay.close ) {
				this.dialogElements[ 'div.overlayClose' ].addEventListener('click', this.onOverlayCloseClick.bind( this ), false );
				this.dialogElements[ 'div.overlayClose' ].style.display = 'flex';
			}
		}

		if( this.position ) {
			this.nodes.dialogRoot.style.left	= `${this.position.left}px`;
			this.nodes.dialogRoot.style.top		= `${this.position.top}px`;
		}

		if( this.center ) {
			this.centerOverlay();
		} else if( this.centerToViewport ) {
			this.centerOverlay({ centerToViewport: true });
		}

		if( this.topMost ) {
			this.nodes.dialogRoot.style.zIndex	= 101;
		}

		if( this.modalDialog ) {
			/*this.addNodes({
				htmlData:	'<div id="__modalDialogOverlay" style="position:absolute;top:0;left:0;height:100vh;width:100vw;z-index:999"></div>',
				reference:	{
					node:		this.modalDialog.global ? await this.fire( 'getWorld.core' ) : this.nodes.dialogRoot,
					position:	'afterBegin'
				}
			});*/

			this.fire( 'dialogModeModal.core', { active: true } );
		}

		if( this.fixed ) {
			this.nodes.dialogRoot.style.position = this.standAlone ? 'static' : 'absolute';
			this.nodes.dialogRoot.style.background = 'linear-gradient(1750deg, rgba(255, 251, 251, 0.9), rgb(26 45 74))';
			this.dialogElements[ 'div.bfBlurDialogBody' ].remove();
			this.fire( 'pushToSky.core', this.nodes.dialogRoot );
		}

		if( this.noBlur ) {
			this.nodes.dialogRoot.style.background = 'linear-gradient(1750deg, rgba(255, 251, 251, 0.9), rgb(26 45 74))';
			this.dialogElements[ 'div.bfBlurDialogBody' ].remove();
		}

		if( this.background ) {
			this.nodes.dialogRoot.style.background			= this.background;
			this.nodes.dialogRoot.style.backgroundRepeat	= 'no-repeat, no-repeat';
			this.nodes.dialogRoot.style.backgroundSize		= 'contain, contain';
			this.nodes.dialogRoot.style.backgroundPosition	= 'center center, center center';
		}
	}

	onOverlayCloseClick( event ) {
		event.stopPropagation();

		this.destroy();

		return false;
	}

	onOverlayCloseMax( event ) {
		event.stopPropagation();

		super.onOverlayCloseMax && super.onOverlayCloseMax( ...arguments );
	}

	scrollDialogContainerDown() {
		let contentBodyHeight	= this.dialogElements[ 'div.bfContentDialogBody' ].offsetHeight,
			installedRootHeight	= this.nodes.root.offsetHeight;

		if( installedRootHeight > contentBodyHeight ) {
			this.dialogElements[ 'div.bfContentDialogBody' ].scrollTop = installedRootHeight - contentBodyHeight;
		}
	}

	scrollDialogContainerUp() {
		this.dialogElements[ 'div.bfContentDialogBody' ].scrollTop = 0;
	}

	scrollElementIntoView( node ) {
		if( typeof node === 'string' ) {
			node = this.nodes[ node ] || this.dialogElements[ node ];
		}

		if( node instanceof HTMLElement ) {
			let nodeRect		= node.getBoundingClientRect(),
				containerRect	= this.dialogElements[ 'div.bfContentDialogBody' ].getBoundingClientRect(),
				scrollTop		= this.dialogElements[ 'div.bfContentDialogBody' ].scrollTop;

			if( nodeRect.bottom > containerRect.bottom ) {
				this.dialogElements[ 'div.bfContentDialogBody' ].scrollTop = (nodeRect.bottom - containerRect.bottom) + 10;
			} else if( nodeRect.top < containerRect.top ) {
				this.dialogElements[ 'div.bfContentDialogBody' ].scrollTop = scrollTop - (containerRect.top - nodeRect.top ) - 10;
			}
		}
	}

	async centerOverlay({ centerToViewport = false } = { }) {
		let ownRect		= this.nodes.dialogRoot.getBoundingClientRect(),
			rootRect;

		if( centerToViewport || this.fixed ) {
			rootRect = doc.body.getBoundingClientRect();
		} else {
			rootRect = await this.fire( `getModuleDimensions.${ this.location }` );

			if( rootRect === null ) {
				rootRect = await this.fire( `getSectionDimensions.core`, this.location );
			}
		}

		if( this.standAlone ) {
			this.nodes.dialogRoot.style.position	= 'static';
			this.nodes.dialogRoot.style.margin		= 'auto';
		} else {
			if( rootRect ) {
				this.nodes.dialogRoot.style.left		= `${ (rootRect.width / 2) - (ownRect.width / 2) }px`;
				this.nodes.dialogRoot.style.top			= `${ ((rootRect.height / 2) - (ownRect.height / 2)) + (this.fixed ? 0 : Math.abs( rootRect.y / 2 )) }px`;
				this.nodes.dialogRoot.style.alignSelf	= 'center';
			}
			else {
				this.warn( 'Unable to receive parent Element dimensions.' );
			}
		}
	}

	orientationChange() {
		super.orientationChange && super.orientationChange( ...arguments );

		if( this.center ) {
			this.centerOverlay();
		} else if( this.centerToViewport ) {
			this.centerOverlay({ centerToViewport: true });
		} else if( this.position ) {
			this.nodes.dialogRoot.style.left	= `${this.position.left}px`;
			this.nodes.dialogRoot.style.top		= `${this.position.top}px`;
		}

		super.orientationChange && super.orientationChange( ...arguments );
	}

	onKeyDown( vk ) {
		switch( vk ) {
			case VK.ESC:
				this.destroy();
				break;
		}
	}

	async onBackgroundMouseDown( event ) {
		if( event && event.target && !event.target.closest( 'div.bfDialogWrapper' ) ) {
			if(!this.nodes.dialogRoot.contains( event.target ) ) {
				if( this.modalOverlay ) {
					await Promise.all( this.modalOverlay.possibleDelays );
				}

				if( this && Object.keys( this ).length ) {
					this.destroy();
				}
			}
		}
	}

	tempMsg( node, msg, iv ) {
		try {
			if( node instanceof HTMLElement ) {
				if( this.data.get( node ).storage.tmpMsgOld === undef ) {
					this.data.get( node ).storage.tmpMsgOld = node.innerHTML;
				}
				
				node.innerHTML = msg || '';
				node.classList.add( 'redcolor' );

				if( this.data.get( node ).storage.tmpMsgTimer ) {
					win.clearTimeout( this.data.get( node ).storage.tmpMsgTimer );
				}
				
				this.data.get( node ).storage.tmpMsgTimer = win.setTimeout(() => {
					if( this && this.data ) {
						node.classList.remove( 'redcolor' );
						node.innerHTML = this.data.get( node ).storage.tmpMsgOld;

						delete this.data.get( node ).storage.tmpMsgTimer;
						delete this.data.get( node ).storage.tmpMsgOld;
					}
				}, iv);
			}
		} catch( ex ) {
			console.log( ex.message );
		}
	}
}

let Dialog = target => class extends target {
	constructor() {
		super( ...arguments );

		this.dialogElements[ 'div.bfDialogHandle' ].style.display = 'flex';
	}

	async init() {
		this.removeNodeEvent( 'div.bfContentDialogBody', 'mousedown', this.onDialogHandleMouseDown );
		this.addNodeEvent( 'div.title', 'mousedown', this.onDialogHandleMouseDown );
		this.addNodeEvent( 'div.close', 'click', this.onCloseClick );
		this.addNodeEvent( 'div.mini', 'click', this.onMiniClick );

		this._DialogClass = true;

		super.init && await super.init();
	}

	async destroy() {
		super.destroy && await super.destroy();
	}

	onCloseClick( event ) {
		this.destroy();
		return false;
	}

	onMiniClick( event ) {
		if( this.dialogElements[ 'div.bfContentDialogBody' ].classList.contains( 'minified' ) ) {
			this.dialogElements[ 'div.bfContentDialogBody' ].classList.remove( 'minified' );
		} else {
			this.dialogElements[ 'div.bfContentDialogBody' ].classList.add( 'minified' );
		}
	}

	onDialogHandleMouseDown( event ) {
		super.onDialogHandleMouseDown && super.onDialogHandleMouseDown( ...arguments );

		//this.removeNodeEvent( 'div.bfContentDialogBody', 'mouseup' );
		this.addNodeEventOnce( 'div.title', 'mouseup touchend', this.onMouseUp.bind( this ) );
	}
};

let Draggable = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	async init() {
		if( this.hoverOverlay ) {
			this.addNodeEvent( 'div.overlayHandle', 'mousedown', this.onDialogHandleMouseDown );
		} else {
			this.addNodeEvent( 'div.bfContentDialogBody', 'mousedown', this.onDialogHandleMouseDown );
		}

		this._boundMouseMoveHandler = this.mouseMoveHandler.bind( this );

		super.init && await super.init();
	}

	async destroy() {
		this.fire( 'removeMouseMoveListener.appEvents', this._boundMouseMoveHandler, () => {} );
		super.destroy && await super.destroy();
	}

	installModule() {
		super.installModule && super.installModule();

		this.dialogElements[ 'div.bfBlurDialogBody' ].style.top = this.dialogElements[ 'div.bfDialogHandle' ].offsetHeight + 'px';
	}

	async onDialogHandleMouseDown( event ) {
		let clRect	= this.dialogElements[ 'div.bfDialogWrapper' ].getBoundingClientRect(),
			parent	= await this.fire( `getModuleDimensions.${ this.location }` );

		if( parent === null || this.fixed ) {
			this.relativeCursorPositionLeft		= event.pageX - this.dialogElements[ 'div.bfDialogWrapper' ].offsetLeft;
			this.relativeCursorPositionTop		= event.pageY - this.dialogElements[ 'div.bfDialogWrapper' ].offsetTop;
		} else {
			this.relativeCursorPositionLeft		= event.pageX - clRect.x + parent.left;
			this.relativeCursorPositionTop		= event.pageY - clRect.y + parent.top;
		}


		this.fire( 'pushMouseMoveListener.appEvents', this._boundMouseMoveHandler, () => {} );
		this.addNodeEventOnce( 'div.bfContentDialogBody', 'mouseup touchend', this.onMouseUp.bind( this ) );

		if( this.hoverOverlay ) {
			this.addNodeEventOnce( 'div.overlayHandle', 'mouseup touchend', this.onMouseUp.bind( this ) );
		}

		//super.onDialogHandleMouseDown && super.onDialogHandleMouseDown( ...arguments );

		event.stopPropagation();
		event.preventDefault();
		return false;
	}

	mouseMoveHandler( event ) {
		super.mouseMoveHandler && super.mouseMoveHandler( ...arguments );

		if( event.type === 'mousemove' && event.which === 1 || event.type === 'touchmove' ) {
			this.dialogElements[ 'div.bfDialogWrapper' ].style.left	= `${event.pageX - this.relativeCursorPositionLeft}px`;
			this.dialogElements[ 'div.bfDialogWrapper' ].style.top	= `${event.pageY - this.relativeCursorPositionTop}px`;

			event.stopPropagation();
			event.preventDefault();
		}

		return false;
	}

	onMouseUp( event ) {
		super.onMouseUp && super.onMouseUp( ...arguments );

		this.fire( 'removeMouseMoveListener.appEvents', this._boundMouseMoveHandler, () => {} );
		return false;
	}
};

let GlasEffect = target => class extends target {
	constructor() {
		super( ...arguments );

		this.on( 'resetClones.overlay', this.resetClones, this );

		extend( this ).with({
			clonedBackgroundElements:	[ ],
			firstMove:					true
		});
	}

	async init() {
		//this.fire( 'setScrollingStatus.core', 'disable' );
		super.init && await super.init();
	}

	async destroy() {
		//this.fire( 'setScrollingStatus.core', 'enable' );
		super.destroy && await super.destroy( ...arguments );
	}

	installModule() {
		super.installModule && super.installModule();

		if( this._DialogClass ) {
			this.dialogElements[ 'div.bfBlurDialogBody' ].style.top = this.dialogElements[ 'div.bfDialogHandle' ].offsetHeight + 'px';
		}

		this.initCloneElements();
	}

	onDialogHandleMouseDown( event ) {
		super.onDialogHandleMouseDown && super.onDialogHandleMouseDown( ...arguments );
	}

	async initCloneElements( event ) {
		let rootElementFromParent = await this.fire( `getModuleRootElement.${ this.location }` );

		if( rootElementFromParent === null ) {
			rootElementFromParent = await this.fire( `getRootNodeOfSection.core`, this.location );
		}

		if( rootElementFromParent instanceof HTMLElement ) {
			//rootElementFromParent.scrollIntoView();

			Array.from( rootElementFromParent.children )
				.filter( child => child !== this.dialogElements[ 'div.bfDialogWrapper' ] && child.nodeName !== 'VIDEO' )
				.forEach( child => {
					let clone	= this.makeNode( `<div>${ child.outerHTML }</div>` );

					clone.style.position	= 'absolute';
					clone.style.top			= `${ (this.nodes.dialogRoot.offsetTop + this.dialogElements[ 'div.bfBlurDialogBody' ].offsetTop ) * -1 }px`;
					clone.style.left		= `${ (this.nodes.dialogRoot.offsetLeft + this.dialogElements[ 'div.bfBlurDialogBody' ].offsetLeft ) * -1 }px`;
					clone.style.width		= '100vw';
					clone.style.height		= '100vh';

					if( clone.firstElementChild.children ) {
						for( let child of Array.from( clone.firstElementChild.children ) ) {
							child.style.zIndex	= 5;
							child.style.filter	= 'sepia(50%)';
							child.style.opacity	= 0.5;
						}
					}

					this.clonedBackgroundElements.push( clone );
					this.dialogElements[ 'div.bfBlurDialogBody' ].appendChild( clone );
				});
		} else {
			this.error( 'Unable to resolve parent Element.' );
		}
	}

	updateCloneElements( event ) {
		for( let child of this.clonedBackgroundElements ) {
			child.style.left	= `${ (event.pageX - this.relativeCursorPositionLeft + this.dialogElements[ 'div.bfBlurDialogBody' ].offsetLeft ) * -1 }px`;
			child.style.top		= `${ (event.pageY - this.relativeCursorPositionTop + this.dialogElements[ 'div.bfBlurDialogBody' ].offsetTop ) * -1 }px`;
		}
	}

	mouseMoveHandler( event ) {
		if( event.which ===  1 ) {
			if( this.firstMove ) {
				this.fire( 'resetClones.overlay' );
				this.initCloneElements();
				this.firstMove = false;
			}

			this.updateCloneElements( event );
		}

		super.mouseMoveHandler && super.mouseMoveHandler( ...arguments );
	}

	resetClones() {
		this.dialogElements[ 'div.bfBlurDialogBody' ].innerHTML = '';
		this.clonedBackgroundElements = [ ];
	}

	orientationChange() {
		super.orientationChange && super.orientationChange( ...arguments );

		this.fire( 'resetClones.overlay' );
		this.initCloneElements();
	}

	onMouseUp( event ) {
		this.firstMove = true;
		super.onMouseUp && super.onMouseUp( ...arguments );
	}
};

(async function main() {
	[ dialogStyle ].forEach( style => style.use() );
}());

export { Overlay, Dialog, Draggable, GlasEffect };

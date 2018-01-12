'use strict';

import { Component } from './core.js';
import { extend, makeClass } from './toolkit.js';
import { win, doc, undef } from './domkit.js';
import Mediator from './mediator.js';
import LogTools from './logtools.js';

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
	}

	init() {
		if( typeof this.location !== 'string' ) {
			this.error( `Destonation is required for options.location. Received ${ this.location } instead.` );
		}

		overlayInstances++;

		if( overlayInstances === 1 ) {
			this.fire( 'dialogMode.core', true );
		}

		super.init && super.init();
	}

	destroy() {
		overlayInstances--;

		if( overlayInstances === 0 ) {
			this.fire( 'dialogMode.core', false );
		}

		super.destroy && super.destroy();
	}

	installModule() {
		this.dialogElements[ 'div.bfContentDialogBody' ].insertAdjacentElement( 'beforeend', this.nodes.root );
		this.nodes.dialogRoot = this.dialogElements.root;

		super.installModule && super.installModule();

		if( this.position ) {
			this.nodes.dialogRoot.style.left	= `${this.position.left}px`;
			this.nodes.dialogRoot.style.top		= `${this.position.top}px`;
		}
	}
}

let Dialog = target => class extends target {
	constructor() {
		super( ...arguments );

		this.dialogElements[ 'div.bfDialogHandle' ].style.display = 'flex';
	}

	init() {
		this.removeNodeEvent( 'div.bfContentDialogBody', 'mousedown touchstart', this.onDialogHandleMouseDown );
		this.addNodeEvent( 'div.title', 'mousedown touchstart', this.onDialogHandleMouseDown );
		this.addNodeEvent( 'div.close', 'click', this.onCloseClick );
		this.addNodeEvent( 'div.mini', 'click', this.onMiniClick );

		this._DialogClass = true;

		super.init && super.init();
	}

	destroy() {
		super.destroy && super.destroy();
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
		this.removeNodeEvent( 'div.bfContentDialogBody', 'mouseup' );
		this.addNodeEventOnce( 'div.title', 'mouseup', this.onMouseUp.bind( this ) );
		this.addNodeEventOnce( 'div.title', 'touchend', this.onMouseUp.bind( this ) );
	}
};

let Draggable = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	init() {
		this.addNodeEvent( 'div.bfContentDialogBody', 'mousedown touchstart', this.onDialogHandleMouseDown );

		this._boundMouseMoveHandler = this.mouseMoveHandler.bind( this );

		super.init && super.init();
	}

	onDialogHandleMouseDown( event ) {
		let clRect = this.dialogElements[ 'div.bfDialogWrapper' ].getBoundingClientRect();

		this.relativeCursorPositionLeft		= event.pageX - clRect.x - doc.body.scrollLeft;
		this.relativeCursorPositionTop		= event.pageY - clRect.y - doc.body.scrollTop;

		this.fire( 'pushMouseMoveListener.appEvents', this._boundMouseMoveHandler, () => {} );
		this.addNodeEventOnce( 'div.bfContentDialogBody', 'mouseup', this.onMouseUp.bind( this ) );

		super.onDialogHandleMouseDown && super.onDialogHandleMouseDown( ...arguments );

		event.stopPropagation();
		event.preventDefault();
	}

	mouseMoveHandler( event ) {
		this.dialogElements[ 'div.bfDialogWrapper' ].style.left	= `${event.pageX - this.relativeCursorPositionLeft}px`;
		this.dialogElements[ 'div.bfDialogWrapper' ].style.top	= `${event.pageY - this.relativeCursorPositionTop}px`;

		event.preventDefault();
		event.stopPropagation();
	}

	onMouseUp( event ) {
		super.onMouseUp && super.onMouseUp( ...arguments );

		this.fire( 'removeMouseMoveListener.appEvents', this._boundMouseMoveHandler, () => {} );
		return this._boundMouseMoveHandler;
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

	onDialogHandleMouseDown() {
		super.onDialogHandleMouseDown && super.onDialogHandleMouseDown( ...arguments );

		this.initCloneElements();
	}

	async initCloneElements() {
		let rootElementFromParent = await this.fire( `getModuleRootElement.${ this.location }` );

		Array.from( rootElementFromParent.children )
			.filter( child => child !== this.dialogElements[ 'div.bfDialogWrapper' ] && child.nodeName !== 'VIDEO' )
			.forEach( child => {
				let clone	= this.makeNode( `<div>${ child.outerHTML }</div>` );

				clone.style.position	= 'absolute';

				this.clonedBackgroundElements.push( clone );
				this.dialogElements[ 'div.bfBlurDialogBody' ].appendChild( clone );
			});
	}

	updateCloneElements( event ) {
		for( let child of this.clonedBackgroundElements ) {
			child.style.left	= `${ (event.pageX - this.relativeCursorPositionLeft + this.dialogElements[ 'div.bfBlurDialogBody' ].offsetLeft) * -1 }px`;
			child.style.top		= `${ (event.pageY - this.relativeCursorPositionTop + this.dialogElements[ 'div.bfBlurDialogBody' ].offsetTop) * -1 }px`;
		}
	}

	mouseMoveHandler( event ) {
		if( this.firstMove ) {
			this.fire( 'resetClones.overlay' );
			this.initCloneElements();
			this.firstMove = false;
		}

		this.updateCloneElements( event );

		super.mouseMoveHandler && super.mouseMoveHandler( ...arguments );
	}

	resetClones() {
		console.log( 'resetting clones...');
		this.dialogElements[ 'div.bfBlurDialogBody' ].innerHTML = '';
		this.clonedBackgroundElements = [ ];
	}

	onMouseUp() {
		this.firstMove = true;
		super.onMouseUp && super.onMouseUp( ...arguments );
	}
};

(async function main() {
	[ dialogStyle ].forEach( style => style.use() );
}());

export { Overlay, Dialog, Draggable, GlasEffect };

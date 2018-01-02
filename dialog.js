'use strict';

import { Component } from './core.js';
import { extend, makeClass } from './toolkit.js';
import { win, doc, undef } from './domkit.js';
import Mediator from './mediator.js';
import LogTools from './logtools.js';

import dialogStyle from './css/dialog.scss';
import dialogMarkup from './html/dialog.html';

class Overlay extends Component {
	constructor( input = { }, options = { } ) {
		super( ...arguments  );

		extend( this ).with({
			relativeCursorPositionLeft:		0,
			relativeCursorPositionRight:	0,
			dialogElements:					this.transpile({ htmlData: dialogMarkup, moduleRoot: true })
		});
	}

	init() {
		if( typeof this.location !== 'string' ) {
			this.error( `Destonation is required for options.location. Received ${ this.location } instead.` );
		}

		this.dialogElements[ 'div.bfDialogHandle' ].addEventListener( 'mousedown', this.onDialogHandleMouseDown.bind( this ), false );

		this.fire( 'OverlayInit.core' );

		super.init && super.init();
	}

	destroy() {
		this.fire( 'OverlayDestroy.core' );

		this.removeNodes( 'dialogRoot', true );

		super.destroy && super.destroy();
	}

	installModule() {
		this.dialogElements[ 'div.bfContentDialogBody' ].insertAdjacentElement( 'beforeend', this.nodes.root );
		this.nodes.dialogRoot = this.dialogElements.root;

		super.installModule && super.installModule();

		if( this.position ) {
			this.nodes.dialogRoot.style.transform = `translate(${this.position.left}px, ${this.position.top}px)`;
		}
	}

	onDialogHandleMouseDown( event ) {
		let clRect = this.dialogElements[ 'div.bfDialogWrapper' ].getBoundingClientRect();

		this.relativeCursorPositionLeft		= event.clientX - clRect.x;
		this.relativeCursorPositionRight	= event.clientY - clRect.y;

		this.fire( 'pushMouseMoveListener.appEvents', {
			fnc:	this.mouseMoveHandler,
			ctx:	this
		});

		this.once( 'mouseup.appEvents', this.onMouseUp.bind( this ) );
	}

	mouseMoveHandler( event ) {
		this.dialogElements[ 'div.bfDialogWrapper' ].style.transform = `translate(${event.clientX - this.relativeCursorPositionLeft}px, ${event.clientY - this.relativeCursorPositionRight}px)`;
	}

	onMouseUp( event ) {
		this.fire( 'removeMouseMoveListener.appEvents', {
			fnc:	this.mouseMoveHandler
		});
	}
}

let Dialog = target => class extends target {
	constructor() {
		super( ...arguments );

		this.dialogElements[ 'div.bfDialogHandle' ].style.display = 'flex';
	}
};

let Draggable = target => class extends target {
	constructor() {
		super( ...arguments );

	}
};

let GlasEffect = target => class extends target {
	constructor() {
		super( ...arguments );

	}
};

(async function main() {
	[ dialogStyle ].forEach( style => style.use() );
}());

export { Overlay, Dialog, Draggable, GlasEffect };

'use strict';

import { extend, Composition } from './toolkit.js';
import { doc, win } from './domkit.js';
import Mediator from './mediator.js';
import LogTools from './logtools.js';

/*****************************************************************************************************
 * Class BrowserKit provides basic browser event abstraction into BarFoos events
 * Any Browser related task will be handled here
 *****************************************************************************************************/
class BrowserKit extends Composition( LogTools, Mediator ) {
	constructor() {
		super( ...arguments );

		extend( this ).with({
			mouseMoveHandlers:	[ ]
		});

		this.init();
	}

	async init() {
		doc.addEventListener( 'visibilitychange', this.visibilityChange.bind( this ), false );
		doc.addEventListener( 'focus', this.focusin.bind( this ), false );
		doc.addEventListener( 'blur', this.focusout.bind( this ), false );
		doc.addEventListener( 'focusin', this.focusin.bind( this ), false );
		doc.addEventListener( 'focusout', this.focusout.bind( this ), false );
		doc.addEventListener( 'mousewheel', this.mousewheel.bind( this ), false );
		doc.addEventListener( 'mousedown', this.mousedown.bind( this ), false );
		doc.addEventListener( 'mouseup', this.mouseup.bind( this ), false );

		this.on( 'pushMouseMoveListener.appEvents', this.pushMouseMoveListener, this );
		this.on( 'removeMouseMoveListener.appEvents', this.removeMouseMoveListener, this );

		this.on( 'isAppHidden.appEvents', () => doc.hidden );
		this.on( 'isAppFocused.appEvents', () => doc.hasFocus() );
		// onbeforeunload
		// mediaQuery
		// resize
		// scroll
	}

	pushMouseMoveListener( data ) {
		if( typeof data.fnc === 'function' ) {
			if( this.mouseMoveHandlers.indexOf( data ) === -1 ) {
				this.mouseMoveHandlers.push( data );
			}
		} else {
			this.error( `Parameter "data.fnc" must be of type Function, received ${ data.fnc } instead.` );
		}

		if( this.mouseMoveHandlers.length === 1 ) {
			doc.addEventListener( 'mousemove', this.mousemove.bind( this ), false );
		}
	}

	removeMouseMoveListener( data ) {
		if( typeof data.fnc === 'function' ) {
			this.mouseMoveHandlers.splice( this.mouseMoveHandlers.indexOf( data.fnc ), 1 );
		} else {
			this.error( `Parameter "data.fnc" must be of type Function, received ${ data.fnc } instead.` );
		}

		if( this.mouseMoveHandlers.length === 0 ) {
			doc.removeEventListener( 'mousemove', data.fnc );
		}
	}

	loadImage( url ) {
		try {
			return fetch( url ).then( res => res.blob() ).then( blob => URL.createObjectURL( blob ) );
		} catch ( ex ) {
			this.log( `Error: ${ ex.message }` );
		}
	}

	visibilityChange( event ) {
		this.fire( 'appVisibilityChange.appEvents', !doc.hidden );
	}

	mousemove( event ) {
		for( let data of this.mouseMoveHandlers ) {
			data.fnc.call( data.ctx, event );
		}
	}

	focusin( event ) {
		this.fire( 'appFocusChange.appEvents', doc.hasFocus() );
	}

	focusout( event ) {
		this.fire( 'appFocusChange.appEvents', doc.hasFocus() );
	}

	mousewheel( event ) {
		if( event.wheelDelta / 120 > 0 ) {
			this.fire( 'mouseWheelUp.appEvents' );
		} else {
			this.fire( 'mouseWheelDown.appEvents' );
		}
	}

	mousedown( event ) {
		this.fire( 'mousedown.appEvents', event );
	}

	mouseup( event ) {
		this.fire( 'mouseup.appEvents', event );
	}
}
/****************************************** BrowserKit End ******************************************/

export default BrowserKit;

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

		this._boundMouseMove = this.mousemove.bind( this );

		this.init();
	}

	async init() {
		win.addEventListener( 'focus', this.focusin.bind( this ), false );
		win.addEventListener( 'blur', this.focusout.bind( this ), false );
		win.addEventListener( 'orientationchange', this.orientationChange.bind( this ), false );
		doc.addEventListener( 'visibilitychange', this.visibilityChange.bind( this ), false );
		doc.addEventListener( 'focusin', this.focusin.bind( this ), false );
		doc.addEventListener( 'focusout', this.focusout.bind( this ), false );
		doc.addEventListener( 'mousewheel', this.mousewheel.bind( this ), false );
		doc.addEventListener( 'mousedown', this.mousedown.bind( this ), false );
		doc.addEventListener( 'mouseup', this.mouseup.bind( this ), false );
		doc.addEventListener( 'touchend', this.mouseup.bind( this ), false );

		this.on( 'pushMouseMoveListener.appEvents', this.pushMouseMoveListener, this );
		this.on( 'removeMouseMoveListener.appEvents', this.removeMouseMoveListener, this );

		this.on( 'isAppHidden.appEvents', () => doc.hidden );
		this.on( 'isAppFocused.appEvents', () => doc.hasFocus() );
		// onbeforeunload
		// mediaQuery
		// resize
		// scroll
	}

	pushMouseMoveListener( fnc ) {
		if( typeof fnc === 'function' ) {
			if( this.mouseMoveHandlers.indexOf( fnc ) === -1 ) {
				this.mouseMoveHandlers.push( fnc );
			}
		} else {
			this.error( `Parameter "fnc" must be of type Function, received ${ fnc } instead.` );
		}

		if( this.mouseMoveHandlers.length === 1 ) {
			doc.addEventListener( 'mousemove', this._boundMouseMove, false );
			doc.addEventListener( 'touchmove', this._boundMouseMove, false );
		}

		return fnc;
	}

	removeMouseMoveListener( fnc ) {
		if( typeof fnc === 'function' ) {
			this.mouseMoveHandlers.splice( this.mouseMoveHandlers.indexOf( fnc ), 1 );
		} else {
			this.error( `Parameter "fnc" must be of type Function, received ${ fnc } instead.` );
		}

		if( this.mouseMoveHandlers.length === 0 ) {
			doc.removeEventListener( 'mousemove', this._boundMouseMove );
			doc.removeEventListener( 'touchmove', this._boundMouseMove );
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

	orientationChange( event ) {
		this.fire( 'appOrientationChange.appEvents' );
	}

	mousemove( event ) {
		for( let fnc of this.mouseMoveHandlers ) {
			fnc( event );
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

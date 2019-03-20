'use strict';

import { extend, Composition, isMobileDevice } from './toolkit.js';
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
			mouseMoveHandlers:	[ ],
			DOMreadyHandlers:	[ ]
		});

		this._boundMouseMove = this.mousemove.bind( this );

		this.init();
	}

	async init() {
		doc.onreadystatechange = () => {
			if( doc.readyState === 'complete' ) {
				this.fire( 'DOMReady.appEvents' );

				for( let cb of this.DOMreadyHandlers ) {
					cb.call( this, true );
				}

				delete this.DOMreadyHandlers;
			}
		}

		win.addEventListener( 'focus', this.focusin.bind( this ), false );
		win.addEventListener( 'blur', this.focusout.bind( this ), false );
		doc.addEventListener( 'focusin', this.focusin.bind( this ), false );
		doc.addEventListener( 'focusout', this.focusout.bind( this ), false );
		win.addEventListener( 'orientationchange', this.orientationChange.bind( this ), false );
		win.addEventListener( 'hashchange', this.hashChange.bind( this ), false );
		win.addEventListener( 'keydown', this.keydown.bind( this ), false );
		win.addEventListener( 'keydown', this.keyup.bind( this ), false );
		doc.addEventListener( 'visibilitychange', this.visibilityChange.bind( this ), false );
		//doc.addEventListener( 'mousewheel', this.mousewheel.bind( this ), false );
		doc.addEventListener( 'mousedown', this.mousedown.bind( this ), false );

		if( isMobileDevice ) {
			doc.addEventListener( 'touchend', this.mouseup.bind( this ), false );
		} else {
			doc.addEventListener( 'mouseup', this.mouseup.bind( this ), false );
		}

		this.on( 'waitForDOM.appEvents', this.waitForDOM, this );
		this.on( 'pushMouseMoveListener.appEvents', this.pushMouseMoveListener, this );
		this.on( 'removeMouseMoveListener.appEvents', this.removeMouseMoveListener, this );

		this.on( 'isAppHidden.appEvents', () => doc.hidden );
		this.on( 'isAppFocused.appEvents', () => doc.hasFocus() );
		this.on( 'getHash.appEvents', () => {
			const	query		= win.location.hash.indexOf( '?' ),
					urlParam	= query > -1 ? new win.URLSearchParams( win.location.hash.slice( 1, href ) ) : new win.URLSearchParams( win.location.hash.slice( 1 ) );

			return urlParam;
		});
		this.on( 'getParams.appEvents', () => new win.URLSearchParams( win.location.search ) );
		// onbeforeunload
		// mediaQuery
		// resize
		// scroll
	}

	waitForDOM( event ) {
		return doc.readyState === 'complete' || new Promise( ( res, rej ) => {
			this.DOMreadyHandlers.push( () => { res( doc.readyState ); } );
		});
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
			return false;
		}
	}

	visibilityChange( event ) {
		this.fire( 'appVisibilityChange.appEvents', !doc.hidden );
	}

	orientationChange( event ) {
		win.setTimeout(() => {
			this.fire( 'appOrientationChange.appEvents' );
		}, 100);
	}

	hashChange( event ) {
		this.fire( 'hashChange.appEvents', new win.URLSearchParams( location.hash.slice( 1 ) ) );
	}

	keydown( event ) {
		this.fire( 'down.keys', event.which || event.keyCode );
	}

	keyup( event ) {
		this.fire( 'up.keys', event.which || event.keyCode );
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

	/*mousewheel( event ) {
		if( event.wheelDelta / 120 > 0 ) {
			this.fire( 'mouseWheelUp.appEvents' );
		} else {
			this.fire( 'mouseWheelDown.appEvents' );
		}
	}*/

	mousedown( event ) {
		this.fire( 'mousedown.appEvents', event );
	}

	mouseup( event ) {
		this.fire( 'mouseup.appEvents', event );
	}
}
/****************************************** BrowserKit End ******************************************/

export default BrowserKit;

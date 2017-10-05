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

		this.on( 'isAppHidden.appEvents', () => doc.hidden );
		this.on( 'isAppFocused.appEvents', () => doc.hasFocus() );
		// onbeforeunload
		// mediaQuery
		// resize
		// scroll
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
}
/****************************************** BrowserKit End ******************************************/

export default BrowserKit;

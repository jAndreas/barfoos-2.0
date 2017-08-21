'use strict';

import { extend, Composition } from './toolkit.js';
import { Mediator } from './mediator.js';
import { doc, win, LogTools } from './domkit.js';

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
		doc.addEventListener( 'visibilitychange', visibilityChange.bind( this ), false );
		doc.addEventListener( 'focus', focusin.bind( this ), false );
		doc.addEventListener( 'blur', focusout.bind( this ), false );
		doc.addEventListener( 'focusin', focusin.bind( this ), false );
		doc.addEventListener( 'focusout', focusout.bind( this ), false );

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
}
/****************************************** BrowserKit End ******************************************/

function visibilityChange() {
	this.fire( 'appVisibilityChange.appEvents', !doc.hidden );
}

function focusin() {
	this.fire( 'appFocusChange.appEvents', doc.hasFocus() );
}

function focusout() {
	this.fire( 'appFocusChange.appEvents', doc.hasFocus() );
}

export { BrowserKit };

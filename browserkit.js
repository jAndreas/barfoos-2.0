'use strict';

import { extend, mix } from './toolkit.js';
import { Mediator } from './mediator.js';
import { doc, win, LogTools } from './domkit.js';

/*****************************************************************************************************
 * Class BrowserKit provides basic browser event abstraction into BarFoos events
 * Any Browser related task will be handled here
 *****************************************************************************************************/
class BrowserKit {
	constructor() {
		extend( this ).with({
		});

		this.init();
	}

	async init() {
		await this.fire( 'waitForDOM.appEvents' );

		doc.addEventListener( 'visibilitychange', this.visibilityChange.bind( this ), false );
		doc.addEventListener( 'focusin', this.focusin.bind( this ), false );
		doc.addEventListener( 'focusout', this.focusout.bind( this ), false );

		this.on( 'isAppHidden.appEvents', () => doc.hidden );
		this.on( 'isAppFocused.appEvents', () => doc.hasFocus() );
		// onbeforeunload
		// resize
		// scroll
	}

	visibilityChange() {
		this.fire( 'appVisibilityChange.appEvents', !doc.hidden );
	}

	focusin() {
		this.fire( 'appFocusChange.appEvents', doc.hasFocus() );
	}

	focusout() {
		this.fire( 'appFocusChange.appEvents', doc.hasFocus() );
	}
}

// BrowserKit Extension (Mixin)
class BrowserKitEx extends mix( BrowserKit ).with( LogTools, Mediator ) { };
/****************************************** BrowserKit End ******************************************/

export { BrowserKitEx };

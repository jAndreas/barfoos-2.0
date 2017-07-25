'use strict';

import { extend } from './toolkit.js';
import { Mediator } from './mediator.js';
import { doc, win, LogTools } from './domkit.js';

const test = new Mediator({ register: 'ApplicationEvents' });

class BrowserKit extends LogTools {
	constructor() {
		super( ...arguments );

		extend( this ).with({
			appEvents:	new Mediator({ register: 'ApplicationEvents' })
		});

		this.init();
	}

	async init() {
		await this.appEvents.fire( 'waitForDOM' );

		doc.addEventListener( 'visibilitychange', this.visibilityChange.bind( this ), false );
		doc.addEventListener( 'focusin', this.focusin.bind( this ), false );
		doc.addEventListener( 'focusout', this.focusout.bind( this ), false );

		this.appEvents.on( 'isAppHidden', () => doc.hidden );
		this.appEvents.on( 'isAppFocused', () => doc.hasFocus() );
		// onbeforeunload
		// resize
		// scroll
	}

	visibilityChange() {
		this.appEvents.fire( 'appVisibilityChange', !doc.hidden );
	}

	focusin() {
		this.appEvents.fire( 'appFocusChange', doc.hasFocus() );
	}

	focusout() {
		this.appEvents.fire( 'appFocusChange', doc.hasFocus() );
	}
}

export { BrowserKit };

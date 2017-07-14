"use strict";

import { extend } from './toolkit.js';
import { win, doc, undef, DOMTools } from './domkit.js';
import { mediator } from './mediator.js';
import { moduleLocations } from './defs.js';
import worldMarkup from './html/world.html';
import worldStyle from './css/world.css';

let appEvents	= new mediator({ register: 'ApplicationEvents' }),
	DOM			= new DOMTools(),
	nodes		= DOM.transpile( worldMarkup );

class Component {
	constructor( options = { } ) {
		extend( this ).with( options ).and({
			appEvents:		new mediator({ register: 'ApplicationEvents' }),
			moduleEvents:	new mediator({ register: 'GUIModuleEvents' })
		});

		if( typeof this.tmpl === 'string' ) {
			this.nodes		= Object.create( null );
			this.location	= this.location || moduleLocations.center;

			extend( this.nodes ).with( DOM.transpile( this.tmpl ), true );

			nodes[ `section.${ this.location }` ].appendChild( this.nodes.root );
		} else {
			console.log('worker..?');
		}
	}
}

(async function main() {
	worldStyle.use();

	await appEvents.fire( 'waitForDOM' );

	console.log('CORE DOMReady Event. Injecting nodes: ', nodes);

	doc.body.appendChild( nodes[ 'div#world' ] );
}());

export { Component };

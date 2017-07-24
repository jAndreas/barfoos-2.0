"use strict";

import { extend, mix, type } from './toolkit.js';
import { win, doc, undef, DOMTools, LogTools } from './domkit.js';
import { mediator } from './mediator.js';
import { moduleLocations } from './defs.js';
import worldMarkup from './html/world.html';
import normalize from './css/normalize.css';
import worldStyle from './css/world.css';

const	appEvents	= new mediator({ register: 'ApplicationEvents' }),
		DOM			= new DOMTools(),
		nodes		= DOM.transpile( worldMarkup ),
		modules		= Object.create( null ),
		console		= new LogTools({ id: 'core' });

class Component extends LogTools {
	constructor( options = { } ) {
		super( ...arguments );

		extend( this ).with( options ).and({
			id:				this.constructor.name,
			appEvents:		new mediator({ register: 'ApplicationEvents' }),
			moduleEvents:	new mediator({ register: 'GUIModuleEvents' }),
			dependencies:	[ ]
		});

		if( typeof this.tmpl === 'string' ) {
			extend( this ).with({
				nodes:		Object.create( null ),
				location:	this.location || moduleLocations.center
			});

			this.dependencies.push( this.appEvents.fire( 'waitForDOM' ) );

			extend( this.nodes ).with( DOM.transpile( this.tmpl ), true );

			nodes[ `section.${ this.location }` ].appendChild( this.nodes.root );
		} else {
			console.log('worker..?');
		}

		this.appEvents.fire( 'moduleLaunch', {
			id:	this.id
		});
	}
}

(async function main() {
	normalize.use();
	worldStyle.use();

	await appEvents.fire( 'waitForDOM' );

	console.log('CORE DOMReady Event. Injecting nodes: ', nodes);

	doc.body.appendChild( nodes[ 'div#world' ] );
}());

appEvents.on( 'moduleLaunch', module => {
	if( module.id in modules ) {
		modules[ module.id ]++;
	} else {
		modules[ module.id ] = 1;
	}

	console.log( `module ${module.id} was launched( ${modules[module.id]}x )` );
});

export { Component };

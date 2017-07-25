"use strict";

import { extend, mix, type } from './toolkit.js';
import { win, doc, undef, DOMTools, LogTools } from './domkit.js';
import { Mediator } from './mediator.js';
import { BrowserKit } from './browserkit.js';
import { moduleLocations } from './defs.js';
import worldMarkup from './html/world.html';
import normalize from './css/normalize.css';
import worldStyle from './css/world.css';

const	appEvents	= new Mediator({ register: 'ApplicationEvents' }),
		DOM			= new DOMTools(),
		Browser		= new BrowserKit(),
		console		= new LogTools({ id: 'core' }),
		nodes		= DOM.transpile( worldMarkup ),
		modules		= Object.create( null );

class Component extends LogTools {
	constructor( options = { } ) {
		super( ...arguments );

		extend( this ).with( options ).and({
			id:						this.constructor.name,
			appEvents:				new Mediator({ register: 'ApplicationEvents' }),
			moduleEvents:			new Mediator({ register: 'GUIModuleEvents' }),
			runtimeDependencies:	[ ]
		});

		if( typeof this.tmpl === 'string' ) {
			extend( this ).with({
				nodes:		Object.create( null ),
				location:	this.location || moduleLocations.center
			});

			this.runtimeDependencies.push( this.appEvents.fire( 'waitForDOM' ) );

			extend( this.nodes ).with( DOM.transpile( this.tmpl ) );

			nodes[ `section.${ this.location }` ].appendChild( this.nodes.root );
		} else {
			console.log('worker..?');
		}

		this.appEvents.fire( 'moduleLaunch', {
			id:	this.id
		});
	}

	init() {
		return Promise.all( this.runtimeDependencies ).then( () => this );
	}
}

(async function main() {
	normalize.use();
	worldStyle.use();

	await appEvents.fire( 'waitForDOM' );

	console.log('CORE DOMReady Event. Injecting nodes to document body: ', nodes);

	doc.body.appendChild( nodes[ 'div#world' ] );
	nodes[ 'div#world' ].focus();
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

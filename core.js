"use strict";

import { extend, mix, makeClass, type } from './toolkit.js';
import { win, doc, undef, DOMToolsEx, LogTools } from './domkit.js';
import { Mediator } from './mediator.js';
import { BrowserKitEx } from './browserkit.js';
import { moduleLocations } from './defs.js';
import worldMarkup from './html/world.html';
import normalize from './css/normalize.css';
import worldStyle from './css/world.css';

const	eventLoop	= makeClass().mixin( Mediator ),
		console		= makeClass( class core{ }, { id: 'core'} ).mixin( LogTools ),
		DOM			= new DOMToolsEx(),
		Browser		= new BrowserKitEx(),
		nodes		= DOM.transpile( worldMarkup ),
		modules		= Object.create( null );

/*****************************************************************************************************
 * Class Component is the basic GUI Module set of BarFoos 2. It provides automatic html-string transpiling,
 * appending of module nodes, creating and waiting any async events (promises) to keep things in order and will
 * also be augmented with Log and Mediator classes for any GUI module
 *****************************************************************************************************/
class Component {
	constructor( options = { } ) {
		extend( this ).with( options ).and({
			id:						this.constructor.name,
			runtimeDependencies:	[ ]
		});

		if( typeof this.tmpl === 'string' ) {
			extend( this ).with({
				nodes:		Object.create( null ),
				location:	this.location || moduleLocations.center
			});

			this.runtimeDependencies.push( this.fire( 'waitForDOM.appEvents' ) );

			extend( this.nodes ).with( DOM.transpile( this.tmpl ) );

			nodes[ `section.${ this.location }` ].appendChild( this.nodes.root );
		} else {
			console.log('worker..?');
		}

		this.fire( 'moduleLaunch.appEvents', {
			id:	this.id
		});
	}

	init() {
		return Promise.all( this.runtimeDependencies ).then( () => this );
	}
}

// Component Extension (Mixin)
class ComponentEx extends mix( Component ).with( LogTools, Mediator ) { };
/****************************************** Component End ******************************************/

(async function main() {
	normalize.use();
	worldStyle.use();

	await eventLoop.fire( 'waitForDOM.appEvents' );

	console.log('CORE DOMReady Event. Injecting nodes to document body: ', nodes);

	doc.body.appendChild( nodes[ 'div#world' ] );

	nodes[ 'div#world' ].focus();
}());

/*****************************************************************************************************
 * Core Event handling
 *****************************************************************************************************/
eventLoop.on( 'moduleLaunch.appEvents', (module, event) => {
	if( module.id in modules ) {
		modules[ module.id ]++;
	} else {
		modules[ module.id ] = 1;
	}

	console.log( `module ${module.id} was launched( ${modules[module.id]}x )` );
	console.log( 'event object: ', event );
});

eventLoop.on( 'defineApp.appEvents', app => {
	console.log( `Setting up BarFoos Application ${ app.name } version ${ app.version }(${ app.status }).` );

	doc.title	= app.title;
});
/****************************************** Event Handling End ****************************************/

export { ComponentEx };

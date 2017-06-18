"use strict";

import { extend } from './toolkit.js';
import { win, doc, undef, DOMTools } from './domkit.js';
import { mediator } from './mediator.js';
import { moduleLocations } from 'barfoos2.0/defs.js';

let core		= Object.create( null ),
	appEvents	= new mediator({ register: 'ApplicationEvents' }),
	DOM			= new DOMTools();

class Component {
	constructor( options = { } ) {
		extend( this ).with( options ).and({
			appEvents:		new mediator({ register: 'ApplicationEvents' }),
			moduleEvents:	new mediator({ register: 'GUIModuleEvents' })
		});

		if( typeof this.tmpl === 'string' ) {
			this.nodes = Object.create( null );
			extend( this.nodes ).with( DOM.transpile( this.tmpl ) );
		} else {
			console.log('worker..?');
		}
	}
}

function init( ...modules ) {
	return appEvents.fire( 'waitForDOM' ).then( () => {
		return modules.length === 1	?	new modules[ 0 ]()
									:	modules.map( module => {
											return new module();
										});
	});
}

export { Component, init };
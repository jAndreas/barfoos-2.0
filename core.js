"use strict";

import { extend, Composition, makeClass, type } from './toolkit.js';
import { win, doc, undef, DOMTools } from './domkit.js';
import { BrowserKit } from './browserkit.js';
import { moduleLocations } from './defs.js';
import Mediator from './mediator.js';
import NodeTools from './nodetools.js';
import LogTools from './logtools.js';
import worldMarkup from './html/world.html';
import normalize from './css/normalize.scss';
import worldStyle from './css/world.scss';

const	eventLoop	= makeClass().mixin( Mediator ),
		console		= makeClass( class core{ }, { id: 'core'} ).mixin( LogTools ),
		DOM			= makeClass( class DOM{ }, { id: 'DOM'} ).mixin( Mediator, DOMTools ),
		Browser		= new BrowserKit(),
		modules		= Object.create( null );

		modules.online		= Object.create( null );
		modules.awaiting	= Object.create( null );

const [ nodes, data ]		= DOM.transpile( worldMarkup );

/*****************************************************************************************************
 * Class Component is the basic GUI Module set of BarFoos 2. It provides automatic html-string transpiling,
 * appending of module nodes, creating and waiting any async events (promises) to keep things in order and will
 * also be augmented with Log and Mediator classes for any GUI module
 *****************************************************************************************************/
class Component extends Composition( LogTools, Mediator, DOMTools, NodeTools ) {
	constructor( options = { } ) {
		super( ...arguments );

		extend( this ).with( options ).and({
			id:						this.constructor.name,
			runtimeDependencies:	[ ]
		});

		if( typeof this.tmpl === 'string' ) {
			extend( this ).with({
				nodes:			Object.create( null ),
				data:			Object.create( null ),
				location:		this.location,
				nodeLocation:	'beforeend'
			});

			let [ nodeHash, dataHash ] = this.transpile( this.tmpl );

			extend( this.nodes ).with( nodeHash );

			this.data = dataHash;
			this.data.set( this, Object.create( null ) );

			if( typeof this.location === 'string' ) {
				if( this.location in moduleLocations ) {
					nodes[ `section.${ this.location }` ].appendChild( this.nodes.root );
				} else if( this.location in modules.online ) {
					this.fire( `newChildModule.${ this.location }`, {
						node:			this.nodes.root,
						nodeLocation:	this.nodeLocation
					});
				} else {
					if( typeof modules.awaiting[ this.location ] === undef ) {
						modules.awaiting[ this.location ] = [ ];
					}

					modules.awaiting[ this.location ].push({
						node:			this.nodes.root,
						nodeLocation:	this.nodeLocation
					});
				}
			}

			this.runtimeDependencies.push(
				this.fire( 'waitForDOM.appEvents' )
			);
		} else {
			this.log('worker..?');
		}

		this.fire( 'moduleLaunch.appEvents', {
			id:	this.id
		});
	}

	init() {
		if(!ENV_PROD ) {
			win.bfdebug = () => {
				console.log( this );
			};
		}

		this.on( `newChildModule.${ this.id }`, this.newChildModule, this );

		return Promise.all( this.runtimeDependencies );
	}

	newChildModule( childNode, event ) {
		this.nodes.defaultChildContainer.insertAdjacentElement( 'afterbegin', childNode );
	}
}
/****************************************** Component End ******************************************/

/*****************************************************************************************************
 * Core entry point
 *****************************************************************************************************/
(async function main() {
	[ normalize, worldStyle ].forEach( style => style.use() );

	await eventLoop.fire( 'waitForDOM.appEvents' );

	doc.body.appendChild( nodes[ 'div#world' ] );

	// all eyes on us!
	nodes[ 'div#world' ].focus();
}());

/*****************************************************************************************************
 * Core Event handling
 *****************************************************************************************************/
eventLoop.on( 'moduleLaunch.appEvents', (module, event) => {
	if( module.id in modules.online ) {
		modules.online[ module.id ]++;
	} else {
		modules.online[ module.id ] = 1;
	}

	if( modules.awaiting[ module.id ] ) {
		for( let hookData of modules.awaiting[ module.id ] ) {
			this.fire( `newChildModule.${ module.id }`, hookData );
		}

		delete modules.awaiting[ module.id ];
	}

	console.log( `module ${module.id} was launched( ${modules.online[module.id]}x )` );
});

eventLoop.on( 'configApp.core', app => {
	console.log( `Setting up BarFoos Application ${ app.name } version ${ app.version }(${ app.status }).` );

	doc.title	= app.title || 'BarFoos Application';

	if( app.background ) {
		if( typeof app.background.image === 'string' ) {
			Browser.loadImage( app.background.image ).then( objURL => {
				let bgImage = document.createElement( 'div' );

				bgImage.style.backgroundImage = 'url(' + objURL + ')';
				bgImage.classList.add( 'backgroundImage' );

				for( let [ prop, value ] of Object.entries( app.background.css ) ) {
					bgImage.style[ prop ] = value;
				}

				nodes[ 'div#world' ].insertAdjacentElement( 'beforeBegin', bgImage );

				eventLoop.fire( 'backgroundImageLoaded.core' );
			});

		}
	}
});
/****************************************** Event Handling End ****************************************/

export { Component };

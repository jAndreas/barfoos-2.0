'use strict';

import { Component } from 'barfoos2.0/core';
import { moduleLocations } from 'barfoos2.0/defs';
import { extend } from 'barfoos2.0/toolkit';

import { htmlx } from '../markup/main.htmlx';
import { style } from '../style/main.scss';

/*****************************************************************************************************
 *  "description here"
 *****************************************************************************************************/
class MyModule extends Components {
	constructor( input = { }, options = { } ) {
		extend( options ).with({
			location:		moduleLocations.center,
			tmpl:			htmlx({

			})
		}).and( input );

		super( options );

		this.runtimeDependencies.push(
			this.fire( 'waitforHLSSupport.appEvents' )
		);

		return this.init();
	}

	async init() {
		// any component related declarations, bindings, listeners etc. which can get executed immediately, before we wait for possible dependencies

		await super.init();

		// any component related stuff which should wait on depedency resolve before executing (waitForDOM at least or additional async data)

		return this;
	}
}
/****************************************** MyModule End ******************************************/

async function start() {
	[ style ].forEach( style => style.use() );

	const instance = await new MyModule();
}

export { start };

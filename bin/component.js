#!/usr/bin/env node
'use strict';

const jsblueprint =
`'use strict';

import { Component } from 'barfoos2.0/core.js';
import { moduleLocations } from 'barfoos2.0/defs.js';
import { extend } from 'barfoos2.0/toolkit.js';

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

		// any component related stuff which should wait on dependencies resolve before executing (waitForDOM at least or additional async data)

		return this;
	}
}
/****************************************** MyModule End ******************************************/

async function start() {
	[ style ].forEach( style => style.use() );

	const instance = await new MyModule();
}

export { start };`;

const cssviewport =
`$defaultTextColor:rgba(220,220,220,0.95);
$defaultHoverColor:rgba(30, 40, 70, 0.8);
$iPhone6Portrait:415px;
$iPhone6Landscape:736px;
$iPadPortrait:768px;`;

const cssmain = `@import 'viewportDefinitions';`;

const htmlmain = `<div id="MyModule"></div>`;

const	path	= require( 'path' ),
		fs		= require( 'fs' ),
		cmd		= require( 'commander' ),
		folders = {
			fonts:	[ ],
			images:	[ ],
			markup: [ { 'main.htmlx': htmlmain } ],
			js:		[ { 'main.js': jsblueprint } ],
			style:	[ { '_viewportDefinitions.scss': cssviewport, 'main.scss': cssmain } ]
		};

const mkdirSync = path => {
	try {
		fs.mkdirSync( path );
	} catch (err) {
		if (err.code !== 'EEXIST') throw err
	}
}

cmd
	.version( '0.1.0' )
	.arguments( '<moduleName>' )
	.option( '-b, --blueprint', 'create blueprint templates' )
	.action(name => {
		mkdirSync( `${__dirname}/modules` );
		mkdirSync( `${__dirname}/modules/${ name }` );

		for( let [ folder, files ] of Object.entries( folders ) ) {
			mkdirSync( `${__dirname}/modules/${ name }/${ folder }` );

			if( cmd.blueprint ) {
				for( let file of files ) {
					Object.keys( file ).forEach( filename => {
						fs.writeFileSync( `${__dirname}/modules/${ name }/${ folder }/${ filename }`, file[ filename ].replace( /MyModule/g, name) );
					});
				}
			}
		}
	}).parse( process.argv );

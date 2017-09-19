#!/usr/bin/env node
'use strict';

const	path	= require( 'path' ),
		fs		= require( 'fs' ),
		cmd		= require( 'commander' ),
		folders	= [ 'fonts', 'images', 'markup', 'js', 'style' ];

const mkdirSync = path => {
	try {
		fs.mkdirSync( path );
	} catch (err) {
		if (err.code !== 'EEXIST') throw err
	}
}

cmd
	.arguments( '<moduleName>' )
	.action(name => {
		mkdirSync( `${__dirname}/modules` );
		mkdirSync( `${__dirname}/modules/${ name }` );

		for( let folder of folders ) {
			mkdirSync( `${__dirname}/modules/${ name }/${ folder }` );
		}
	}).parse( process.argv );

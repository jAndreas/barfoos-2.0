"use strict";

const	type		= input => Object.prototype.toString.call( input ).split( /\s/ )[ 1 ].slice( 0, -1 ),
		desc		= Object.getOwnPropertyDescriptor,
		defineProp	= Object.defineProperty,
		props		= Object.getOwnPropertyNames,
		getProto	= Object.getPrototypeOf,
		setProto	= Object.setPrototypeOf,
		slice		= Array.prototype.slice;

const	undef		= void 0;

/*****************************************************************************************************
 * mix() should be used to augment an already existing class with multiple mixin-classes
 * It can also be used to extend a class at declaration, therefore it will create a anonymous
 * default class if none was passed.
 *****************************************************************************************************/
function mix( targetClass = class { } ) {
	let composedClass;
	return {
		with: function( ...sources ) {
			composedClass = sources.reduce( ( composition, mixinFnc ) => mixinFnc( composition ), targetClass );
			return composedClass;
		}
	};
}

/*****************************************************************************************************
 * compose() should be exclusively used, to extend a class with mixins at declaration.
 * This is just sugar to not to be forced to call mix().with() with empty arguments.
 *****************************************************************************************************/
function Composition( ...sources ) {
	return sources.reduce( ( composition, mixinFnc ) => mixinFnc( composition ), class { } );
}

/*****************************************************************************************************
 * makeClass() should be used if there is no class to augment, but you still want to
 * use some features from mixin-functions. It will create+instantiate an anonymous class if nothing
 * was passed in and returns the option to directly mixin() stuff.
 *****************************************************************************************************/
function makeClass( cls, args = { } ) {
	let	composedClass;

	return {
		mixin: function( ...sources ) {
			composedClass = sources.reduce( ( composition, mixinFnc ) => mixinFnc( composition ), cls || class { } );
			return new composedClass( args );
		}
	};
}

function extend( target = { } ) {
	let actions = {
		'with': ( source = { }, DeepCloneFreeze ) => {
			let propList	= props( source ),
				len			= propList.length;

			while( len-- ) {
				loopKeys( propList[ len ] );
			}

			return actions;

			// -- locals --
			function loopKeys( key ) {
				if( typeof source[ key ] === 'object' && source[ key ] !== null && DeepCloneFreeze ) {
					if( Array.isArray( source[ key ] ) ) {
						if( Array.isArray( target[ key ] ) ) {
							target[ key ] = [ ...target[ key ], ...source[ key ] ];
							return;
						} else {
							target[ key ] = [ ];
						}
					} else {
						if( typeof target[ key ] === 'undefined' ) {
							target[ key ] = Object.create( null );
							setProto( target[ key ], getProto( source[ key ] ) );
						}
					}

					extend( target[ key ] ).with( source[ key ], DeepCloneFreeze );
				} else {
					defineProp( target, key, desc( source, key ) );
				}
			}
		},
		'get': function() {
			return target;
		}
	};

	actions.and = actions.with;

	return actions;
}

function hashCode( str = '' ) {
	let hash = 0;
	for (let i = 0, len = str.length; i < len; i++) {
		hash = str.charCodeAt( i ) + ( ( hash << 4 ) - hash );
	}

	return hash;
}

function intToRGB( i = 0 ){
	let c = (i & 0x00FFFFFF).toString( 16 ).toUpperCase();

	return '00000'.substring( 0, 6 - c.length ) + c;
}

export { mix, makeClass, Composition, extend, type, desc, defineProp, props, slice, hashCode, intToRGB };

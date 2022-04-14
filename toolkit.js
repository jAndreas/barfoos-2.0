'use strict';

const	type		= input => Object.prototype.toString.call( input ).split( /\s/ )[ 1 ].slice( 0, -1 ),
		desc		= Object.getOwnPropertyDescriptor,
		defineProp	= Object.defineProperty,
		props		= Object.getOwnPropertyNames,
		getProto	= Object.getPrototypeOf,
		setProto	= Object.setPrototypeOf,
		slice		= Array.prototype.slice;

const	win			= window,
		doc			= win.document,
		undef		= void 0,
		Seconds		= x => x * 1000,
		Minutes		= x => x * Seconds( 1 ) * 60,
		Hours		= x => x * Minutes( 1 ) * 60,
		Days		= x => x * Hours( 24 ),
		Weeks		= x => x * Days( 7 ),
		Months		= x => x * Days( 30 );

let	isMobileDevice	= false,
	isAgentCrawler	= /bot|google|bing|msn|duckduckbot|slurp/i.test( navigator.userAgent ),
	isLocalChrome	= /headlesschrome/i.test( navigator.userAgent );

(function() {
	let el = doc.createElement( 'div' );

	if( 'ontouchstart' in el ) {
		isMobileDevice = true;
	}

	el = null;
}());

/*****************************************************************************************************
 * mix() should be used to augment an already existing class with multiple mixin-classes
 * It can also be used to extend a class at declaration, therefore it will create a anonymous
 * default class if none was passed.
 *****************************************************************************************************/
function Mix( TargetClass = class { } ) {
	let ComposedClass;

	return {
		With: function( ...sources ) {
			ComposedClass = sources.reduce( ( Composition, MixinFnc ) => MixinFnc( Composition ), TargetClass );
			return ComposedClass;
		}
	};
}

/*****************************************************************************************************
 * Composition() should be exclusively used, to extend a class with mixins at declaration.
 * This is just sugar to not to be forced to call mix().with() with empty arguments.
 *****************************************************************************************************/
function Composition( ...sources ) {
	return sources.reduce( ( Composition, MixinFnc ) => MixinFnc( Composition ), class { } );
}

/*****************************************************************************************************
 * MakeClass() should be used if there is no class to augment, but you still want to
 * use some features from mixin-functions. It will create+instantiate an anonymous class if nothing
 * was passed in and returns the option to directly mixin() stuff.
 *****************************************************************************************************/
function MakeClass( cls, args = { } ) {
	let	ComposedClass;

	return {
		Mixin: function( ...sources ) {
			ComposedClass = sources.reduce( ( Composition, MixinFnc ) => MixinFnc( Composition ), cls || class { } );
			return new ComposedClass( args );
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

function getTimePeriod( timestamp ) {
		let diff 			= Date.now() - timestamp,
			diffSeconds		= Math.round( diff / 1000 ),
			diffMinutes		= Math.round( diffSeconds / 60 ),
			diffHours		= Math.round( diffMinutes / 60 ),
			diffDays		= Math.round( diffHours / 24 ),
			diffWeeks		= Math.round( diffDays / 7 ),
			diffMonths		= (diffWeeks / 4),
			diffYears		= (diffMonths / 12);

		if( diffYears >= 1 ) {
			diffYears = diffYears.toFixed( 1 ).replace( '.', ',' );

			if( diffYears.slice( -1 ) === '0' ) {
				diffYears = diffYears.slice( 0, -2 );
			}

			return diffYears + ' Jahr' + (diffYears > 1 ? 'en' : '');
		} else if( diffMonths >= 0.9 ) {
			return Math.round( diffMonths ) + ' Monat' + (diffMonths > 1 ? 'en' : '');
		} else if( diffWeeks >= 1 ) {
			return diffWeeks + ' Woche' + (diffWeeks > 1 ? 'n' : '');
		} else if( diffDays >= 1 ) {
			return diffDays + ' Tag' + (diffDays > 1 ? 'en' : '');
		} else if( diffHours >= 1 ) {
			return diffHours + ' Stunde' + (diffHours > 1 ? 'n' : '');
		} else if( diffMinutes >= 1) {
			return diffMinutes + ' Minute' + (diffMinutes > 1 ? 'n' : '');
		} else if( diffSeconds >= 1) {
			return diffSeconds + ' Sekunde' + (diffSeconds > 1 ? 'n' : '');
		} else {
			return 'kurzem...';
		}
	}

export { 
	Mix, MakeClass, Composition,
	extend,
	getTimePeriod,
	Seconds, Minutes, Hours, Days, Weeks, Months,
	type, desc, defineProp, props, slice, hashCode, intToRGB,
	undef, win,
	isMobileDevice, isAgentCrawler, isLocalChrome
};

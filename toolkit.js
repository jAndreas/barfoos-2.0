"use strict";

const	type		= Function.prototype.call.bind( Object.prototype.toString ),
		desc		= Object.getOwnPropertyDescriptor,
		defineProp	= Object.defineProperty,
		props		= Object.getOwnPropertyNames,
		getProto	= Object.getPrototypeOf,
		setProto	= Object.setPrototypeOf,
		slice		= Array.prototype.slice;

const	undef		= void 0;

function mix( targetClass ) {
	let composedClass;
	return {
		with: function( ...sources ) {
			composedClass = sources.reduce( ( composition, mixinFnc ) => mixinFnc( composition ), targetClass );
			return this;
		},
		spawn:				( ...args )	=> new composedClass( ...args ),
		spawnFrozen:		( ...args )	=> Object.freeze( new composedClass( ...args ) ),
		get result			() { return composedClass }
	};
}

function extend( target = { } ) {
	let actions = {
		'with': ( source = { }, noDeepClone ) => {
			let propList	= props( source ),
				len			= propList.length;
				
			while( len-- ) {
				loopKeys( propList[ len ] );
			}
		
			return actions;
			
			// -- locals --
			function loopKeys( key ) {
				if( typeof source[ key ] === 'object' && source[ key ] !== null && noDeepClone === undef ) {
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

					extend( target[ key ] ).with( source[ key ], noDeepClone );
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

export { mix, extend, type, desc, defineProp, props, slice };
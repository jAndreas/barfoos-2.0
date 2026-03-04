'use strict';

import { win } from './domkit.js';

const	DEBOUNCE_MS = 300;

/*****************************************************************************************************
 * Mixin Class State: Adds persistent property observation to a component.
 *
 * Usage:
 *   class MyModule extends Mix( Component ).With( State ) { ... }
 *
 *   async init() {
 *       await super.init();
 *       this.addState([ 'someFlag', 'currentIndex', 'volume' ]);
 *   }
 *
 * addState() accepts an Array of property names on the `this` context that should be observed.
 * Properties that already exist are captured immediately; properties that are set later in the
 * module lifecycle are caught transparently via Object.defineProperty getter/setter pairs.
 *
 * On any change the current snapshot of all observed properties is sent to the server via
 * the "updateState" socket event (debounced). On init(), getState() restores the last persisted
 * snapshot from the server.
 *****************************************************************************************************/
let State = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	async init() {
		super.init && await super.init( ...arguments );

		this._stateProps		= [ ];
		this._stateValues		= Object.create( null );
		this._stateDebounceId	= null;
		this._stateReady		= false;

		await this.getState();

		this._stateReady = true;

		return this;
	}

	addState( propertyNames = [ ] ) {
		if( !Array.isArray( propertyNames ) || !propertyNames.length ) {
			return;
		}

		for( let prop of propertyNames ) {
			if( this._stateProps.indexOf( prop ) !== -1 ) {
				continue;
			}

			this._stateProps.push( prop );

			// Capture current value if the property already exists on the instance
			let currentValue = this.hasOwnProperty( prop ) ? this[ prop ] : undefined;

			// Store the backing value
			this._stateValues[ prop ] = currentValue;

			// Remove the plain property so the getter/setter can take over
			if( this.hasOwnProperty( prop ) ) {
				delete this[ prop ];
			}

			// Define observed getter/setter on the instance
			Object.defineProperty( this, prop, {
				configurable:	true,
				enumerable:		true,
				get:			() => {
					return this._stateValues[ prop ];
				},
				set:			( newValue ) => {
					let oldValue = this._stateValues[ prop ];

					this._stateValues[ prop ] = newValue;

					if( this._stateReady && newValue !== oldValue ) {
						this._scheduleStateUpdate();
					}
				}
			});
		}
	}

	_scheduleStateUpdate() {
		if( this._stateDebounceId !== null ) {
			win.clearTimeout( this._stateDebounceId );
		}

		this._stateDebounceId = win.setTimeout( () => {
			this._stateDebounceId = null;
			this._sendStateUpdate();
		}, DEBOUNCE_MS );
	}

	async _sendStateUpdate() {
		if( !this.id || !this._stateProps || !this._stateProps.length ) {
			return;
		}

		try {
			let data = Object.create( null );

			for( let prop of this._stateProps ) {
				data[ prop ] = this._stateValues[ prop ];
			}

			await this.send({
				type:		'updateState',
				payload:	{
					from:	this.id,
					data:	data
				}
			}, { simplex: true });
		} catch( ex ) {
			this.log && this.log( `State _sendStateUpdate() => ${ ex.message || ex }` );
		}
	}

	async getState() {
		if( !this.id ) {
			return;
		}

		try {
			let response = await this.send({
				type:		'getState',
				payload:	{
					from:	this.id
				}
			});

			if( response && typeof response === 'object' ) {
				// Temporarily disable change-reporting while restoring persisted state
				let wasReady		= this._stateReady;
				this._stateReady	= false;

				Object.assign( this, response );

				this._stateReady = wasReady;
			}
		} catch( ex ) {
			this.log && this.log( `State getState() => ${ ex.message || ex }` );
		}
	}

	destroy() {
		if( this._stateDebounceId !== null ) {
			win.clearTimeout( this._stateDebounceId );
			this._stateDebounceId = null;

			// Flush any pending state update before destruction
			this._sendStateUpdate();
		}

		this._stateProps	= null;
		this._stateValues	= null;

		super.destroy && super.destroy( ...arguments );
	}
}

export default State;

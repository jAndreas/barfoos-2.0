import { extend, intToRGB, hashCode } from './toolkit.js';

/*****************************************************************************************************
 * Mixin Class LogTools: Provides a logging with hash-generated color from base class constructor name
 *****************************************************************************************************/
let LogTools = target => class extends target {
	constructor( options = { } ) {
		super( ...arguments );

		extend( this ).with({
			id:		options.id || this.constructor.name,
			color:	intToRGB( hashCode( options.id || this.constructor.name ) )
		});
	}

	log( ...args ) {
		if( ENV_PROD ) {
			return;
		}

		let prefixed = args.slice( 0 );

		prefixed.unshift( `%c${this.id}: `, `color: #${this.color};font-weight: normal;text-shadow: 1px 1px 1px white,-1px -1px 1px black;` );

		console.groupCollapsed( ...prefixed );
		this.nodes && console.log( this.nodes.root );
		console.trace();
		console.groupEnd();

		super.log && super.log( ...args );
	}

	error( ...args ) {
		let prefixed = args.slice( 0 );

		prefixed.unshift( `%c${this.id}: `, `color: #${this.color};background-color:red;font-weight:normal;text-shadow: 1px 1px 1px white,-1px -1px 1px black;` );

		console.groupCollapsed( ...prefixed );
		this.nodes && console.log( this.nodes.root );
		throw new Error( args );
		console.groupEnd();

		super.error && super.error( ...args );
	}

	warn( ...args ) {
		if( ENV_PROD ) {
			return;
		}
		
		let prefixed = args.slice( 0 );

		prefixed.unshift( `%c${this.id}: `, `color: #${this.color};background-color:yellow;font-weight:normal;text-shadow: 1px 1px 1px white,-1px -1px 1px black;` );

		console.groupCollapsed( ...prefixed );
		this.nodes && console.log( this.nodes.root );
		console.trace();
		console.groupEnd();

		super.warn && super.warn( ...args );
	}
};
/********************************************* LogTools End ******************************************/

export default LogTools;

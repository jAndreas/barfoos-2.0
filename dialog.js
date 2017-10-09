'use strict';

import { Component } from './core.js';
import { makeClass } from './toolkit.js';
import { win, doc, undef, DOMTools } from './domkit.js';
import Mediator from './mediator.js';
import dialogStyle from './css/dialog.scss';
import dialogMarkup from './html/dialog.html';

const DOM				= makeClass( class DOM{ }, { id: 'DOM'} ).mixin( Mediator, DOMTools );
const [ nodes, data ]	= DOM.transpile( dialogMarkup );

class Overlay extends Component {
	constructor( input = { }, options = { } ) {
		super( ...arguments  );
	}

	init() {
		if( typeof this.location !== 'string' ) {
			this.error( `Destonation is required for options.location. Received ${ this.location } instead.` );
		}

		super.init && super.init();
	}

	installModule() {
		//SWAP this.nodes.root HERE WITH DIALOG/OVERLAY TEMPLATE WITH INJECTED NODES
		super.installModule && super.installModule();
	}
}

let Dialog = target => class extends target {
	constructor() {
		super( ...arguments );

	}
};

let Draggable = target => class extends target {
	constructor() {
		super( ...arguments );

	}
};

let GlasEffect = target => class extends target {
	constructor() {
		super( ...arguments );

	}
};

(async function main() {
	[ dialogStyle ].forEach( style => style.use() );
}());

export { Overlay, Dialog, Draggable, GlasEffect };

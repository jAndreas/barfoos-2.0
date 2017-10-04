'use strict';

import { Component } from './core.js';
import dialogStyle from './css/dialog.scss';
import dialogMarkup from './html/dialog.html';

class Overlay extends Component {
	constructor( input = { }, options = { } ) {
		super( ...arguments  );

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

export { Overlay, Dialog, Draggable, GlasEffect };

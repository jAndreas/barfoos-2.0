'use strict';

import { win } from 'barfoos2.0/domkit.js';

let synth, voices, defaultVoice;

let Speech = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	async init() {
		super.init && await super.init( ...arguments );

		try {
			if( 'speechSynthesis' in win ) {
				synth			= win.speechSynthesis;
				defaultVoice	= await this.waitForVoices();

				this.speechNotAvailable = false;
			} else {
				this.speechNotAvailable = true;
			}
		} catch( ex ) {
			this.speechNotAvailable = true;
			this.log( ex.message );
		}
	}

	read( text ) {
		try {
			return new Promise(( res, rej ) => {
				let utter		= new SpeechSynthesisUtterance( text );
				utter.voice		= defaultVoice;

				utter.onend 	= () => res();
				utter.onerror	= () => res();

				synth.speak( utter );
			});
		} catch( ex ) {
			this.log( ex.message );

			return false;
		}
	}

	waitForVoices() {
		return new Promise(( res, rej ) => {
			(function _aLoop() {
				voices = synth.getVoices();

				if( voices && voices.length ) {
					res( voices.find( voice => voice.default ) );
				} else {
					win.setTimeout( _aLoop, 50 );
				}
			}());
		});
	}
}

export default Speech;

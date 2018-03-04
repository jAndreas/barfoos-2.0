'use strict';

let xDown, yDown, touchStart, xDiff, yDiff;

let Swipe = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	async init() {
		super.init && await super.init( ...arguments );
		this.addNodeEvent( this.nodes.root, 'touchstart', this.onSwipeTouchStart );
		this.addNodeEvent( this.nodes.root, 'touchmove', this.onSwipeTouchMove );
		this.addNodeEvent( this.nodes.root, 'touchend', this.onSwipeTouchEnd );
		console.log('swipe events registered for: ', this.nodes.root);
	}

	onSwipeTouchStart( event ) {
		xDown = event.touches[ 0 ].clientX;
		yDown = event.touches[ 0 ].clientY;
		touchStart = Date.now();
	}

	onSwipeTouchMove( event ) {
		if( !xDown || !yDown ) {
			return;
		}

		let xUp		= event.touches[ 0 ].clientX,
			yUp		= event.touches[ 0 ].clientY;

		xDiff	= xDown - xUp,
		yDiff	= yDown - yUp;
	}

	onSwipeTouchEnd( event ) {
		let touchEnd = Date.now();

		if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
			if ( xDiff > 0 ) {
				/* left swipe */
			} else {
				/* right swipe */
			}
		} else {
			if( (touchEnd - touchStart) < 300 ) {
				if ( yDiff > 10 ) {
					this.onSwipeDown && this.onSwipeDown();
				} else if( yDiff < -10 ) {
					this.onSwipeUp && this.onSwipeUp();
				}
			}
		}

		xDown = yDown = xDiff = yDiff = touchStart = null;
	}
}

export default Swipe;

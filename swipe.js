'use strict';

/*****************************************************************************************************
 * Mixin Class Swipe: Adds swipe gesture detection to a component.
 *
 * By default, registers on this.nodes.root. Override swipeTargetNodes() to return
 * an array of node keys or HTMLElements to register on specific nodes instead.
 *
 * Override any of these methods in the consuming class to handle gestures:
 *   onSwipeUp()    — finger moved upward
 *   onSwipeDown()  — finger moved downward
 *   onSwipeLeft()  — finger moved left
 *   onSwipeRight() — finger moved right
 *
 * Additional hooks:
 *   onTouchMove(xDiff, yDiff) — called on every touchmove with current deltas
 *                                (positive xDiff = left, positive yDiff = up)
 *   onSwipeReset()            — called when touch ends below threshold or is
 *                                cancelled; use to undo visual previews
 *
 * Fires mediator events: slideUpGesture.<id>, slideDownGesture.<id>,
 * slideLeftGesture.<id>, slideRightGesture.<id>
 *****************************************************************************************************/
let Swipe = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	async init() {
		super.init && await super.init( ...arguments );

		this._swipeRafId		= null;
		this._swipeTargetRefs	= [];

		// Bound handler for native touchmove — bypasses delegation for performance.
		// touchmove fires at ~60Hz; skipping the delegation proxy/walk-up saves
		// significant per-frame overhead. rAF coalescing drops redundant frames.
		this._boundSwipeTouchMove = ( event ) => {
			if( this._swipeXDown == null || !event.touches || !event.touches.length ) {
				return;
			}

			this._swipeXDiff = this._swipeXDown - event.touches[ 0 ].clientX;
			this._swipeYDiff = this._swipeYDown - event.touches[ 0 ].clientY;

			if( this._swipeRafId == null ) {
				this._swipeRafId = requestAnimationFrame( () => {
					this._swipeRafId = null;
					this.onTouchMove && this.onTouchMove( this._swipeXDiff, this._swipeYDiff );
				});
			}
		};

		let targets = this.swipeTargetNodes ? this.swipeTargetNodes() : [ this.nodes.root ];

		for( let node of targets ) {
			if( typeof node === 'string' ) {
				node = this.nodes[ node ];
			}

			this.addNodeEvent( node, 'touchstart', this._onSwipeTouchStart );
			this.addNodeEvent( node, 'touchend', this._onSwipeTouchEnd );
			this.addNodeEvent( node, 'touchcancel', this._onSwipeTouchCancel );

			// Native passive listener for touchmove — compositor can scroll without
			// waiting for JS, and we avoid the delegation handler overhead entirely.
			node.addEventListener( 'touchmove', this._boundSwipeTouchMove, { passive: true } );
			this._swipeTargetRefs.push( node );
		}

		return this;
	}

	async destroy() {
		if( this._swipeRafId != null ) {
			cancelAnimationFrame( this._swipeRafId );
			this._swipeRafId = null;
		}

		if( this._swipeTargetRefs ) {
			for( let node of this._swipeTargetRefs ) {
				node.removeEventListener( 'touchmove', this._boundSwipeTouchMove );
			}
			this._swipeTargetRefs = null;
		}

		this._boundSwipeTouchMove = null;

		super.destroy && await super.destroy( ...arguments );
	}

	_onSwipeTouchStart( event ) {
		if( event.touches && event.touches.length ) {
			this._swipeXDown		= event.touches[ 0 ].clientX;
			this._swipeYDown		= event.touches[ 0 ].clientY;
			this._swipeTouchStart	= Date.now();
			this._swipeXDiff		= 0;
			this._swipeYDiff		= 0;
		}
	}

	_onSwipeTouchEnd( event ) {
		// Cancel pending visual update — touch sequence is over
		if( this._swipeRafId != null ) {
			cancelAnimationFrame( this._swipeRafId );
			this._swipeRafId = null;
		}

		// Use the actual finger-lift position from changedTouches, not the last
		// touchmove diff — the finger can move significantly between the last
		// touchmove event and touchend, especially during fast/wild gestures.
		let touch		= event.changedTouches && event.changedTouches[ 0 ],
			finalX		= touch ? this._swipeXDown - touch.clientX : this._swipeXDiff,
			finalY		= touch ? this._swipeYDown - touch.clientY : this._swipeYDiff,
			elapsed		= Date.now() - this._swipeTouchStart,
			absX		= Math.abs( finalX ),
			absY		= Math.abs( finalY ),
			maxAbs		= Math.max( absX, absY ),
			velocity	= elapsed > 0 ? maxAbs / elapsed : 0,
			threshold	= 80;

		// Recognize gesture if distance exceeds threshold, OR if it is a fast
		// flick (high velocity with minimal travel to filter accidental taps)
		if( maxAbs < threshold && !( velocity > 0.4 && maxAbs > 20 ) ) {
			this.onSwipeReset && this.onSwipeReset();
			this._swipeXDown = this._swipeYDown = this._swipeXDiff = this._swipeYDiff = this._swipeTouchStart = null;
			return;
		}

		if( absY > absX ) {
			// Vertical swipe dominates
			if( finalY > 0 ) {
				this.onSwipeUp && this.onSwipeUp();
				this.fire( `slideUpGesture.${ this.id }` );
			} else {
				this.onSwipeDown && this.onSwipeDown();
				this.fire( `slideDownGesture.${ this.id }` );
			}
		} else {
			// Horizontal swipe dominates
			if( finalX > 0 ) {
				this.onSwipeLeft && this.onSwipeLeft();
				this.fire( `slideLeftGesture.${ this.id }` );
			} else {
				this.onSwipeRight && this.onSwipeRight();
				this.fire( `slideRightGesture.${ this.id }` );
			}
		}

		this._swipeXDown = this._swipeYDown = this._swipeXDiff = this._swipeYDiff = this._swipeTouchStart = null;
	}

	_onSwipeTouchCancel() {
		// Browser cancelled the touch sequence (e.g. compositor took over scrolling).
		// Cancel pending visual update and reset previews, then clear state.
		if( this._swipeRafId != null ) {
			cancelAnimationFrame( this._swipeRafId );
			this._swipeRafId = null;
		}

		this.onSwipeReset && this.onSwipeReset();
		this._swipeXDown = this._swipeYDown = this._swipeXDiff = this._swipeYDiff = this._swipeTouchStart = null;
	}
}

export default Swipe;

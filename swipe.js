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

		let targets = this.swipeTargetNodes ? this.swipeTargetNodes() : [ this.nodes.root ];

		for( let node of targets ) {
			this.addNodeEvent( node, 'touchstart', this._onSwipeTouchStart );
			this.addNodeEvent( node, 'touchmove', this._onSwipeTouchMove );
			this.addNodeEvent( node, 'touchend', this._onSwipeTouchEnd );
			this.addNodeEvent( node, 'touchcancel', this._onSwipeTouchCancel );
		}

		return this;
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

	_onSwipeTouchMove( event ) {
		if( this._swipeXDown == null || !event.touches || !event.touches.length ) {
			return;
		}

		this._swipeXDiff = this._swipeXDown - event.touches[ 0 ].clientX;
		this._swipeYDiff = this._swipeYDown - event.touches[ 0 ].clientY;

		this.onTouchMove && this.onTouchMove( this._swipeXDiff, this._swipeYDiff );
	}

	_onSwipeTouchEnd( event ) {
		let elapsed		= Date.now() - this._swipeTouchStart,
			absX		= Math.abs( this._swipeXDiff ),
			absY		= Math.abs( this._swipeYDiff ),
			threshold	= 40;

		// Only count gestures with enough movement
		if( absX < threshold && absY < threshold ) {
			this.onSwipeReset && this.onSwipeReset();
			this._swipeXDown = this._swipeYDown = this._swipeXDiff = this._swipeYDiff = this._swipeTouchStart = null;
			return;
		}

		if( absY > absX ) {
			// Vertical swipe dominates
			if( this._swipeYDiff > 0 ) {
				this.onSwipeUp && this.onSwipeUp();
				this.fire( `slideUpGesture.${ this.id }` );
			} else {
				this.onSwipeDown && this.onSwipeDown();
				this.fire( `slideDownGesture.${ this.id }` );
			}
		} else {
			// Horizontal swipe dominates
			if( this._swipeXDiff > 0 ) {
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
		// Reset visual previews, then clear state.
		this.onSwipeReset && this.onSwipeReset();
		this._swipeXDown = this._swipeYDown = this._swipeXDiff = this._swipeYDiff = this._swipeTouchStart = null;
	}
}

export default Swipe;

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
 *   onTouchMove(xDiff, yDiff, axisLock) — called on every touchmove with current deltas
 *                                (positive xDiff = left, positive yDiff = up)
 *                                axisLock is null, 'h', or 'v' once dominant axis is determined
 *   onSwipeReset()            — called when touch ends below threshold, is
 *                                cancelled, or gesture direction has no handler
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
		this._swipeAxisLock		= null;
		this._swipeTargetRefs	= [];

		// Bound handlers — all touch events bypass delegation for performance.
		// touchmove fires at ~60Hz; skipping the delegation proxy/walk-up saves
		// significant per-frame overhead. rAF coalescing drops redundant frames.
		// touchstart/touchend/touchcancel also bypass delegation to avoid
		// compositor ↔ main-thread sync delays on iOS inside scroll containers.
		this._boundSwipeTouchStart	= this._onSwipeTouchStart.bind( this );
		this._boundSwipeTouchEnd	= this._onSwipeTouchEnd.bind( this );
		this._boundSwipeTouchCancel	= this._onSwipeTouchCancel.bind( this );
		this._boundSwipeTouchMove	= ( event ) => {
			if( this._swipeXDown == null || !event.touches || !event.touches.length ) {
				return;
			}

			this._swipeXDiff = this._swipeXDown - event.touches[ 0 ].clientX;
			this._swipeYDiff = this._swipeYDown - event.touches[ 0 ].clientY;

			if( !this._swipeAxisLock ) {
				let totalMove = Math.abs( this._swipeXDiff ) + Math.abs( this._swipeYDiff );

				if( totalMove > 10 ) {
					this._swipeAxisLock = Math.abs( this._swipeXDiff ) >= Math.abs( this._swipeYDiff ) ? 'h' : 'v';
				}
			}

			if( this._swipeAxisLock && this.swipePreventScroll && this.swipePreventScroll( this._swipeAxisLock ) ) {
				event.preventDefault();
			}

			if( this._swipeRafId == null ) {
				this._swipeRafId = requestAnimationFrame( () => {
					this._swipeRafId = null;
					this.onTouchMove && this.onTouchMove( this._swipeXDiff, this._swipeYDiff, this._swipeAxisLock );
				});
			}
		};

		let targets			= this.swipeTargetNodes ? this.swipeTargetNodes() : [ this.nodes.root ],
			needsPrevent	= typeof this.swipePreventScroll === 'function';

		for( let node of targets ) {
			if( typeof node === 'string' ) {
				node = this.nodes[ node ];
			}

			// All touch listeners registered natively — bypasses delegation
			// overhead entirely and avoids compositor sync delays on iOS.
			// touchstart/touchend/touchcancel are passive (no preventDefault).
			// touchmove is non-passive only when swipePreventScroll is defined.
			node.addEventListener( 'touchstart',  this._boundSwipeTouchStart,  { passive: true } );
			node.addEventListener( 'touchend',    this._boundSwipeTouchEnd,    { passive: true } );
			node.addEventListener( 'touchcancel', this._boundSwipeTouchCancel, { passive: true } );
			node.addEventListener( 'touchmove',   this._boundSwipeTouchMove,   { passive: !needsPrevent } );
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
				node.removeEventListener( 'touchstart',  this._boundSwipeTouchStart );
				node.removeEventListener( 'touchend',    this._boundSwipeTouchEnd );
				node.removeEventListener( 'touchcancel', this._boundSwipeTouchCancel );
				node.removeEventListener( 'touchmove',   this._boundSwipeTouchMove );
			}
			this._swipeTargetRefs = null;
		}

		this._boundSwipeTouchStart	= null;
		this._boundSwipeTouchEnd	= null;
		this._boundSwipeTouchCancel	= null;
		this._boundSwipeTouchMove	= null;

		super.destroy && await super.destroy( ...arguments );
	}

	_onSwipeTouchStart( event ) {
		if( event.touches && event.touches.length ) {
			this._swipeXDown		= event.touches[ 0 ].clientX;
			this._swipeYDown		= event.touches[ 0 ].clientY;
			this._swipeTouchStart	= Date.now();
			this._swipeXDiff		= 0;
			this._swipeYDiff		= 0;
			this._swipeAxisLock		= null;
		}
	}

	_onSwipeTouchEnd( event ) {
		// Guard: delegation walk-up can fire this handler multiple times per
		// single touchend.  After the first call clears _swipeXDown, subsequent
		// calls would compute NaN diffs and trigger phantom onSwipeRight() calls.
		if( this._swipeXDown == null ) return;

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
			this._swipeXDown = this._swipeYDown = this._swipeXDiff = this._swipeYDiff = this._swipeTouchStart = this._swipeAxisLock = null;
			return;
		}

		// Gesture recognized — stop the event from bubbling further.
		// This prevents BarFoos delegation handlers on ancestor nodes from
		// running expensive recursive walk-ups on touchend for no reason
		// (click→touchend mapping). Taps (below threshold) still propagate
		// normally so delegated click handlers continue to work.
		event.stopPropagation();

		if( absY > absX ) {
			// Vertical swipe dominates
			if( finalY > 0 ) {
				if( this.onSwipeUp ) {
					this.onSwipeUp();
				} else {
					this.onSwipeReset && this.onSwipeReset();
				}
				this.fire( `slideUpGesture.${ this.id }` );
			} else {
				if( this.onSwipeDown ) {
					this.onSwipeDown();
				} else {
					this.onSwipeReset && this.onSwipeReset();
				}
				this.fire( `slideDownGesture.${ this.id }` );
			}
		} else {
			// Horizontal swipe dominates
			if( finalX > 0 ) {
				if( this.onSwipeLeft ) {
					this.onSwipeLeft();
				} else {
					this.onSwipeReset && this.onSwipeReset();
				}
				this.fire( `slideLeftGesture.${ this.id }` );
			} else {
				if( this.onSwipeRight ) {
					this.onSwipeRight();
				} else {
					this.onSwipeReset && this.onSwipeReset();
				}
				this.fire( `slideRightGesture.${ this.id }` );
			}
		}

		this._swipeXDown = this._swipeYDown = this._swipeXDiff = this._swipeYDiff = this._swipeTouchStart = this._swipeAxisLock = null;
	}

	_onSwipeTouchCancel() {
		if( this._swipeXDown == null ) return;

		// Browser cancelled the touch sequence (e.g. compositor took over scrolling).
		// Cancel pending visual update and reset previews, then clear state.
		if( this._swipeRafId != null ) {
			cancelAnimationFrame( this._swipeRafId );
			this._swipeRafId = null;
		}

		this.onSwipeReset && this.onSwipeReset();
		this._swipeXDown = this._swipeYDown = this._swipeXDiff = this._swipeYDiff = this._swipeTouchStart = this._swipeAxisLock = null;
	}
}

export default Swipe;

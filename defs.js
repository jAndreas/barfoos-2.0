"use strict";

const	moduleLocations				= Object.create( null );
		moduleLocations.head		= 'head',
		moduleLocations.left		= 'left',
		moduleLocations.center		= 'center',
		moduleLocations.right		= 'right',
		moduleLocations.footer		= 'footer';

const	VK							= Object.create( null );
		VK.ESC						= 27,
		VK.BACKSPACE				= 8,
		VK.TAB						= 9,
		VK.RETURN					= 13,
		VK.LEFT						= 37,
		VK.UP						= 38,
		VK.RIGHT					= 39,
		VK.DOWN						= 40,
		VK.CTRL						= 17,
		VK.SHIFT					= 16,
		VK.ALT						= 18,
		VK.CMD						= 91;

export { moduleLocations, VK };

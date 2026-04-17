/**
 * CDG Context Constants
 * =====================
 *
 * These are used to set up the drawing context
 */

export const TILE_WIDTH = 6;
export const TILE_HEIGHT = 12;
export const TILES_X = 50;
export const TILES_Y = 18;
export const TILES_X_BORDER = 1;
export const TILES_Y_BORDER = 1;
export const WIDTH = TILE_WIDTH * TILES_X; // 300px
export const HEIGHT = TILE_HEIGHT * TILES_Y; // 216px
export const BORDER_WIDTH = TILE_WIDTH * TILES_X_BORDER;
export const BORDER_HEIGHT = TILE_HEIGHT * TILES_Y_BORDER;
export const DISPLAY_WIDTH = WIDTH - 2 * BORDER_WIDTH; // 288px
export const DISPLAY_HEIGHT = HEIGHT - 2 * BORDER_HEIGHT; // 192px
export const DISPLAY_BOUNDS = [
  BORDER_WIDTH,
  BORDER_HEIGHT,
  BORDER_WIDTH + DISPLAY_WIDTH,
  BORDER_HEIGHT + DISPLAY_HEIGHT
];
export const DISPLAY_PIXELS = WIDTH * HEIGHT;

/**
 * CDG Instruction Constants
 * =========================
 *
 * These are used for interpreting commands
 */

export const CDG_NOOP = 0;
export const CDG_MEMORY_PRESET = 1;
export const CDG_BORDER_PRESET = 2;
export const CDG_TILE_BLOCK = 6;
export const CDG_SCROLL_PRESET = 20;
export const CDG_SCROLL_COPY = 24;
export const CDG_SET_KEY_COLOR = 28;
export const CDG_LOAD_CLUT_LOW = 30;
export const CDG_LOAD_CLUT_HI = 31;
export const CDG_TILE_BLOCK_XOR = 38;

export const CDG_SCROLL_NONE = 0;
export const CDG_SCROLL_LEFT = 1;
export const CDG_SCROLL_RIGHT = 2;
export const CDG_SCROLL_UP = 1;
export const CDG_SCROLL_DOWN = 2;

export const CDG_DATA = 4;

export const COMMAND_MASK = 0x3f;
export const CDG_COMMAND = 0x09;
export const SECTORS_PER_SECOND = 75;
export const PACKETS_PER_SECTOR = 4;
export const PACKET_SIZE = 24;

/**
 *  CDG Audio Constants
 */

export const GAIN_DEFAULT = 1.0;
export const PITCH_DEFAULT = 1;

/**
 *  CDG Player Constants
 */

export const SCALE_DEFAULT = 1;
export const FILTER_PLAYBACK_OFFSET = 800;
export const START_TIME = '0:00';

/**
 * CDG Controls Constants
 */
export const PANEL_POSITION = ['top', 'bottom'];

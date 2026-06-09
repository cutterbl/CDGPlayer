/** Tile dimensions in pixels for one CD+G tile cell. */
export const TILE_WIDTH = 6;
export const TILE_HEIGHT = 12;
export const TILES_X = 50;
export const TILES_Y = 18;
export const TILES_X_BORDER = 1;
export const TILES_Y_BORDER = 1;

/** Full frame dimensions in pixels. */
export const WIDTH = TILE_WIDTH * TILES_X;
export const HEIGHT = TILE_HEIGHT * TILES_Y;

export const BORDER_WIDTH = TILE_WIDTH * TILES_X_BORDER;
export const BORDER_HEIGHT = TILE_HEIGHT * TILES_Y_BORDER;
export const DISPLAY_WIDTH = WIDTH - 2 * BORDER_WIDTH;
export const DISPLAY_HEIGHT = HEIGHT - 2 * BORDER_HEIGHT;
/** Visible viewport bounds inside the border region: [left, top, right, bottom]. */
export const DISPLAY_BOUNDS: readonly [number, number, number, number] = [
  BORDER_WIDTH,
  BORDER_HEIGHT,
  BORDER_WIDTH + DISPLAY_WIDTH,
  BORDER_HEIGHT + DISPLAY_HEIGHT,
];
export const DISPLAY_PIXELS = WIDTH * HEIGHT;

/** CD+G opcode constants. */
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

/** Scroll command constants used by scroll preset/copy instructions. */
export const CDG_SCROLL_NONE = 0;
export const CDG_SCROLL_LEFT = 1;
export const CDG_SCROLL_RIGHT = 2;
export const CDG_SCROLL_UP = 1;
export const CDG_SCROLL_DOWN = 2;

export const CDG_DATA = 4;

/** Packet-level protocol constants. */
export const COMMAND_MASK = 0x3f;
export const CDG_COMMAND = 0x09;
export const SECTORS_PER_SECOND = 75;
export const PACKETS_PER_SECTOR = 4;
export const PACKET_SIZE = 24;

import {
  PACKET_SIZE,
  PACKETS_PER_SECTOR,
  SECTORS_PER_SECOND,
} from './constants.js';
import { CDGContext } from './cdg-context.js';
import { CDGParser } from './cdg-parser.js';
import { DEFAULT_ASYNC_PARSE_CHUNK_PACKETS } from './utils/runtime.constants.js';
import {
  cancelFrame,
  now,
  requestFrame,
  resolvePacketsPerChunk,
  yieldToEventLoop,
} from './utils/runtime.functions.js';
import type {
  AnimationFrameHandle,
  ByteLike,
  CdgInstructionLike,
  CdgPlayerOptions,
  CdgRenderContext,
} from './types.js';

/**
 * CDGPlayer executes instruction packets and keeps frame advancement in sync
 * with the audio timeline supplied by the host runtime.
 */
export class CDGPlayer {
  instructions: CdgInstructionLike[] = [];
  pc = -1;
  frameId: AnimationFrameHandle | null = null;
  pos = 0;
  lastSyncPos: number | null = null;
  lastTimestamp: number | null = null;

  context: CdgRenderContext;
  afterRender: ((context: CdgRenderContext) => void) | undefined;

  /**
   * Creates a low-level CD+G player with optional injected render context.
   */
  constructor({
    contextOptions = {},
    context,
    afterRender,
  }: CdgPlayerOptions = {}) {
    this.context = context ?? this.createContext({ contextOptions });
    this.afterRender = afterRender;
  }

  /**
   * Frame loop callback that advances program counter using elapsed playback time.
   */
  update = (timestamp = now()): CDGPlayer => {
    if (this.pc === -1) {
      return this;
    }

    this.frameId = requestFrame({ callback: this.update });

    if (this.lastSyncPos != null && this.lastTimestamp != null) {
      this.pos = this.lastSyncPos + (timestamp - this.lastTimestamp);
    } else {
      const last = this.lastTimestamp ?? timestamp;
      this.pos += timestamp - last;
      this.lastTimestamp = timestamp;
    }

    const newPc = Math.floor(
      SECTORS_PER_SECOND * PACKETS_PER_SECTOR * (this.pos / 1000),
    );
    const ffAmount = newPc - this.pc;
    if (ffAmount > 0) {
      this.fastForward({ count: ffAmount });
      this.render();
    }

    return this;
  };

  /**
   * Factory for render context creation (override in tests/custom builds).
   */
  createContext({
    contextOptions,
  }: {
    contextOptions?: Partial<ConstructorParameters<typeof CDGContext>[0]>;
  }): CdgRenderContext {
    return new CDGContext(contextOptions);
  }

  /**
   * Synchronously parses and loads full CD+G data into executable instructions.
   */
  load({ data }: { data: ByteLike }): CDGPlayer {
    const parser = new CDGParser();
    this.instructions = parser.parseInstructions({ bytes: data });
    this.reset();
    return this;
  }

  /**
   * Asynchronously parses and loads CD+G data in chunks to avoid long main-thread blocks.
   */
  async loadAsync({
    data,
    chunkPackets = DEFAULT_ASYNC_PARSE_CHUNK_PACKETS,
  }: {
    data: ByteLike;
    chunkPackets?: number;
  }): Promise<CDGPlayer> {
    const parser = new CDGParser();
    const parsedInstructions: CdgInstructionLike[] = [];
    const packetsPerChunk = resolvePacketsPerChunk({ chunkPackets });
    let packetsSinceYield = 0;

    for (let offset = 0; offset < data.length; offset += PACKET_SIZE) {
      parsedInstructions.push(parser.parseInstruction({ bytes: data, offset }));
      packetsSinceYield += 1;

      if (packetsSinceYield >= packetsPerChunk) {
        packetsSinceYield = 0;
        await yieldToEventLoop();
      }
    }

    this.instructions = parsedInstructions;
    this.reset();
    return this;
  }

  /**
   * Resets playback counters and raster context state.
   */
  reset(): CDGPlayer {
    this.pc = 0;
    this.pos = 0;
    this.lastSyncPos = null;
    this.lastTimestamp = null;
    this.context.reset();
    return this;
  }

  /**
   * Renders the current context frame and fires optional afterRender hook.
   */
  render(): CDGPlayer {
    this.context.renderFrame();
    this.afterRender?.(this.context);
    return this;
  }

  /**
   * Executes one instruction against current render context.
   */
  executeInstruction({
    instruction,
  }: {
    instruction: CdgInstructionLike | undefined;
  }): CDGPlayer {
    instruction?.execute(this.context);
    return this;
  }

  /**
   * Advances by a single instruction packet.
   */
  step(): CDGPlayer {
    if (this.pc >= 0 && this.pc < this.instructions.length) {
      this.executeInstruction({ instruction: this.instructions[this.pc] });
      this.pc += 1;
    } else {
      this.pc = -1;
      this.stop();
    }

    return this;
  }

  /**
   * Advances multiple instruction packets.
   */
  fastForward({ count = 1 }: { count?: number }): CDGPlayer {
    const max = this.pc + count;
    while (this.pc >= 0 && this.pc < max) {
      this.step();
    }
    return this;
  }

  /**
   * Starts frame scheduling.
   */
  play(): CDGPlayer {
    if (this.frameId == null) {
      this.frameId = requestFrame({ callback: this.update });
      this.lastTimestamp = now();
    }
    return this;
  }

  /**
   * Stops frame scheduling.
   */
  stop(): CDGPlayer {
    cancelFrame({ id: this.frameId });
    this.frameId = null;
    this.lastSyncPos = null;
    return this;
  }

  /**
   * Synchronizes CD+G playback position to external audio timeline (milliseconds).
   */
  sync({ ms }: { ms: number }): CDGPlayer {
    this.lastSyncPos = ms;
    this.lastTimestamp = now();
    return this;
  }
}

export default CDGPlayer;

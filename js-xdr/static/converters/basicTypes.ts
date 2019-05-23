import { Int64, Uint64 } from "../utils/int64";
import { XdrBufferedConverter } from "./types";

const MIN_INT = -0x80000000;
const MAX_INT = 0x7fffffff;

export const Int: XdrBufferedConverter<number> = {
  toXdrBuffered: (value, writeStream) => {
    writeStream.writeNextInt32(value);
  },

  fromXdrBuffered: readStream => {
    return readStream.readNextInt32();
  },

  isValid: value => {
    return value >= MIN_INT && value <= MAX_INT && isFinite(value) && !isNaN(value);
  }
};

const MIN_UINT = 0x00000000;
const MAX_UINT = 0xffffffff;

export const Uint: XdrBufferedConverter<number> = {
  toXdrBuffered: (value, writeStream) => {
    writeStream.writeNextUint32(value);
  },

  fromXdrBuffered: readStream => {
    return readStream.readNextUint32();
  },

  isValid: value => {
    return value >= MIN_UINT && value <= MAX_UINT && isFinite(value) && !isNaN(value);
  }
};

export const Hyper: XdrBufferedConverter<Int64> = {
  toXdrBuffered: (value, writeStream) => {
    writeStream.writeNextInt32(value.high);
    writeStream.writeNextUint32(value.low);
  },

  fromXdrBuffered: readStream => {
    const high32bit = readStream.readNextInt32();
    const low32bit = readStream.readNextUint32();
    return new Int64(low32bit, high32bit);
  },

  isValid: _ => true
};

export const Uhyper: XdrBufferedConverter<Uint64> = {
  toXdrBuffered: (value, writeStream) => {
    writeStream.writeNextUint32(value.high);
    writeStream.writeNextUint32(value.low);
  },

  fromXdrBuffered: readStream => {
    const high32bit = readStream.readNextUint32();
    const low32bit = readStream.readNextUint32();
    return new Uint64(low32bit, high32bit);
  },

  isValid: _ => true
};

export const Boolean: XdrBufferedConverter<boolean> = {
  toXdrBuffered: (value, writeStream) => {
    Int.toXdrBuffered(value ? 1 : 0, writeStream);
  },

  fromXdrBuffered: readStream => {
    const parsedInt = Int.fromXdrBuffered(readStream);
    if (parsedInt === 0) {
      return false;
    }
    if (parsedInt === 1) {
      return true;
    }

    throw new Error(`Value ${parsedInt} is not a proper Boolean value.`);
  },

  isValid: _ => true
};

export const Void: XdrBufferedConverter<undefined> = {
  toXdrBuffered: () => {},
  fromXdrBuffered: () => undefined,
  isValid: _ => true
};

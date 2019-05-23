import { Int64, Uint64 } from "../utils/int64";
import { XdrBufferedConverter } from "./types";

export const Int: XdrBufferedConverter<number> = {
  toXdrBuffered: (value, writeStream) => {
    writeStream.writeNextInt32(value);
  },

  fromXdrBuffered: readStream => {
    return readStream.readNextInt32();
  }
};

export const Uint: XdrBufferedConverter<number> = {
  toXdrBuffered: (value, writeStream) => {
    writeStream.writeNextUint32(value);
  },

  fromXdrBuffered: readStream => {
    return readStream.readNextUint32();
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
  }
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
  }
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
  }
};

export const Void: XdrBufferedConverter<undefined> = {
  toXdrBuffered: () => {},
  fromXdrBuffered: () => undefined
};

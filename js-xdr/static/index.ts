import { createReadStream, createWriteStream } from "./streams";
import { XdrBufferedConverter, XdrConverter } from "./types";

export * from "./basicTypes";
export * from "./compoundTypes";
export * from "./types";
export * from "./int64";

export function generator<T>(factory: () => XdrBufferedConverter<T>): XdrConverter<T> {
  let memoizedFactoryResult: XdrBufferedConverter<T> | undefined;

  function memoizedFactory() {
    if (memoizedFactoryResult === undefined) {
      memoizedFactoryResult = factory();
    }

    return memoizedFactoryResult;
  }

  return {
    toXdr: value => {
      const writeStream = createWriteStream();
      memoizedFactory().toXdrBuffered(value, writeStream);
      return writeStream.getResultingArrayBuffer();
    },
    fromXdr: buffer => {
      const readStream = createReadStream(buffer);
      const value = memoizedFactory().fromXdrBuffered(readStream);
      if (!readStream.endReached()) {
        throw new Error(`The xdr content is shorter than the length of the xdr`);
      }

      return value;
    },
    toXdrBuffered: (value, writeStream) => memoizedFactory().toXdrBuffered(value, writeStream),
    fromXdrBuffered: readStream => memoizedFactory().fromXdrBuffered(readStream)
  };
}

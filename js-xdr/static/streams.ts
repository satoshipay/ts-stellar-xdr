export type WriteStream = ReturnType<typeof createWriteStream>;
export type ReadStream = ReturnType<typeof createReadStream>;

function extendToMultipleOf4(value: number) {
  return (value + 3) & ~3;
}

export function createReadStream(source: ArrayBuffer) {
  let readIndex = 0;
  let dataView = new DataView(source);

  function ensureSize(noOfBytesToRead: number) {
    if (noOfBytesToRead + readIndex > source.byteLength) {
      throw new Error(
        `Input xdr suddenly ends at position ${source.byteLength}; expected to read until positon ${noOfBytesToRead +
          readIndex}`
      );
    }
  }

  return {
    readNextUint32(): number {
      ensureSize(4);
      const result = dataView.getUint32(readIndex);
      readIndex += 4;
      return result;
    },

    readNextInt32(): number {
      ensureSize(4);
      const result = dataView.getInt32(readIndex);
      readIndex += 4;
      return result;
    },

    readNextBinaryData(noOfBytes: number): ArrayBuffer {
      ensureSize(extendToMultipleOf4(noOfBytes));
      const result = new ArrayBuffer(noOfBytes);
      const targetView = new Uint8Array(result);
      const sourceView = new Uint8Array(source, readIndex, noOfBytes);
      targetView.set(sourceView);
      readIndex += extendToMultipleOf4(noOfBytes);
      return result;
    },

    readNextString(noOfAsciiCharacters: number): string {
      ensureSize(extendToMultipleOf4(noOfAsciiCharacters));

      let result = "";
      for (let i = 0; i < noOfAsciiCharacters; i++) {
        const codePoint = dataView.getUint8(readIndex + i);

        if (codePoint === undefined || codePoint > 127) {
          throw new Error(`String has a non ASCII character: ${codePoint}`);
        }
        result += String.fromCodePoint(codePoint);
      }

      readIndex += extendToMultipleOf4(extendToMultipleOf4(noOfAsciiCharacters));
      return result;
    },

    rewind(noOfBytes: number) {
      readIndex -= noOfBytes;
    },

    endReached(): boolean {
      return readIndex === source.byteLength;
    }
  };
}

export function createWriteStream() {
  let currentCapacity = 128;
  let writeIndex = 0;
  let buffer = new ArrayBuffer(currentCapacity);
  let dataView = new DataView(buffer);

  function increaseCapacity() {
    currentCapacity *= 2;
    const newBuffer = new ArrayBuffer(currentCapacity);
    const newView = new Uint8Array(newBuffer);
    const oldView = new Uint8Array(buffer);
    newView.set(oldView);
    buffer = newBuffer;
    dataView = new DataView(buffer);
  }

  function ensureSize(noOfBytesToWrite: number) {
    if (noOfBytesToWrite + writeIndex > currentCapacity) {
      increaseCapacity();
    }
  }

  return {
    writeNextUint32(value: number) {
      ensureSize(4);
      dataView.setUint32(writeIndex, value);
      writeIndex += 4;
    },

    writeNextInt32(value: number) {
      ensureSize(4);
      dataView.setInt32(writeIndex, value);
      writeIndex += 4;
    },

    writeNextBinaryData(value: ArrayBuffer) {
      ensureSize(extendToMultipleOf4(value.byteLength));
      const targetView = new Uint8Array(buffer, writeIndex, value.byteLength);
      const sourceView = new Uint8Array(value);
      targetView.set(sourceView);
      writeIndex += extendToMultipleOf4(value.byteLength);
    },

    writeNextString(value: string) {
      ensureSize(extendToMultipleOf4(value.length));

      for (let i = 0; i < value.length; i++) {
        const codePoint = value.codePointAt(i);
        if (codePoint === undefined || codePoint > 127) {
          throw new Error(`String ${value} has a non ASCII character`);
        }
        dataView.setUint8(writeIndex + i, codePoint);
      }

      writeIndex += extendToMultipleOf4(value.length);
    },

    getResultingArrayBuffer(): ArrayBuffer {
      const result = new ArrayBuffer(writeIndex);
      const targetView = new Uint8Array(result);
      const sourceView = new Uint8Array(buffer, 0, writeIndex);
      targetView.set(sourceView);
      return result;
    }
  };
}

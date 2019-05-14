export type WriteStream = ReturnType<typeof createWriteStream>;
export type ReadStream = ReturnType<typeof createReadStream>;

// The RFC 4506 standard for XDR defines strings in Section 4.11.
// as sequences of ASCII bytes
// However, Stellar interprets them as UTF8 strings, i.e., it
// allows strings with characters having Unicode codes points >= 0x80
// outside the valid ASCII range
// If ALLOW_UTF8_STRINGS, then allow full UTF8 strings instead of just ASCII strings
const ALLOW_UTF8_STRINGS = true;

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

    readNextString(noOfBytes: number): string {
      ensureSize(extendToMultipleOf4(noOfBytes));

      let result = "";
      let i = 0;
      while (i < noOfBytes) {
        const codePoint = dataView.getUint8(readIndex + i++);

        if (ALLOW_UTF8_STRINGS) {
          if ((codePoint & 0x80) === 0) {
            result += String.fromCharCode(codePoint);
          } else if ((codePoint & 0xe0) === 0xc0) {
            if (i >= noOfBytes) {
              break;
            }

            const nextCodePoint = dataView.getUint8(readIndex + i++);
            const charCode = ((codePoint & 0x1f) << 6) | (nextCodePoint & 0x3f);
            result += String.fromCharCode(charCode);
          } else if ((codePoint & 0xf0) === 0xe0) {
            if (i + 1 >= noOfBytes) {
              break;
            }

            const nextCodePoint1 = dataView.getUint8(readIndex + i++);
            const nextCodePoint2 = dataView.getUint8(readIndex + i++);
            const charCode = ((codePoint & 0x0f) << 12) | ((nextCodePoint1 & 0x3f) << 6) | (nextCodePoint2 & 0x3f);
            result += String.fromCharCode(charCode);
          } else {
            if (i + 2 >= noOfBytes) {
              break;
            }

            const nextCodePoint1 = dataView.getUint8(readIndex + i++);
            const nextCodePoint2 = dataView.getUint8(readIndex + i++);
            const nextCodePoint3 = dataView.getUint8(readIndex + i++);
            let charCode =
              ((codePoint & 0x07) << 18) |
              ((nextCodePoint1 & 0x3f) << 12) |
              ((nextCodePoint2 & 0x3f) << 6) |
              (nextCodePoint3 & 0x3f);

            charCode -= 0x10000;
            result += String.fromCharCode((charCode >> 10) + 0xd800, (charCode & 0x3ff) + 0xdc00);
          }
        } else {
          if (codePoint > 127) {
            throw new Error(`String has a non ASCII character: ${codePoint}`);
          }
          result += String.fromCharCode(codePoint);
        }
      }

      readIndex += extendToMultipleOf4(extendToMultipleOf4(noOfBytes));
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

    writeNextStringAndLength(value: string, maxNoOfBytes: number) {
      const length = value.length;

      writeIndex += 4;
      let targetByteLength = 0;
      let sourceIndex = 0;
      while (sourceIndex < length) {
        let charCode = value.charCodeAt(sourceIndex++);

        if (ALLOW_UTF8_STRINGS) {
          if (charCode < 0x80) {
            ensureSize(targetByteLength + 1);
            dataView.setUint8(writeIndex + targetByteLength++, charCode);
          } else if (charCode < 0x800) {
            ensureSize(targetByteLength + 2);
            dataView.setUint8(writeIndex + targetByteLength++, (charCode >> 6) | 0xc0);
            dataView.setUint8(writeIndex + targetByteLength++, (charCode & 0x3f) | 0x80);
          } else if (sourceIndex >= length || charCode < 0xd800 || charCode >= 0xe000) {
            ensureSize(targetByteLength + 3);
            dataView.setUint8(writeIndex + targetByteLength++, (charCode >> 12) | 0xe0);
            dataView.setUint8(writeIndex + targetByteLength++, ((charCode >> 6) & 0x3f) | 0x80);
            dataView.setUint8(writeIndex + targetByteLength++, (charCode & 0x3f) | 0x80);
          } else {
            charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (value.charCodeAt(sourceIndex++) & 0x3ff));
            ensureSize(targetByteLength + 4);
            dataView.setUint8(writeIndex + targetByteLength++, (charCode >> 18) | 0xf0);
            dataView.setUint8(writeIndex + targetByteLength++, ((charCode >> 12) & 0x3f) | 0x80);
            dataView.setUint8(writeIndex + targetByteLength++, ((charCode >> 6) & 0x3f) | 0x80);
            dataView.setUint8(writeIndex + targetByteLength++, (charCode & 0x3f) | 0x80);
          }
        } else {
          if (charCode > 127) {
            throw new Error(`String ${value} has a non ASCII character`);
          }
          ensureSize(targetByteLength + 1);
          dataView.setUint8(writeIndex + targetByteLength++, charCode);
        }
      }

      if (targetByteLength > maxNoOfBytes) {
        throw new Error(
          `Value too large for string: number of bytes = ${targetByteLength}; maximal number of bytes = ${maxNoOfBytes}`
        );
      }

      writeIndex -= 4;
      ensureSize(4);
      dataView.setUint32(writeIndex, targetByteLength);

      writeIndex += 4;
      ensureSize(extendToMultipleOf4(targetByteLength));
      writeIndex += extendToMultipleOf4(targetByteLength);
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

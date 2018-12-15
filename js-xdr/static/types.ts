import { WriteStream, ReadStream } from './streams';

export interface XdrBufferedConverter<T> {
  toXdrBuffered: (value: T, writeStream: WriteStream) => void;
  fromXdrBuffered: (readStream: ReadStream) => T;
}

export interface XdrConverter<T> extends XdrBufferedConverter<T> {
  toXdr: (value: T) => ArrayBuffer;
  fromXdr: (buffer: ArrayBuffer) => T;
}

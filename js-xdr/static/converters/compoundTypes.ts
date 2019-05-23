import { XdrBufferedConverter } from "./types";
import { Int } from "./basicTypes";
import { isValidString } from "./streams";

const TWO_TO_32 = 0x100000000;

export function Enum<T extends string>(name: string, enumDefinition: Record<T, number>) {
  const enumKeys = Object.keys(enumDefinition) as T[];
  const inverseEnumDefinition = enumKeys.reduce<Partial<Record<number, T>>>(
    (obj, key) => ({ ...obj, [enumDefinition[key]]: key }),
    {}
  );

  const converter: XdrBufferedConverter<T> = {
    toXdrBuffered: (value, writeStream) => {
      Int.toXdrBuffered(enumDefinition[value], writeStream);
    },

    fromXdrBuffered: readStream => {
      const enumValue = Int.fromXdrBuffered(readStream);
      const result = inverseEnumDefinition[enumValue];
      if (result !== undefined) {
        return result;
      }

      throw new Error(`Invalid value ${enumValue} when parsing enum ${name}`);
    },

    isValid: value => enumDefinition.hasOwnProperty(value)
  };

  return converter;
}

export function Struct<T>(structDefinition: Array<{ [R in keyof T]: [R, XdrBufferedConverter<T[R]>] }[keyof T]>) {
  const converter: XdrBufferedConverter<T> = {
    toXdrBuffered: (value, writeStream) => {
      structDefinition.forEach(entry => {
        const [key, converter] = entry;
        converter.toXdrBuffered(value[key], writeStream);
      });
    },

    fromXdrBuffered: readStream => {
      return structDefinition.reduce<Partial<T>>((obj, entry) => {
        const [key, converter] = entry;
        obj[key] = converter.fromXdrBuffered(readStream);
        return obj;
      }, {}) as T;
    },

    isValid: value => {
      return structDefinition.every(entry => {
        const [key, converter] = entry;
        return converter.isValid(value[key]);
      });
    }
  };

  return converter;
}

type A<T> = T extends { default: undefined } ? { default: number } : never;
type AA<T> = T extends { default: XdrBufferedConverter<infer A> } ? { default: number; value: A } : never;

type C<T, U> = { [P in U & keyof T]: T[P] extends undefined ? { type: P } : never }[U & keyof T];

type CC<T, U> = { [P in U & keyof T]: T[P] extends XdrBufferedConverter<infer A> ? { type: P; value: A } : never }[U &
  keyof T];

export function Union<
  U extends number | string,
  T extends Record<string | number, undefined | XdrBufferedConverter<any>>,
  V extends undefined | { default: undefined | XdrBufferedConverter<any> }
>(name: string, switchOn: XdrBufferedConverter<U>, structDefinition: T, defaultConverter: V) {
  const converter: XdrBufferedConverter<A<V> | AA<V> | C<T, U> | CC<T, U>> = {
    toXdrBuffered: (value, writeStream) => {
      if (defaultConverter !== undefined && "default" in value) {
        Int.toXdrBuffered(value.default, writeStream);
        if (defaultConverter.default !== undefined) {
          if ("value" in value) {
            defaultConverter.default.toXdrBuffered(value.value, writeStream);
          } else {
            throw new Error(`Value ${value} is a default without a value, but defaults need a value in enum "${name}"`);
          }
        }
      } else if ("default" in value) {
        throw new Error(`Value ${value} is a default value, but default values not allowed for union "${name}"`);
      } else {
        switchOn.toXdrBuffered(value.type, writeStream);
        const valueConverter = structDefinition[value.type];
        if (valueConverter !== undefined) {
          if ("value" in value) {
            valueConverter.toXdrBuffered(value.value, writeStream);
          } else {
            throw new Error(`Value ${value} has no "value" entry, but needs one in enum "${name}"`);
          }
        }
      }
    },

    fromXdrBuffered: readStream => {
      const defaultNumber = Int.fromXdrBuffered(readStream);

      let switchValue: U | undefined;
      try {
        readStream.rewind(4);
        switchValue = switchOn.fromXdrBuffered(readStream);
      } catch (ex) {}

      if (switchValue !== undefined) {
        if (switchValue in structDefinition) {
          const valueConverter = structDefinition[switchValue];
          if (valueConverter !== undefined) {
            return { type: switchValue, value: valueConverter.fromXdrBuffered(readStream) } as any;
          } else {
            return { type: switchValue } as any;
          }
        }
      }

      // construct a default value
      if (defaultConverter !== undefined) {
        if (defaultConverter.default !== undefined) {
          return { default: defaultNumber, value: defaultConverter.default.fromXdrBuffered(readStream) } as any;
        } else {
          return { default: defaultNumber } as any;
        }
      } else {
        throw new Error(`Discriminator is ${defaultNumber}, but no default values allowed in union "${name}"`);
      }
    },

    isValid: value => {
      if (defaultConverter !== undefined && "default" in value) {
        if (!Int.isValid(value.default)) {
          return false;
        }
        if (defaultConverter.default !== undefined) {
          if ("value" in value) {
            return defaultConverter.default.isValid(value.value);
          } else {
            return false;
          }
        }
      } else if ("default" in value) {
        return false;
      } else {
        if (!switchOn.isValid(value.type)) {
          return false;
        }
        const valueConverter = structDefinition[value.type];
        if (valueConverter !== undefined) {
          if ("value" in value) {
            return valueConverter.isValid(value.value);
          } else {
            return false;
          }
        }
      }
    }
  };

  return converter;
}

export function Option<T>(subConverter: XdrBufferedConverter<T>) {
  const converter: XdrBufferedConverter<T | undefined> = {
    toXdrBuffered: (value, writeStream) => {
      if (value === undefined) {
        writeStream.writeNextUint32(0);
      } else {
        writeStream.writeNextUint32(1);
        subConverter.toXdrBuffered(value, writeStream);
      }
    },

    fromXdrBuffered: readStream => {
      const containsValue = readStream.readNextUint32();
      if (containsValue === 0) {
        return undefined;
      }
      return subConverter.fromXdrBuffered(readStream);
    },

    isValid: value => value === undefined || subConverter.isValid(value)
  };

  return converter;
}

export function FixedArray<T>(subConverter: XdrBufferedConverter<T>, length: number) {
  const converter: XdrBufferedConverter<Array<T>> = {
    toXdrBuffered: (value, writeStream) => {
      if (value.length !== length) {
        throw new Error(
          `Value has wrong length for fixed array: length = ${value.length}; expected length = ${length}`
        );
      }
      value.forEach(entry => subConverter.toXdrBuffered(entry, writeStream));
    },

    fromXdrBuffered: readStream => {
      const result = [];
      for (let i = 0; i < length; i++) {
        result.push(subConverter.fromXdrBuffered(readStream));
      }

      return result;
    },

    isValid: value => {
      if (value.length !== length) {
        return false;
      }
      return value.every(entry => subConverter.isValid(entry));
    }
  };

  return converter;
}

export function VarArray<T>(subConverter: XdrBufferedConverter<T>, maxLength: number = TWO_TO_32 - 1) {
  const converter: XdrBufferedConverter<Array<T>> = {
    toXdrBuffered: (value, writeStream) => {
      if (value.length > maxLength) {
        throw new Error(`Value too large for var array: length = ${value.length}; maximal length = ${maxLength}`);
      }
      writeStream.writeNextUint32(value.length);
      value.forEach(entry => subConverter.toXdrBuffered(entry, writeStream));
    },

    fromXdrBuffered: readStream => {
      const length = readStream.readNextUint32();
      if (length > maxLength) {
        throw new Error(`Buffer too large for var opaque: length = ${length}; maximal length = ${maxLength}`);
      }

      const result = [];
      for (let i = 0; i < length; i++) {
        result.push(subConverter.fromXdrBuffered(readStream));
      }

      return result;
    },

    isValid: value => {
      if (value.length > maxLength) {
        return false;
      }
      return value.every(entry => subConverter.isValid(entry));
    }
  };

  return converter;
}

export function string(maxLength: number = TWO_TO_32 - 1) {
  const converter: XdrBufferedConverter<string> = {
    toXdrBuffered: (value, writeStream) => {
      writeStream.writeNextStringAndLength(value, maxLength);
    },

    fromXdrBuffered: readStream => {
      const length = readStream.readNextUint32();
      if (length > maxLength) {
        throw new Error(`Buffer too large for string: length = ${length}; maximal length = ${maxLength}`);
      }

      return readStream.readNextString(length);
    },

    isValid: value => isValidString(value, maxLength)
  };

  return converter;
}

export function FixedOpaque(length: number) {
  const converter: XdrBufferedConverter<ArrayBuffer> = {
    toXdrBuffered: (value, writeStream) => {
      if (value.byteLength !== length) {
        throw new Error(
          `Value has wrong length for fixed opaque: length = ${value.byteLength}; expected length = ${length}`
        );
      }
      writeStream.writeNextBinaryData(value);
    },

    fromXdrBuffered: readStream => {
      return readStream.readNextBinaryData(length);
    },

    isValid: value => value.byteLength === length
  };

  return converter;
}

export function VarOpaque(maxLength: number = TWO_TO_32 - 1) {
  const converter: XdrBufferedConverter<ArrayBuffer> = {
    toXdrBuffered: (value, writeStream) => {
      if (value.byteLength > maxLength) {
        throw new Error(`Value too large for var opaque: length = ${value.byteLength}; maximal length = ${maxLength}`);
      }
      writeStream.writeNextUint32(value.byteLength);
      writeStream.writeNextBinaryData(value);
    },

    fromXdrBuffered: readStream => {
      const length = readStream.readNextUint32();
      if (length > maxLength) {
        throw new Error(`Buffer too large for var opaque: length = ${length}; maximal length = ${maxLength}`);
      }

      return readStream.readNextBinaryData(length);
    },

    isValid: value => value.byteLength <= maxLength
  };

  return converter;
}

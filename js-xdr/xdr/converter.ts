export interface XdrConverter<T> {
  toXdr: (value: T) => ArrayBuffer,
  fromXdr: (buffer: ArrayBuffer) => T
}

export class Int64 {
  content: Int8Array

  constructor(_n: number) {
    this.content = new Int8Array(8);

  }
}

export class Uint64 {
  content: Uint8Array

  constructor(_n: number) {
    this.content = new Uint8Array(8);

  }
}

export function Enum<T extends string>(name: string, enumDefinition: Record<T, number>) {
  const converter: XdrConverter<T> = {
    toXdr: (value: T) => {
      return Int.toXdr(enumDefinition[value]);
    },
    fromXdr: (buffer: ArrayBuffer) => {
      const parsedBuffer = Int.fromXdr(buffer);

      let foundKey: T | undefined;
      const enumKeys = Object.keys(enumDefinition) as T[];
      enumKeys.some(key => {
        if (enumDefinition[key] === parsedBuffer) {
          foundKey = key;
          return true;
        }
        return false;
      })

      if (!foundKey) {
        throw new Error(`Invalid value ${parsedBuffer} when parsing enum ${name}`);
      }

      return foundKey;
    }
  }

  return converter;
}

export function Struct<T>(_name: string, _structDefinition: Record<string, XdrConverter<any>>) {
  const converter: XdrConverter<T> = {
    toXdr: (_value: T) => {
      return new ArrayBuffer(0);
    },
    fromXdr: (_buffer: ArrayBuffer) => {
      return 0 as any as T;
    }
  }

  return converter;
}

export function Union<T, S>(_name: string, switchOn: XdrConverter<S>, _structDefinition: Array<{type?: string | number, default?: true, converter?: XdrConverter<any>}>) {
  const converter: XdrConverter<T> = {
    toXdr: (_value: T) => {
      return new ArrayBuffer(0);
    },
    fromXdr: (_buffer: ArrayBuffer) => {
      return 0 as any as T;
    }
  }

  return converter;
}

export function Option<T>(subConverter: XdrConverter<T>) {
  const converter: XdrConverter<T | undefined> = {
    toXdr: (_value: T | undefined) => {
      return new ArrayBuffer(0);
    },
    fromXdr: (_buffer: ArrayBuffer) => {
      return 0 as any as T | undefined;
    }
  }

  return converter;
}

export function FixedArray<T>(subConverter: XdrConverter<T>, length: number) {
  const converter: XdrConverter<Array<T>> = {
    toXdr: (_value: Array<T>) => {
      return new ArrayBuffer(0);
    },
    fromXdr: (_buffer: ArrayBuffer) => {
      return 0 as any as Array<T>;
    }
  }

  return converter;
}

export function VarArray<T>(subConverter: XdrConverter<T>, maxLength?: number) {
  const converter: XdrConverter<Array<T>> = {
    toXdr: (_value: Array<T>) => {
      return new ArrayBuffer(0);
    },
    fromXdr: (_buffer: ArrayBuffer) => {
      return 0 as any as Array<T>;
    }
  }

  return converter;
}

export function String(maxLength?: number) {
  const converter: XdrConverter<string> = {
    toXdr: (_value: string) => {
      return new ArrayBuffer(0);
    },
    fromXdr: (_buffer: ArrayBuffer) => {
      return 0 as any as string;
    }
  }

  return converter;
}

export function FixedOpaque(length: number) {
  const converter: XdrConverter<ArrayBuffer> = {
    toXdr: (_value: ArrayBuffer) => {
      return new ArrayBuffer(0);
    },
    fromXdr: (_buffer: ArrayBuffer) => {
      return 0 as any as ArrayBuffer;
    }
  }

  return converter;
}

export function VarOpaque(maxLength?: number) {
  const converter: XdrConverter<ArrayBuffer> = {
    toXdr: (_value: ArrayBuffer) => {
      return new ArrayBuffer(0);
    },
    fromXdr: (_buffer: ArrayBuffer) => {
      return 0 as any as ArrayBuffer;
    }
  }

  return converter;
}

export const Int: XdrConverter<number> = {
  toXdr: (_value) => new ArrayBuffer(0),
  fromXdr: (_buffer) => 0 as any
};

export const Uint: XdrConverter<number> = {
  toXdr: (_value) => new ArrayBuffer(0),
  fromXdr: (_buffer) => 0 as any
};

export const Hyper: XdrConverter<Int64> = {
  toXdr: (_value) => new ArrayBuffer(0),
  fromXdr: (_buffer) => 0 as any
};

export const Uhyper: XdrConverter<Uint64> = {
  toXdr: (_value) => new ArrayBuffer(0),
  fromXdr: (_buffer) => 0 as any
};

export const Boolean: XdrConverter<number> = {
  toXdr: (_value) => new ArrayBuffer(0),
  fromXdr: (_buffer) => 0 as any
};

export const Void: XdrConverter<null> = {
  toXdr: (_value) => new ArrayBuffer(0),
  fromXdr: (_buffer) => 0 as any
}

export function generator<T>(factory: () => XdrConverter<T>): XdrConverter<T> {
  let memoizedFactoryResult: XdrConverter<T> | undefined;

  function memoizedFactory() {
    if (memoizedFactoryResult === undefined) {
      memoizedFactoryResult = factory();
    }

    return memoizedFactoryResult;
  }

  return {
    toXdr: value => memoizedFactory().toXdr(value),
    fromXdr: buffer => memoizedFactory().fromXdr(buffer)
  }
}
const TWO_TO_32 = 0x100000000;

const MIN_UINT32 = 0x00000000;
const MAX_UINT32 = 0xffffffff;
const MIN_INT32 = -0x80000000;
const MAX_INT32 = 0x7fffffff;

function isProperNumber(n: number) {
  return n >= Number.MIN_SAFE_INTEGER && n <= Number.MAX_SAFE_INTEGER && isFinite(n) && !isNaN(n);
}

function isProperNonnegativeNumber(n: number) {
  return n >= 0 && n <= Number.MAX_SAFE_INTEGER && isFinite(n) && !isNaN(n);
}

class BaseInteger64 {
  // for unsigned = false
  //   low32Bit must be integer >= 0 and < 2**32
  //   high32Bit must be integer >= - 2**31 and < 2**31
  //   the actual value of the number is high32Bit * (2 ** 32) + low32Bit,
  //     i.e. >= - 2 ** 63 and < 2 ** 63
  // for unsigned = true
  //   low32Bit must be integer >= 0 and < 2**32
  //   high32Bit must be integer >= 0 and < 2**32
  //   the actual value of the number is high32Bit * (2 ** 32) + low32Bit
  //     i.e. >= 0 and < 2 ** 64
  constructor(public low32Bits: number, public high32Bits: number, public unsigned: boolean) {
    if (low32Bits >>> 0 !== low32Bits) {
      throw new Error(`Low 32 bits (${low32Bits}) is not an integer in the range ${MIN_UINT32} ... ${MAX_UINT32}`);
    }

    if (unsigned) {
      if (high32Bits >>> 0 !== high32Bits) {
        throw new Error(`High 32 bits (${high32Bits}) is not an integer in the range ${MIN_UINT32} ... ${MAX_UINT32}`);
      }
    } else {
      if (high32Bits >> 0 !== high32Bits) {
        throw new Error(`High 32 bits (${high32Bits}) is not an integer in the range ${MIN_INT32} ... ${MAX_INT32}`);
      }
    }
  }

  isPositive() {
    return this.high32Bits > 0 || (this.high32Bits >= 0 && this.low32Bits > 0);
  }

  isNonNegative() {
    return this.high32Bits >= 0;
  }

  private protoNegate(): [number, number] {
    if (this.low32Bits === MIN_UINT32) {
      return [MIN_UINT32, -this.high32Bits];
    } else {
      return [MAX_UINT32 + 1 - this.low32Bits, -1 - this.high32Bits];
    }
  }

  negate() {
    const [low32Bits, high32Bits] = this.protoNegate();
    return new Signed(low32Bits, high32Bits);
  }

  abs() {
    let low32Bits = this.low32Bits;
    let high32Bits = this.high32Bits;

    if (this.high32Bits < 0) {
      [low32Bits, high32Bits] = this.protoNegate();
    }

    return new Unsigned(low32Bits, high32Bits);
  }

  toNumber() {
    // is this number larger than or equal to 2**21 * 2**32 = 2**53 (i.e, larger than Number.MAX_SAFE_INTEGER)?
    if (this.high32Bits >= 0x200000) {
      throw new Error("Number to large to represent as safe integer");
    }

    // is this number smaller than or equal to -(2**21) * 2**32 = -(2**53) (i.e, smaller than Number.MIN_SAFE_INTEGER)?
    if (this.high32Bits < -0x200000 || (this.high32Bits === -0x200000 && this.low32Bits === 0)) {
      throw new Error("Number to small to represent as safe integer");
    }

    return this.high32Bits * TWO_TO_32 + this.low32Bits;
  }

  equals(other: BaseInteger64) {
    return this.high32Bits === other.high32Bits && this.low32Bits === other.low32Bits;
  }

  protected protoAdd(n: number): [number, number] {
    if (!isProperNumber(n)) {
      throw new Error("value must be between ${Number.MIN_SAFE_INTEGER} and ${Number.MAX_SAFE_INTEGER}");
    }

    const low32Bits = this.low32Bits + n;
    const carry = Math.floor(low32Bits / TWO_TO_32);
    return [low32Bits >>> 0, this.high32Bits + carry];
  }

  protected protoSub(n: number): [number, number] {
    if (!isProperNumber(n)) {
      throw new Error("value must be between ${Number.MIN_SAFE_INTEGER} and ${Number.MAX_SAFE_INTEGER}");
    }
    return this.protoAdd(-n);
  }
}

export class Signed extends BaseInteger64 {
  static minValue = new Signed(MIN_UINT32, MIN_INT32);
  static maxValue = new Signed(MAX_UINT32, MAX_INT32);

  constructor(low32Bits: number, high32Bits: number) {
    super(low32Bits, high32Bits, false);
  }

  static fromNumber(n: number) {
    if (!isProperNumber(n)) {
      throw new Error("value must be between ${Number.MIN_SAFE_INTEGER} and ${Number.MAX_SAFE_INTEGER}");
    }

    return new this(n >>> 0, Math.floor(n / TWO_TO_32));
  }

  static fromString(numberString: string) {
    const { negate, base4M } = parseNumberString(numberString);
    if (negate) {
      return new Unsigned(base4M[1], base4M[0]).negate();
    }
    return new this(base4M[1], base4M[0]);
  }

  toString() {
    return `${this.high32Bits >= 0 ? "" : "-"}${this.abs().toString()}`;
  }

  add(n: number) {
    const [low32Bits, high32Bits] = super.protoAdd(n);
    return new Signed(low32Bits, high32Bits);
  }

  sub(n: number) {
    const [low32Bits, high32Bits] = super.protoSub(n);
    return new Signed(low32Bits, high32Bits);
  }
}

export class Unsigned extends BaseInteger64 {
  static minValue = new Unsigned(MIN_UINT32, MIN_UINT32);
  static maxValue = new Unsigned(MAX_UINT32, MAX_UINT32);

  constructor(low32Bits: number, high32Bits: number) {
    super(low32Bits, high32Bits, true);
  }

  static fromNumber(n: number) {
    if (!isProperNonnegativeNumber(n)) {
      throw new Error("value must be between ${0} and ${Number.MAX_SAFE_INTEGER}");
    }
    return new this(n >>> 0, Math.floor(n / TWO_TO_32));
  }

  static fromString(numberString: string) {
    const { negate, base4M } = parseNumberString(numberString);
    if (negate) {
      throw new Error("Negative numbers not allowed");
    }
    return new this(base4M[1], base4M[0]);
  }

  toString() {
    const digits = convertBases(
      [this.high32Bits >>> 16, this.high32Bits & 0xffff, this.low32Bits >>> 16, this.low32Bits & 0xffff],
      0x10000,
      10
    );

    const length = digits.length;
    const noOfTriplets = Math.ceil(length / 3);
    const triplets = new Array(noOfTriplets);

    for (let index = 0; index < noOfTriplets; index++) {
      const digit1 = length - index * 3 - 3 >= 0 ? alphabet[digits[length - index * 3 - 3]] : "";
      const digit2 = length - index * 3 - 2 >= 0 ? alphabet[digits[length - index * 3 - 2]] : "";
      const digit3 = length - index * 3 - 1 >= 0 ? alphabet[digits[length - index * 3 - 1]] : "";

      triplets[noOfTriplets - index - 1] = digit1 + digit2 + digit3;
    }

    return triplets.join(",");
  }

  add(n: number) {
    const [low32Bits, high32Bits] = super.protoAdd(n);
    return new Unsigned(low32Bits, high32Bits);
  }

  sub(n: number) {
    const [low32Bits, high32Bits] = super.protoSub(n);
    return new Unsigned(low32Bits, high32Bits);
  }
}

function base256ToBase4M(base256: number[]) {
  const length = base256.length;
  const translated: number[] = [];

  if (base256.length > 8) {
    throw new Error("Number too large");
  }

  for (let i = 7; i >= 0; i--) {
    translated.push(length >= i + 1 ? base256[length - i - 1] : 0);
  }

  return [
    (translated[3] | (translated[2] << 8) | (translated[1] << 16) | (translated[0] << 24)) >>> 0,
    (translated[7] | (translated[6] << 8) | (translated[5] << 16) | (translated[4] << 24)) >>> 0
  ];
}

const alphabet = "0123456789abcdef".split("");
const reverseAlphabet: Record<string, number> = {};
alphabet.forEach((symbol, index) => (reverseAlphabet[symbol] = index));

function parseNumberString(numberString: string) {
  numberString = numberString.toLowerCase().replace(/,/g, "");

  const match = /^\s*([-+]?)\s*(0x|0b|0o)?([0-9a-f][0-9a-f,]*)\s*$/.exec(numberString);
  if (match === null) {
    throw new Error("Invalid number literal");
  }

  let base: number;
  switch (match[2]) {
    case "0x":
      base = 16;
      break;
    case "0b":
      base = 2;
      break;
    case "0o":
      base = 8;
      break;
    default:
      base = 10;
  }

  const digits = match[3].split("").map(symbol => {
    const digitValue = reverseAlphabet[symbol];
    if (digitValue >= base) {
      throw new Error(`symbol ${symbol} not allowed for number in base ${base}`);
    }
    return digitValue;
  });

  const base256 = convertBases(digits, base, 256);

  return {
    negate: match[1] === "-",
    base4M: base256ToBase4M(base256)
  };
}

function convertBases(digits: number[], baseIn: number, baseOut: number) {
  const resultArray = [0];
  const length = digits.length;

  for (let digitsIndex = 0; digitsIndex < length; digitsIndex++) {
    for (let resultIndex = resultArray.length - 1; resultIndex >= 0; resultIndex--) {
      resultArray[resultIndex] *= baseIn;
    }

    resultArray[0] += digits[digitsIndex];

    for (let resultIndex = 0; resultIndex < resultArray.length; resultIndex++) {
      if (resultArray[resultIndex] > baseOut - 1) {
        if (resultIndex + 1 >= resultArray.length) {
          resultArray.push(0);
        }

        resultArray[resultIndex + 1] += (resultArray[resultIndex] / baseOut) | 0;
        resultArray[resultIndex] %= baseOut;
      }
    }
  }

  return resultArray.reverse();
}

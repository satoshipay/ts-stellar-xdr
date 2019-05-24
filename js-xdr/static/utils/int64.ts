const TWO_TO_32 = 0x100000000;

export class Integer64 {
  public low: number;
  public high: number;

  // low must be integer >= 0 and < 2**32
  // high must be integer >= - 2**31 and < 2**31
  // the actual value of the number is high * (2 ** 32) + low,
  //  i.e. >= - 2 ** 63 and < 2 ** 63
  constructor(low: number, high: number) {
    this.low = low >>> 0;
    this.high = high >> 0;
  }

  static fromNumber(n: number) {
    if (n < Number.MIN_SAFE_INTEGER || n > Number.MAX_SAFE_INTEGER || !isFinite(n) || isNaN(n)) {
      throw new Error("value must be between ${Number.MIN_SAFE_INTEGER} and ${Number.MAX_SAFE_INTEGER}");
    }

    return new this(n >>> 0, Math.floor(n / TWO_TO_32));
  }

  static fromString(numberString: string) {
    const { negate, base256 } = parseNumberString(numberString);
    const base4M = base256ToBase4M(base256);
    if (negate) {
      return new UnsignedInteger64(base4M[1], base4M[0]).negate();
    }

    if (base4M[0] > 0x7fffffff) {
      throw new Error("Number too large");
    }

    return new this(base4M[1], base4M[0]);
  }

  static minValue = new Integer64(0x00000000, -0x80000000);
  static maxValue = new Integer64(0xffffffff, 0x7fffffff);

  isPositive() {
    return this.high > 0 || (this.high >= 0 && this.low > 0);
  }

  isNonNegative() {
    return this.high >= 0;
  }

  negate() {
    if (this.high === -0x80000000 && this.low === 0x00000000) {
      throw new Error(`Negation would overflow number`);
    }

    const [low, high] = negate(this.low, this.high);
    return new Integer64(low, high);
  }

  abs() {
    let low = this.low;
    let high = this.high;

    if (high < 0) {
      [low, high] = negate(this.low, this.high);
    }

    return new UnsignedInteger64(low, high);
  }

  toString() {
    return `${this.high >= 0 ? "" : "-"}${this.abs().toString()}`;
  }
}

export class UnsignedInteger64 {
  public low: number;
  public high: number;

  // low must be integer >= 0 and < 2**32
  // high must be integer >= 0 and < 2**32
  // the actual value of the number is high * (2 ** 32) + low
  //  i.e. >= 0 and < 2 ** 64
  constructor(low: number, high: number) {
    this.low = low >>> 0;
    this.high = high >>> 0;
  }

  static fromNumber(n: number) {
    if (n < 0 || n > Number.MAX_SAFE_INTEGER || !isFinite(n) || isNaN(n)) {
      throw new Error("value must be between ${0} and ${Number.MAX_SAFE_INTEGER}");
    }
    return new this(n >>> 0, Math.floor(n / TWO_TO_32));
  }

  static fromString(numberString: string) {
    const { negate, base256 } = parseNumberString(numberString);
    if (negate) {
      throw new Error("Negative numbers not allowed");
    }
    const base4M = base256ToBase4M(base256);
    return new this(base4M[1], base4M[0]);
  }

  static minValue = new UnsignedInteger64(0x00000000, 0x00000000);
  static maxValue = new UnsignedInteger64(0xffffffff, 0xffffffff);

  isPositive() {
    return this.high > 0 || this.low > 0;
  }

  negate() {
    if (this.high > 0x80000000 || (this.high >= 0x80000000 && this.low > 0)) {
      throw new Error(`Negation would underflow number`);
    }

    const [low, high] = negate(this.low, this.high);
    return new Integer64(low, high);
  }

  toString() {
    const digits = toBaseOut([this.high >>> 16, this.high & 0xffff, this.low >>> 16, this.low & 0xffff], 0x10000, 10);

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
}

function negate(low: number, high: number): [number, number] {
  let newLow = (~low >>> 0) + 1;
  let newHigh = ~high >> 0;

  if (newLow >= 0x100000000) {
    newLow = newLow >>> 0;
    newHigh++;
  }

  return [newLow, newHigh];
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

  return {
    negate: match[1] === "-",
    base256: toBaseOut(digits, base, 256)
  };
}

function toBaseOut(digits: number[], baseIn: number, baseOut: number) {
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

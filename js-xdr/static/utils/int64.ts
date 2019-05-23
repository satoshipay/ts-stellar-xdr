const TWO_TO_32 = 0x100000000;

export class Int64 {
  // low must be integer >= 0 and < 2**32
  // high must be integer >= - 2**31 and < 2**31
  // the actual value of the number is high * (2 ** 32) + low,
  //  i.e. >= - 2 ** 63 and < 2 ** 63
  constructor(public low: number, public high: number) {
    this.low = low >>> 0;
    this.high = high >> 0;
  }

  static fromNumber(n: number) {
    if (n < Number.MIN_SAFE_INTEGER || n > Number.MAX_SAFE_INTEGER || !isFinite(n) || isNaN(n)) {
      throw new Error("value must be between ${Number.MIN_SAFE_INTEGER} and ${Number.MAX_SAFE_INTEGER}");
    }

    return new this(n, Math.floor(n / TWO_TO_32));
  }

  static minValue = new Int64(0x00000000, -0x80000000);
  static maxValue = new Int64(0xffffffff, 0x7fffffff);

  isPositive() {
    return this.high > 0 || (this.high >= 0 && this.low > 0);
  }

  isNonNegative() {
    return this.high >= 0;
  }
}

export class Uint64 {
  // low must be integer >= 0 and < 2**32
  // high must be integer >= 0 and < 2**32
  // the actual value of the number is high * (2 ** 32) + low
  //  i.e. >= 0 and < 2 ** 64
  constructor(public low: number, public high: number) {
    this.low = low >>> 0;
    this.high = high >>> 0;
  }

  static fromNumber(n: number) {
    if (n < 0 || n > Number.MAX_SAFE_INTEGER || !isFinite(n) || isNaN(n)) {
      throw new Error("value must be between ${0} and ${Number.MAX_SAFE_INTEGER}");
    }
    return new this(n, Math.floor(n / TWO_TO_32));
  }

  static minValue = new Uint64(0x00000000, 0x00000000);
  static maxValue = new Uint64(0xffffffff, 0xffffffff);

  isPositive() {
    return this.high > 0 || this.low > 0;
  }
}

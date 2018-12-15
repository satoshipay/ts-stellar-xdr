const TWO_TO_32 = 0x100000000;

// this requires some more work; pretty sure that Int64 will not work if high is considered to be a 32 bit negative number (i.e., MSB is 1)
export class Int64 {
  constructor(public low: number, public high: number) {
    this.low = (low >>> 1) * 2 + (low & 1); // avoid that javascript makes a negative number out of a 32 bit number whose most significant bit is 1
    this.high = high | 0;
  }

  static fromNumber(n: number) {
    return new this(n, n / TWO_TO_32);
  }
}

export class Uint64 {
  constructor(public low: number, public high: number) {
    this.low = (low >>> 1) * 2 + (low & 1); // avoid that javascript makes a negative number out of a 32 bit number whose most significant bit is 1
    this.high = high | 0;
  }

  static fromNumber(n: number) {
    if (n < 0) {
      throw new Error("Uint64 class constructor does not allow negative numbers");
    }
    return new this(n, n / TWO_TO_32);
  }
}
# Typescript Stellar XDR Decoder/Encoder

This library is a decoder and encoder of all xdr types used in Stellar. It transforms JavaScript objects into XDR and vice versa.

## Usage

```javascript
const { TransactionEnvelope } = require("ts-stellar-xdr");

const transactionEnvelope =
  "AAAAAJM++/BQ/J83ai5alxXDK/s5oNhYQPtYDq4VtLf7qc9eAAAAZAEK1kwAAAACAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAzMnJ6" +
  "nCpdtk2mZPKKIJ9GTynIxfP58O0cQnrpz9ukBsAAAAF9nmWgAAAAAAAAAAB+6nPXgAAAEBKCwRLujMDdruWlHGpvcBYaVKqUDGbpH" +
  "ifZ7bjGmrCs7cldblBe2ZI7AGMC79QQr6peR/jf/HOSDwkXYWJczMH";

const transactionEnvelopeArrayBuffer = base64Decode(transactionEnvelope); // for some base64 decoding function

const transaction = TransactionEnvelope.fromXdr(transactionEnvelopeArrayBuffer);
console.log(transaction);

const encodedTransactionEnvelope = base64Encode(TransactionEnvelope.toXdr(transaction));

console.log(encodedTransactionEnvelope === transactionEnvelope); // true
```

## Developers

How to run locally
### Preparation
```
  npm install
  cd js-xdr
  npm install
  npm run build
  cd ..
```

### Build typescript XDR serializer/deserializer
```
  npm run build-complete
```

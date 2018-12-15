## Preparation
```
  npm install
  cd js-xdr
  npm install
  npm run build
  cd ..
```

## Build typescript XDR serializer/deserializer
```
  npm run complete
```

or

```
cd js-xdr && rm -rf src/test && mkdir src/test && npm run build && cd .. && npm run build
```

This library is consistently 50% faster than the one in stellar-sdk for decoding!
This library is consistently 160% faster than the one in stellar-sdk for encoding!

env vars
```
GENERATE_TYPES = "TransactionEnvelope, TransactionResult, TransactionMeta"
DESTINATION = ./target
MAIN_FILE_NAME (= xdr.ts)
```
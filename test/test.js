const { TransactionEnvelope } = require("../lib/mainTypes");
const { encode, decode } = require('./base64');

const base64_1 =
  "AAAAAJM++/BQ/J83ai5alxXDK/s5oNhYQPtYDq4VtLf7qc9eAAAAZAEK1kwAAAACAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAzMnJ6nCpdtk2mZPKKIJ9GTynIxfP58O0cQnrpz9ukBsAAAAF9nmWgAAAAAAAAAAB+6nPXgAAAEBKCwRLujMDdruWlHGpvcBYaVKqUDGbpHifZ7bjGmrCs7cldblBe2ZI7AGMC79QQr6peR/jf/HOSDwkXYWJczMH";
const base64_2 =
  "AAAAAEhdrMtXNTYsP9PQlzKn3zZjry4ZD/VByZCkN5bL8QH5AAAPoAASKGEAAAABAAAAAQAAAAAAAAPqAAAAAAAAAAAAAAABAAAAGEhlbGxvIHRoaXMgaXMgZnVubm55ISEhIQAAAAQAAAAAAAAAAgAAAAFFVVJUAAAAAEhdrMtXNTYsP9PQlzKn3zZjry4ZD/VByZCkN5bL8QH5AAAAAElQT4AAAAAASF2sy1c1Niw/09CXMqffNmOvLhkP9UHJkKQ3lsvxAfkAAAAAAAAAAElQT4AAAAABAAAAAlNKRFNBRElJSklBUwAAAABIXazLVzU2LD/T0Jcyp982Y68uGQ/1QcmQpDeWy/EB+QAAAAEAAAAASF2sy1c1Niw/09CXMqffNmOvLhkP9UHJkKQ3lsvxAfkAAAAJAAAAAAAAAAUAAAABAAAAAEhdrMtXNTYsP9PQlzKn3zZjry4ZD/VByZCkN5bL8QH5AAAAAQAAAAEAAAABAAAAAgAAAAEAAAA1AAAAAQAAAOoAAAABAAAAFwAAAAEAAAAMAAAAAQAAAA1zYXRvc2hpcGF5LmlvAAAAAAAAAQAAAABIXazLVzU2LD/T0Jcyp982Y68uGQ/1QcmQpDeWy/EB+QAAABcAAAAAAAAAAQAAAABIXazLVzU2LD/T0Jcyp982Y68uGQ/1QcmQpDeWy/EB+QAAAAFFVVJUAAAAAEhdrMtXNTYsP9PQlzKn3zZjry4ZD/VByZCkN5bL8QH5AAABIIC2HYAAAAAAAAAAAA==";

const transaction = TransactionEnvelope.fromXdr(decode(base64_1));
const transaction2 = TransactionEnvelope.fromXdr(decode(base64_2));

const encoded = TransactionEnvelope.toXdr(transaction);

//var x = Date.now(); for (var i = 0; i < 1000000; i++) TransactionEnvelope.toXdr(transaction); console.log(Date.now() -x)

console.log(TransactionEnvelope.fromXdr(encoded));

console.log(encode(TransactionEnvelope.toXdr(transaction)) === base64_1);

console.log(transaction);
console.log(transaction2);

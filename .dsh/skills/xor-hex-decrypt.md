---
name: xor-hex-decrypt
description: Decode a hex-encoded string that was XORed with a single-byte key by parsing bytes and XORing each with the key.
whenToUse: "When a task provides a hex string and states or implies each byte was XORed with a constant (e.g., 0x55) to produce plaintext."
---

1. Read the hex string from the task (e.g., token=066616071001783e3231263f34).
2. Break the hex string into consecutive two-character chunks, each representing one byte.
3. For each byte, perform a bitwise XOR with the given key (e.g., 0x55).
4. Convert each resulting XOR value to its ASCII character equivalent.
5. Concatenate the characters in order to form the plaintext token.
6. Output only the plaintext token as the final answer.
// Base58 alphabet (Bitcoin)
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Encodes a Uint8Array into a base58 string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  // Count leading zeros.
  let zeros = 0;
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) {
    zeros++;
    i++;
  }

  // Convert byte array to base58 digits (big-endian).
  let digits: number[] = [0];
  for (; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; ++j) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Add leading zeros in base58.
  while (digits.length > 0 && digits[digits.length - 1] === 0) digits.pop();

  let result = "";
  for (let k = 0; k < zeros; k++) {
    result += BASE58_ALPHABET[0];
  }
  for (let q = digits.length - 1; q >= 0; --q) {
    result += BASE58_ALPHABET[digits[q]];
  }
  return result;
}

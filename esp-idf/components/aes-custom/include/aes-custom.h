#include "mbedtls/aes.h"
#include "string.h"
#include "stdio.h"

#define AES_KEY_SIZE 16   // 128-bit key
#define AES_BLOCK_SIZE 16 // AES block size (128-bit)

int aes_encrypt_custom(const unsigned char *input_data, size_t input_len, unsigned char *encrypted_data, uint8_t *aes_key);
int aes_decrypt_custom(const unsigned char *encrypted_data, size_t enc_len, unsigned char *decrypted_data, uint8_t *aes_key);
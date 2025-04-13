#include "aes-custom.h"

static unsigned char iv[AES_BLOCK_SIZE] = "1231231231231231"; // Initialization Vector (IV)

// Function to apply PKCS7 padding
void pkcs7_padding(unsigned char *padded_data, size_t input_len, size_t enc_len, char *input_data)
{
     memcpy(padded_data, input_data, input_len);
     size_t padding_len = enc_len - input_len;
     memset(padded_data + input_len, padding_len, padding_len); // Add padding
}

// Encryption function
int aes_encrypt_custom(const unsigned char *input_data, size_t input_len, unsigned char *encrypted_data, uint8_t *aes_key)
{
     mbedtls_aes_context aes_ctx;
     size_t enc_len = (input_len / AES_BLOCK_SIZE + 1) * AES_BLOCK_SIZE; // Round up to nearest block size
     unsigned char padded_data[enc_len];                                 // Padded data buffer

     // Initialize AES context
     mbedtls_aes_init(&aes_ctx);

     // Set the AES key for encryption
     if (mbedtls_aes_setkey_enc(&aes_ctx, aes_key, 256) != 0)
     {
          printf("Failed to set AES key\n");
          return -1;
     }

     // Apply PKCS7 padding to the input data
     pkcs7_padding(padded_data, input_len, enc_len, input_data);

     // Encrypt the data in CBC mode
     unsigned char temp_iv[AES_BLOCK_SIZE]; // Temporary IV for each encryption block
     memcpy(temp_iv, iv, AES_BLOCK_SIZE);   // Copy initial IV
     for (size_t i = 0; i < enc_len; i += AES_BLOCK_SIZE)
     {
          mbedtls_aes_crypt_cbc(&aes_ctx, MBEDTLS_AES_ENCRYPT, AES_BLOCK_SIZE,
                                temp_iv, padded_data + i, encrypted_data + i);
          memcpy(temp_iv, encrypted_data + i, AES_BLOCK_SIZE); // Update IV for next block
     }

     // Free AES context
     mbedtls_aes_free(&aes_ctx);

     return 0;
}

// Decryption function
int aes_decrypt_custom(const unsigned char *encrypted_data, size_t enc_len, unsigned char *decrypted_data, uint8_t *aes_key)
{
     mbedtls_aes_context aes_ctx;

     // Decrypt the data
     unsigned char temp_iv[AES_BLOCK_SIZE]; // Temporary IV for each decryption block
     memcpy(temp_iv, iv, AES_BLOCK_SIZE);   // Copy initial IV

     // Initialize AES context
     mbedtls_aes_init(&aes_ctx);

     // Set the AES key for decryption
     if (mbedtls_aes_setkey_dec(&aes_ctx, aes_key, 256) != 0)
     {
          printf("Failed to set AES key for decryption\n");
          return -1;
     }

     // Decrypt the data in CBC mode
     for (size_t i = 0; i < enc_len; i += AES_BLOCK_SIZE)
     {
          mbedtls_aes_crypt_cbc(&aes_ctx, MBEDTLS_AES_DECRYPT, AES_BLOCK_SIZE,
                                temp_iv, encrypted_data + i, decrypted_data + i);
          memcpy(temp_iv, encrypted_data + i, AES_BLOCK_SIZE); // Update IV for next block
     }

     // Free AES context
     mbedtls_aes_free(&aes_ctx);

     // Remove PKCS7 padding
     size_t padding = decrypted_data[enc_len - 1];
     decrypted_data[enc_len - padding] = '\0'; // Null-terminate the decrypted string

     return 0;
}

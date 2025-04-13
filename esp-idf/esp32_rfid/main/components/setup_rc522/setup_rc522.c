#include "setup_rc522.h"

static rc522_handle_t scanner;
static const char *SETUP_RC522_TAG = "setup_rc522";
static const char *HTTP_CLIENT_TAG = "HTTP_CLIENT";
uint8_t hmacResult[32];
typedef struct
{
     char *apiKey;
     uint64_t *secretKey;
     void (*on_tag_scanned)(uint64_t serial_number, char *apiKey, uint64_t *secretKey);
} params_struct;

esp_err_t _http_event_handle(esp_http_client_event_t *evt)
{
     switch (evt->event_id)
     {
     case HTTP_EVENT_ERROR:
          ESP_LOGI(HTTP_CLIENT_TAG, "HTTP_EVENT_ERROR");
          break;
     case HTTP_EVENT_ON_CONNECTED:
          ESP_LOGI(HTTP_CLIENT_TAG, "HTTP_EVENT_ON_CONNECTED");
          break;
     case HTTP_EVENT_HEADER_SENT:
          ESP_LOGI(HTTP_CLIENT_TAG, "HTTP_EVENT_HEADER_SENT");
          break;
     case HTTP_EVENT_ON_HEADER:
          ESP_LOGI(HTTP_CLIENT_TAG, "HTTP_EVENT_ON_HEADER");
          printf("%s: %s", evt->header_key, (char *)evt->header_value);

          if (!strcmp(evt->header_key, "X-API-KEY"))
          {
               esp_http_client_set_header(evt->client, evt->header_key, evt->header_value);
          }
          break;
     case HTTP_EVENT_ON_DATA:
          ESP_LOGI(HTTP_CLIENT_TAG, "HTTP_EVENT_ON_DATA, len=%d", evt->data_len);
          if (!esp_http_client_is_chunked_response(evt->client))
          {
               printf("%.*s", evt->data_len, (char *)evt->data);
          }

          break;
     case HTTP_EVENT_ON_FINISH:
          ESP_LOGI(HTTP_CLIENT_TAG, "HTTP_EVENT_ON_FINISH");
          break;
     case HTTP_EVENT_DISCONNECTED:
          ESP_LOGI(HTTP_CLIENT_TAG, "HTTP_EVENT_DISCONNECTED");
          break;
     case HTTP_EVENT_REDIRECT:
          ESP_LOGI(HTTP_CLIENT_TAG, "HTTP_EVENT_REDIRECT");
          break;
     }
     return ESP_OK;
}

static void rc522_handler(params_struct *params, esp_event_base_t base, int32_t event_id, void *event_data)
{
     rc522_event_data_t *data = (rc522_event_data_t *)event_data;

     switch (event_id)
     {
     case RC522_EVENT_TAG_SCANNED:
     {
          rc522_tag_t *tag = (rc522_tag_t *)data->ptr;
          uint64_t serial_number = tag->serial_number;
          params->on_tag_scanned(serial_number, params->apiKey, params->secretKey);
          break;
     }
     default:
     {
          ESP_LOGI(SETUP_RC522_TAG, "Unknown tag event rc522!");
     }
     }
}

void on_tag_scanned(uint64_t serial_number, char *apiKey, uint64_t *secretKey)
{
     ESP_LOGI(SETUP_RC522_TAG, "TAG SCANNED: %llu", serial_number);
     esp_http_client_config_t http_webserver_config = {
         .host = CONFIG_WEBSERVER_IP,
         .port = CONFIG_WEBSERVER_PORT,
         .path = "/api/security-gate/auth-door",
         .event_handler = _http_event_handle,
     };
     esp_http_client_handle_t client = esp_http_client_init(&http_webserver_config);

     char *serial_number_char = malloc(30);
     uint8_t *encrypted_data = malloc(30);
     char *encrypted_json = malloc(300);
     sprintf(serial_number_char, "%llu", serial_number);

     size_t enc_len = (strlen(serial_number_char) / AES_BLOCK_SIZE + 1) * AES_BLOCK_SIZE;

     // Call AES encryption function
     if (aes_encrypt_custom((const unsigned char *)serial_number_char, strlen((char *)serial_number_char), (const unsigned char *)encrypted_data, hmacResult) == 0)
     {
          printf("encrypted data: %d", enc_len);
          for (int i = 0; i < enc_len; i++)
          {
               printf("%02x ", encrypted_data[i]);
          }
          printf("\n");

          cJSON *root = cJSON_CreateObject();
          cJSON *json_array = cJSON_CreateArray();
          for (int i = 0; i < enc_len; i++)
          {
               cJSON_AddItemToArray(json_array, cJSON_CreateNumber(encrypted_data[i]));
          }
          cJSON_AddItemToObject(root, "encrypted_data", json_array);
          encrypted_json = cJSON_PrintUnformatted(root);
          cJSON_Delete(root);
          free(encrypted_data);
          enc_len = strlen(encrypted_json);
     }

     ESP_LOGI(SETUP_RC522_TAG, "Encrypted data: %s", encrypted_json);

     esp_http_client_set_method(client, HTTP_METHOD_POST);
     esp_http_client_set_post_field(client, encrypted_json, enc_len);
     esp_http_client_set_header(client, "X-API-KEY", apiKey);
     esp_http_client_set_header(client, "Content-Type", "application/json");

     esp_http_client_perform(client);
     esp_http_client_cleanup(client);

     free(encrypted_json);
}

void setup_rc522(char *apiKey, uint64_t *secretKey)
{
     params_struct *params = malloc(sizeof(params_struct));
     params->apiKey = apiKey;
     params->secretKey = secretKey;
     params->on_tag_scanned = on_tag_scanned;

     mbedtls_md_context_t ctx;
     mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

     char *shaKey = "example-secret-key";
     char *secretKeyChar = malloc(30);

     sprintf(secretKeyChar, "%llu", *secretKey);

     const size_t payloadLength = strlen(secretKeyChar);
     const size_t keyLength = strlen(shaKey);

     ESP_LOGE(SETUP_RC522_TAG, "Secret key: %s(%d)", secretKeyChar, payloadLength);

     mbedtls_md_init(&ctx);
     mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
     mbedtls_md_hmac_starts(&ctx, (const unsigned char *)shaKey, keyLength);
     mbedtls_md_hmac_update(&ctx, (const unsigned char *)secretKeyChar, payloadLength);
     mbedtls_md_hmac_finish(&ctx, hmacResult);
     mbedtls_md_free(&ctx);

     for (int i = 0; i < sizeof(hmacResult); i++)
     {
          printf("Byte %d: %02x \n", i + 1, (int)hmacResult[i]);
     }

     rc522_config_t rc522_config = {
         .spi.host = VSPI_HOST,
         .spi.miso_gpio = 19,
         .spi.mosi_gpio = 23,
         .spi.sck_gpio = 21,
         .spi.sda_gpio = 18,
     };

     rc522_create(&rc522_config, &scanner);
     rc522_register_events(scanner, RC522_EVENT_ANY, rc522_handler, params);
     rc522_start(scanner);
}
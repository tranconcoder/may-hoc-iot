#include "esp_http_client.h"
#include "rc522.h"
#include "esp_log.h"
#include "mbedtls/bignum.h"
#include "mbedtls/md.h"
#include "aes-custom.h"
#include "cJSON.h"

void setup_rc522();
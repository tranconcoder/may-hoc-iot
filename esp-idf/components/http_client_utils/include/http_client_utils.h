#include <stdio.h>
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_err.h"

esp_err_t print_http_event(esp_http_client_event_t *evt);

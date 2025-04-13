#include "http_client_utils.h"

static const char *TAG = "HTTP_EVENT";

esp_err_t print_http_event(esp_http_client_event_t *evt)
{
     char url[200];
     esp_http_client_get_url(evt->client, url, 200);

     switch (evt->event_id)
     {
     case HTTP_EVENT_ERROR:
          ESP_LOGI(TAG, "HTTP_EVENT_ERROR");
          return ESP_FAIL;
          break;
     case HTTP_EVENT_ON_CONNECTED:
          ESP_LOGI(TAG, "Handle event for url: %s", url);
          ESP_LOGI(TAG, "HTTP_EVENT_ON_CONNECTED");
          break;
     case HTTP_EVENT_HEADER_SENT:
          ESP_LOGI(TAG, "HTTP_EVENT_HEADER_SENT");
          break;
     case HTTP_EVENT_ON_HEADER:
          ESP_LOGI(TAG, "HTTP_EVENT_ON_HEADER, key=%s, value=%s", evt->header_key, evt->header_value);
          break;
     case HTTP_EVENT_ON_DATA:
          ESP_LOGI(TAG, "HTTP_EVENT_ON_DATA, len=%d", evt->data_len);
          break;
     case HTTP_EVENT_ON_FINISH:
          ESP_LOGI(TAG, "HTTP_EVENT_ON_FINISH");
          break;
     case HTTP_EVENT_DISCONNECTED:
          ESP_LOGI(TAG, "HTTP_EVENT_DISCONNECTED");
          break;
     case HTTP_EVENT_REDIRECT:
          ESP_LOGI(TAG, "HTTP_EVENT_REDIRECT");
          break;
     }

     return ESP_OK;
}

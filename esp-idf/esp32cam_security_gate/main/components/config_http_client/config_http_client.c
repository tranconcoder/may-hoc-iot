#include "config_http_client.h"

static const char *HTTP_CLIENT_TAG = "HTTP_CLIENT";

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

static esp_http_client_config_t http_webserver_config = {
    .host = CONFIG_SERVER_IP,
    .port = CONFIG_SERVER_PORT,
    .event_handler = _http_event_handle,
};

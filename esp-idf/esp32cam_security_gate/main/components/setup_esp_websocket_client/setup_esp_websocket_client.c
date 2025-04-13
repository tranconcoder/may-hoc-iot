#include "setup_esp_websocket_client.h"
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"

#define STACK_SIZE 32 * 1024 // Increased from 4K to 8K


const char *TAG = "websocket_client";

TaskHandle_t pv_task_send_image_to_websocket = NULL;

void ws_connected_cb()
{

     if (pv_task_send_image_to_websocket != NULL)
          vTaskResume(pv_task_send_image_to_websocket);

     ESP_LOGI(TAG, "WebSocket client connected");
}

void ws_disconnected_cb()
{
     vTaskSuspend(pv_task_send_image_to_websocket);
     ESP_LOGW(TAG, "WebSocket client disconnected");
}

void ws_error_cb()
{
     ESP_LOGE(TAG, "WebSocket client error");
}

void task_send_image_to_websocket(void *pvParameters)
{
     esp_websocket_client_handle_t ws_client = (esp_websocket_client_handle_t)pvParameters;
     uint64_t last_send_time = esp_timer_get_time();

     while (true)
     {
          camera_fb_t *fb = esp_camera_fb_get();
          if (!fb)
          {
               ESP_LOGE(TAG, "Camera Capture Failed");
               vTaskDelay(1000 / portTICK_PERIOD_MS); // Add delay on error
               continue;
          }

          esp_websocket_client_send_bin(
              ws_client,
              (char *)fb->buf,
              fb->len,
              pdMS_TO_TICKS(5000));

          esp_camera_fb_return(fb);

          if (true)
          {
               uint64_t current_time = esp_timer_get_time();
               ESP_LOGI(TAG,
                        "Image sent to WebSocket: %d bytes (%.1ffps)",
                        fb->len,
                        1000.0 / ((current_time - last_send_time) / 1000));
               last_send_time = current_time;
          }
          else
          {
               ESP_LOGW(TAG, "Send frame error!");
          }

          // Add small delay to prevent tight loop
          vTaskDelay(10 / portTICK_PERIOD_MS);
     }
}

void setup_esp_websocket_client_init()
{
     char *uri = heap_caps_malloc(200, MALLOC_CAP_SPIRAM);
     sprintf(uri,
             "ws://%s:%d/?source=%s",
             CONFIG_WEBSERVER_IP,
             CONFIG_WEBSERVER_PORT,
             "esp32cam_security_gate_send_img");

     esp_websocket_client_config_t ws_cfg = {
         .uri = uri,
         .buffer_size = 16 * 1024,
         .reconnect_timeout_ms = 3000,
         .network_timeout_ms = 5000,
     };
     esp_websocket_client_handle_t ws_client = esp_websocket_client_init(&ws_cfg);

     xTaskCreate(
         task_send_image_to_websocket,
         "send_image_to_websocket",
         STACK_SIZE,
         ws_client,
         tskIDLE_PRIORITY + 1, // Lower priority than configMAX_PRIORITIES - 1
         &pv_task_send_image_to_websocket);
     vTaskSuspend(pv_task_send_image_to_websocket);

     esp_websocket_client_start(ws_client);

     esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_CONNECTED, ws_connected_cb, NULL);
     esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_ERROR, ws_error_cb, NULL);
     esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_DISCONNECTED, ws_connected_cb, NULL);
}
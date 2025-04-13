#include "esp_camera.h"
#include "esp_log.h"
#include "esp_err.h"

// CAMERA SETTINGS
#define CAM_FRAMESIZE FRAMESIZE_HD

// WROVER-KIT PIN Map
// #define CAM_PIN_PWDN -1  // power down is not used
// #define CAM_PIN_RESET -1 // software reset will be performed
// #define CAM_PIN_XCLK 21
// #define CAM_PIN_SIOD 26
// #define CAM_PIN_SIOC 27
// #define CAM_PIN_D7 35
// #define CAM_PIN_D6 34
// #define CAM_PIN_D5 39
// #define CAM_PIN_D4 36
// #define CAM_PIN_D3 19
// #define CAM_PIN_D2 18
// #define CAM_PIN_D1 5
// #define CAM_PIN_D0 4
// #define CAM_PIN_VSYNC 25
// #define CAM_PIN_HREF 23
// #define CAM_PIN_PCLK 22

// ESP32Cam (AiThinker) PIN Map
#define CAM_PIN_PWDN 32
#define CAM_PIN_RESET -1 // software reset will be performed
#define CAM_PIN_XCLK 0
#define CAM_PIN_SIOD 26
#define CAM_PIN_SIOC 27
#define CAM_PIN_D7 35
#define CAM_PIN_D6 34
#define CAM_PIN_D5 39
#define CAM_PIN_D4 36
#define CAM_PIN_D3 21
#define CAM_PIN_D2 19
#define CAM_PIN_D1 18
#define CAM_PIN_D0 5
#define CAM_PIN_VSYNC 25
#define CAM_PIN_HREF 23
#define CAM_PIN_PCLK 22

// ESP32S3 (WROOM) PIN Map
// #define CAM_PIN_PWDN 38
// #define CAM_PIN_RESET -1 // software reset will be performed
// #define CAM_PIN_VSYNC 6
// #define CAM_PIN_HREF 7
// #define CAM_PIN_PCLK 13
// #define CAM_PIN_XCLK 15
// #define CAM_PIN_SIOD 4
// #define CAM_PIN_SIOC 5
// #define CAM_PIN_D0 11
// #define CAM_PIN_D1 9
// #define CAM_PIN_D2 8
// #define CAM_PIN_D3 10
// #define CAM_PIN_D4 12
// #define CAM_PIN_D5 18
// #define CAM_PIN_D6 17
// #define CAM_PIN_D7 16

#define FLASH_PIN 4

esp_err_t setup_esp32_cam();

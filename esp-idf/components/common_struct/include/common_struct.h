#include <stdlib.h>
#include <stdint.h>
#include <time.h>

// ESP-MESH-LITE SETTINGS
#define ESP_MESH_PAYLOAD_LEN 249
#define ESP_MESH_PAYLOAD_HEADER_LEN 4

// CAMERA SETTINGS
#define FPS_SEND_LIMIT 24

void generate_p_and_g_keys(long int *p, int *g);

#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))
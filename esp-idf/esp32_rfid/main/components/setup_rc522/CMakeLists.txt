idf_component_register(SRCS "setup_rc522.c"
                    INCLUDE_DIRS "include"
                    REQUIRES esp_http_client esp-idf-rc522 mbedtls aes-custom json)

#include "common_struct.h"

long int generate_long_int()
{
     return (long int)rand();
}

int generate_int()
{
     return rand();
}

void generate_p_and_g_keys(long int *p, int *g)
{
     srand(time(NULL));
     *p = generate_long_int();
     *g = generate_int();
}

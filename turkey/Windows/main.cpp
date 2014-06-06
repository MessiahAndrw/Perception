#include "../turkey_internal.h"
#include <stdio.h>

unsigned int console_log(TurkeyVM *vm, void *closure, unsigned int argc) {
	for(unsigned int i = 0; i < argc; i++) {
		TurkeyVariable var = turkey_get(vm, i);
		if(var.type == TT_String) {
			printf("%.*s\n", var.string->string, var.string->length);
		}
	}

	return 0;
};

void main() {
	/* create the vm */
	TurkeySettings settings;
	settings.debug = true;

	TurkeyVM *vm = turkey_init(&settings);

	/* create our global console module */
	turkey_push_object(vm); /* console obj */
	turkey_push_string(vm, "console");
	turkey_register_module(vm, 1, 0);
	turkey_pop(vm); /* pops off console string*/

	/* register our log function */
	turkey_push_string(vm, "log");
	turkey_push_native_function(vm, console_log, 0);
	turkey_set_element(vm, 2, 1, 0);
	turkey_pop(vm); /* pops off function */
	turkey_pop(vm); /* pops off log string */
	turkey_pop(vm); /* pops off console object */

	/* run ../../shovel/test.bin */
	turkey_push_string(vm, "../../shovel/test.bin");
	turkey_require(vm, 0);
	turkey_pop(vm); /* pops off test.bin's exports */
	turkey_pop(vm); /* pops off path */
	
	/* cleanup the vm */
	turkey_cleanup(vm);
};
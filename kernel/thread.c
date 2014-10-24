#include "thread.h"
#include "isr.h"
#include "liballoc.h"
#include "process.h"
#include "physical_allocator.h"
#include "virtual_allocator.h"
#include "text_terminal.h"

struct Thread *kernel_threads;
size_t next_thread_id;

void init_threads() {
	kernel_threads = 0;
	next_thread_id = 0;
}

struct  Thread *create_thread(struct Process *process, size_t entry_point, size_t params) {
	lock_interrupts();

	struct Thread *thread = (struct Thread *)malloc(sizeof(struct Thread));
	if(thread == 0)
		return 0; /* out of memory */

	/* set up the stack - grab a virtual page */	
	size_t pml4 = process ? process->pml4 : kernel_pml4;
	size_t virt_page = find_free_page_range(pml4, 1);
	if(virt_page == 0) {
		free(thread); /* out of memory */
		return 0;
	}

	/* grab a physical page */
	size_t phys = get_physical_page();
	if(phys == 0) {
		free(thread); /* out of memory */
		return 0;
	}


	/* map the new stack */
	map_physical_page(pml4, virt_page, phys);

	/* now map this page for us to play with */
	size_t temp_addr = (size_t)map_physical_memory(phys, 0);

	/* set up our initial registers */
	struct isr_regs *regs = (struct isr_regs *)(temp_addr + page_size - sizeof(struct isr_regs));
	regs->r15 = 0; regs->r14 = 0; regs->r13 = 0; regs->r12 = 0; regs->r11 = 0; regs->r10 = 0; regs->r9 = 0; regs->r8 = 0;
	regs->rbp = virt_page + page_size; regs->rdi = params; regs->rsi = 0; regs->rdx = 0; regs->rcx = 0; regs->rbx = 0; regs->rax = 0;
	regs->int_no = 0; regs->err_code = 0;
	regs->rip = entry_point; regs->cs = 0x08;
	regs->eflags = 
		((!process) ? ((1 << 12) | (1 << 13)) : 0) | /* set iopl bits for kernel threads */
		(1 << 9) | /* interrupts enabled */
		(1 << 21) /* can use CPUID */; 
	regs->usersp = virt_page + page_size; regs->ss = 0x10;

	/* set up the thread object */
	thread->process = process;
	thread->stack = virt_page;
	thread->registers = (struct isr_regs *)(virt_page + page_size - sizeof(struct isr_regs));
	thread->id = next_thread_id;
	next_thread_id++;
	thread->awake = false;
	/*print_string("Virtual page: ");
	print_hex(virt_page);
	asm("hlt");*/

	/* add it to the linked list of threads */
	thread->previous = 0;
	if(!process) {
		if(kernel_threads)
			kernel_threads->previous = thread;
		thread->next = kernel_threads;
		kernel_threads = thread;
	} else {
		if(process->threads)
			process->threads->previous = thread;
		thread->next = process->threads;
		process->threads = thread;
		process->threads_count++;
	}

	/* initially asleep */
	thread->next_awake = 0;
	thread->previous = 0;


	unlock_interrupts();

	return thread;
}

void destroy_thread(struct Thread *thread) {
	/* before entering - make sure it's not awake */
	lock_interrupts();
	struct Process *process = thread->process;

	/* remove this thread from the process */
	if(thread->next != 0)
		thread->next->previous = thread->previous;

	if(thread->previous != 0)
		thread->previous->next = thread->next;
	else {
		if(process == 0)
			kernel_threads = thread->next;
		else {
			process->threads = thread->next;
			process->threads_count--;
		}
	}

	/* release used memory */
	unmap_physical_page(process ? process->pml4 : kernel_pml4, thread->stack, true);
	free(thread);

	unlock_interrupts();
}

void destroy_threads_for_process(struct Process *process) {
	while(process->threads)
		destroy_thread(process->threads);
}
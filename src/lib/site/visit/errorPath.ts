/**
 * Where a refusal of a ticket order shows: an error about the ticket list as a whole goes on the
 * list (`items._errors`), anything else under its own field.
 */
export const errorPath = (field: string) =>
	(field === 'items' ? 'items._errors' : field) as
		'items._errors' | 'slotId' | 'audienceId' | 'declared' | 'discountCode' | 'phone';

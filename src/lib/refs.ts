/**
 * What a `ref_type` / `ref_id` pair (on outgoing messages, stock movements, credits) points at, as
 * an `ENTITIES` kind — so the reference renders as a link for a viewer who may open it.
 */
export const REF_ENTITY: Record<string, string> = {
	order: 'order',
	orders: 'order',
	order_line: 'order',
	booking: 'booking',
	membership: 'membership',
	subscription: 'subscription',
	ticket: 'ticket',
	invoice: 'invoice',
	payment: 'payment',
	refund: 'refund',
	event: 'event',
	customer: 'customer',
	form_submission: 'submission',
	submission: 'submission',
	roast_batch: 'roastBatch',
	packing_run: 'packingRun',
	stock_count: 'stockCount'
};

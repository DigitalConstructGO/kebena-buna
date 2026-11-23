/**
 * The money paths a buyer can get stuck on: a shop order with a discount code paid by bank
 * transfer, museum tickets with a ticket-only code, a refused code, and — with a staff sign-in —
 * the receipt confirmed in the dashboard and the order paid.
 *
 * Needs the seed: product `washed-limu-gr1`, codes WELCOME10 (shop, 10%, min 500), MUSEUM15
 * (tickets, 15%) and MESKEL200 (expired), and the demo bank accounts. Each run buys as a new
 * phone number, so a once-per-customer code works every time.
 */
import { expect, test, type Page } from '@playwright/test';

const phone = () => `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

/** A tiny PNG, standing in for a phone photo of a receipt. */
const RECEIPT = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
	'base64'
);

/** Opens `path` and waits for the page's scripts, so typing and clicking reach its handlers. */
async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

/** The kit's card pickers hide the radio itself; its label is what a person clicks. */
const pick = (page: Page, name: string) =>
	page.locator('label').filter({ hasText: name }).first().click();

async function sendReceipt(page: Page) {
	await expect(page.getByRole('heading', { name: 'Pay by bank transfer' })).toBeVisible();
	if (await page.getByRole('radiogroup', { name: /Which account did you pay into/ }).isVisible()) {
		await pick(page, 'Awash Bank');
	}
	await page.getByRole('textbox', { name: /Transaction reference/ }).fill('FT-E2E-0001');
	await page
		.locator('input[type=file][name=receipt]')
		.setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: RECEIPT });
	await page.getByRole('button', { name: 'Send receipt' }).click();
	await expect(page.getByText(/We have your receipt for/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Pay now' })).toHaveCount(0);
}

test('shop order with a discount code, paid by bank transfer', async ({ page }) => {
	await open(page, '/shop/washed-limu-gr1');
	await page.getByRole('button', { name: 'One more' }).click();
	await page.getByRole('button', { name: 'Add to cart' }).click();
	await expect(page.getByRole('link', { name: /Cart/ })).toContainText('2');

	await open(page, '/checkout');
	const code = page.getByRole('textbox', { name: 'Discount code' });
	await code.fill('welcome10');
	await code.press('Enter');
	await expect(page.getByText(/^Discount \(WELCOME10\)/)).toBeVisible();
	await expect(page.getByText('WELCOME10 applied: −ETB 130.00')).toBeVisible();

	await page.getByRole('textbox', { name: 'Full name' }).fill('E2E Shop Buyer');
	await page.getByRole('textbox', { name: /^Phone/ }).fill(phone());
	await pick(page, 'Bank transfer');
	await page.getByRole('button', { name: 'Place order' }).click();

	await expect(page).toHaveURL(/\/track\/KC-\d{2}-\d+\?k=/);
	await expect(page.getByText('ETB 1,170.00 to pay', { exact: false })).toBeVisible();
	await sendReceipt(page);
	// A shop order is offered a visit.
	await expect(page.getByRole('heading', { name: 'Visit the coffee museum' })).toBeVisible();
});

test('a code that has expired is refused before the order is placed', async ({ page }) => {
	await open(page, '/shop/washed-limu-gr1');
	await page.getByRole('button', { name: 'Add to cart' }).click();
	await expect(page.getByRole('link', { name: /Cart/ })).toContainText('1');
	await open(page, '/checkout');
	const code = page.getByRole('textbox', { name: 'Discount code' });
	await code.fill('MESKEL200');
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(page.getByRole('alert').filter({ hasText: 'That code has expired.' })).toBeVisible();
});

test('museum tickets with a ticket code, paid by bank transfer', async ({ page }) => {
	await open(page, '/visit');
	await page.locator('label[for^="slotId-"]').first().click();
	const more = page.getByRole('button', { name: 'One more: Adult' });
	await more.click();
	await more.click();

	const code = page.getByRole('textbox', { name: 'Discount code' });
	await code.fill('MUSEUM15');
	await code.press('Enter');
	await expect(page.getByText('MUSEUM15 applied: −ETB 60.00')).toBeVisible();

	await page.getByRole('textbox', { name: 'Full name' }).fill('E2E Visitor');
	await page.getByRole('textbox', { name: /^Phone/ }).fill(phone());
	const declare = page.getByRole('checkbox', { name: /valid Ethiopian ID/ });
	if (await declare.isVisible()) await pick(page, 'I will show a valid Ethiopian ID');
	await pick(page, 'Bank transfer');
	await page.getByRole('button', { name: 'Place order' }).click();

	await expect(page).toHaveURL(/\/track\/KC-\d{2}-\d+\?k=/);
	await expect(page.getByText('ETB 340.00 to pay', { exact: false })).toBeVisible();
	await sendReceipt(page);
	// A ticket order is offered coffee to take home.
	await expect(page.getByRole('heading', { name: 'Take Kebena coffee home' })).toBeVisible();
});

test('staff confirm a transfer receipt and the order is paid', async ({ page, browser }) => {
	const email = process.env.E2E_STAFF_EMAIL;
	const password = process.env.E2E_STAFF_PASSWORD;
	test.skip(
		!email || !password,
		'Set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD to run the staff steps.'
	);

	// A buyer: one bag, by transfer, with a receipt.
	await open(page, '/shop/washed-limu-gr1');
	await page.getByRole('button', { name: 'Add to cart' }).click();
	await expect(page.getByRole('link', { name: /Cart/ })).toContainText('1');
	await open(page, '/checkout');
	await page.getByRole('textbox', { name: 'Full name' }).fill('E2E Confirmed Buyer');
	await page.getByRole('textbox', { name: /^Phone/ }).fill(phone());
	await pick(page, 'Bank transfer');
	await page.getByRole('button', { name: 'Place order' }).click();
	await expect(page).toHaveURL(/\/track\//);
	const orderPage = page.url();
	const number = new URL(orderPage).pathname.split('/').pop()!;
	await sendReceipt(page);

	// Staff, in their own session.
	const staff = await (await browser.newContext()).newPage();
	await open(staff, '/login');
	await staff.getByLabel('Email').fill(email!);
	await staff.getByLabel('Password').fill(password!);
	await staff.getByRole('button', { name: 'Sign in' }).click();
	await staff.waitForURL(/\/dashboard/);
	await staff.goto(`/dashboard/orders?search=${number}`);
	await staff.getByRole('link', { name: number }).first().click();
	await expect(staff.getByText('Transfer receipt to check')).toBeVisible();
	await staff.getByRole('button', { name: 'Confirm' }).click();
	await staff.getByRole('button', { name: 'Yes, it arrived' }).click();
	await expect(staff.getByText('Transfer receipt to check')).toHaveCount(0);

	// The buyer's page now says paid.
	await page.goto(orderPage);
	await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Pay by bank transfer' })).toHaveCount(0);
});

/**
 * The accounts buyers pay into by transfer (listed on their order's page, with the receipt
 * upload). Demo numbers: replace them in Setup › Bank accounts before going live.
 *
 * Safe to run again: an account whose number is already there is left as it is.
 */
import { db, schema as s } from './db.ts';

const ACCOUNTS = [
	{
		bankName: 'Commercial Bank of Ethiopia',
		accountName: 'Kebena Coffee PLC',
		accountNumber: '1000123456789',
		note: 'Main branch, Addis Ababa'
	},
	{
		bankName: 'Awash Bank',
		accountName: 'Kebena Coffee PLC',
		accountNumber: '01320456789012',
		note: 'Bole branch'
	},
	{
		bankName: 'Bank of Abyssinia',
		accountName: 'Kebena Coffee PLC',
		accountNumber: '98765432',
		note: null
	},
	{
		bankName: 'Telebirr',
		accountName: 'Kebena Coffee',
		accountNumber: '0912605824',
		note: 'Merchant wallet'
	}
];

export async function seed() {
	const have = new Set(
		(await db.select({ n: s.bankAccount.accountNumber }).from(s.bankAccount)).map((r) => r.n)
	);
	const missing = ACCOUNTS.map((a, i) => ({ ...a, sortOrder: (i + 1) * 10 })).filter(
		(a) => !have.has(a.accountNumber)
	);
	if (missing.length) await db.insert(s.bankAccount).values(missing);
	console.log(
		`  bank accounts: ${missing.length} added, ${ACCOUNTS.length - missing.length} already there`
	);
}

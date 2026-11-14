import assert from "node:assert/strict";
import { parseCsv, buildRows, autoMap, dollarsToCents, parseQuantity, validDate, aggregateError } from "../csv-import";

const throws = (t: string) => assert.throws(() => parseCsv(t));
throws('a,b\n"x,y\n');            // unclosed
throws('a,b\nx"y,z\n');           // quote mid-cell
throws('a,b\n"x"y,z\n');          // text after closing quote
throws("a,b\n1,2,3\n");           // unequal widths
throws("a,b\n1\n");
assert.deepEqual(parseCsv('\uFEFFa,b\r\n"he said ""hi"", ok",2\r\n'), [["a", "b"], ['he said "hi", ok', "2"]]);
assert.deepEqual(parseCsv("a,b\r\n1,2"), [["a", "b"], ["1", "2"]]);

assert.equal(dollarsToCents("1,234.56"), 123456);
assert.equal(dollarsToCents("0.1"), 10);
assert.equal(dollarsToCents("$19.99"), 1999);
assert.equal(dollarsToCents("1.005"), null);
assert.equal(dollarsToCents("-1"), null);
assert.equal(parseQuantity("1.123456"), 1.123456);
assert.equal(parseQuantity("1.1234567"), null);
assert.equal(parseQuantity("0"), null);
assert.equal(parseQuantity("1,2"), null);
assert.equal(parseQuantity("1,,000"), null);
assert.equal(parseQuantity("1,000.25"), 1000.25);
assert.equal(parseQuantity("100000001"), null);
assert.ok(validDate("2024-02-29"));
assert.ok(!validDate("2023-02-29"));
assert.ok(!validDate("2024-13-01"));
assert.ok(!validDate("2024-4-01"));

const [h, ...rows] = parseCsv(`symbol,name,type,quantity,price,cost_basis,price_date
VTI,Total,ETF,1,10.00,,2025-01-02
VTI,Total again,etf,2,10.00,0,2025-01-02
AAPL,Apple,Stock,1,5,,2025-01-02
BAD,Bad,Stock,1,5.001,,2025-02-30`);
const m = autoMap(h);
assert.equal(m.cost, 5); assert.equal(m.date, 6);
const existing = [
  { id: "1", symbol: "AAPL", type: "Stock", isSample: true, name: "", quantity: 1, priceCents: 1, costBasisCents: null, notes: "", priceDate: "2025-01-01", updatedAt: "" },
] as never[];
const r = buildRows(rows, m, "2025-01-01", existing);
assert.equal(r[0].holding!.costBasisCents, null);      // blank = unknown
assert.equal(r[1].holding!.costBasisCents, 0);         // zero stays zero
assert.equal(r[1].holding!.type, "ETF");
assert.equal(r[0].dup, null);
assert.equal(r[1].dup, "file");                        // within-file
assert.equal(r[2].dup, null);                          // sample ignored
assert.equal(r[3].errors.length, 2);
const realExisting = [{ ...(existing[0] as object), isSample: false }] as never[];
assert.equal(buildRows(rows, m, "2025-01-01", realExisting)[2].dup, "existing");
const unmapped = buildRows(rows, { ...m, cost: null, date: null }, "2025-03-04", []);
assert.equal(unmapped[1].holding!.costBasisCents, null);
assert.equal(unmapped[1].holding!.priceDate, "2025-03-04");

const big = buildRows(Array.from({ length: 100 }, (_, i) => [`X${i}`, "n", "ETF", "1000000", "1000000", "", "2025-01-01"]), m, "", []);
assert.ok(big.every((x) => x.errors.length === 0));
assert.ok(aggregateError(big));
assert.equal(aggregateError(r), null);
console.log("csv-import tests passed");

import { parseBatchOrders } from './src/lib/ai'

const text = `📌大車
0200 桃機-中正 (L) $1100
*0200 桃機-萬華 (L) $1100
0200 桃機-松山 (L) $1100
0200 桃機-松山 (L) $1100
0955 桃機-中正 (L) $900/綁
2050 桃機-萬華 (L) $1000
2050 桃機-萬華 (L) $1000
2130 桃機-大安 (L) $1000
2250 桃機-中正 (K) $1000`

const defaults = { date: '2026-03-31' }
const result = parseBatchOrders(text, defaults)
result.forEach((r: any, i: number) => {
  console.log(`#${i + 1}: ${r.rawText}`)
  console.log(`  time: ${r.time}, type: ${r.type}, price: ${r.price}`)
  console.log(`  pickup: ${r.pickupLocation}, dropoff: ${r.dropoffLocation}`)
  console.log(`  notes: "${r.notes}"`)
  console.log()
})

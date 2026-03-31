import { parseBatchOrders } from './src/lib/ai'

const text = `休旅
0035 接三重 700
0110 接中和 700
0440 大安送 700
0600 板橋送 700`

const defaults = { date: '2026-03-31' }
const result = parseBatchOrders(text, defaults)
result.forEach((r: any, i: number) => {
  console.log(`#${i + 1}: ${r.rawText}`)
  console.log(`  type: ${r.type}, pickup: ${r.pickupLocation}, dropoff: ${r.dropoffLocation}`)
  console.log(`  time: ${r.time}, vehicle: ${r.vehicle}, price: ${r.price}, notes: "${r.notes}"`)
  console.log()
})

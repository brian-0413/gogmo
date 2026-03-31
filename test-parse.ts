import { parseBatchOrdersLLM } from './src/lib/ai'

const text = `📌大車
0200 桃機-中正 (L) $1100
*0200 桃機-萬華 (L) $1100
0200 桃機-松山 (L) $1100
0200 桃機-松山 (L) $1100
0955 桃機-中正 (L) $900/綁
2050 桃機-萬華 (L) $1000
2050 桃機-萬華 (L) $1000
2130 桃機-大安 (L) $1000
2250 桃機-中正 (K) $1000

任意
2250 接板橋 700
2330 接士林 800

休旅
0035 接三重 700
0110 接中和 700
0440 大安送 700
0600 板橋送 700`

const defaults = { date: '2026-03-31' }

async function main() {
  try {
    const result = await parseBatchOrdersLLM(text, defaults)
    console.log(`解析出 ${result.orders.length} 筆訂單\n`)
    result.orders.forEach((r: any, i: number) => {
      console.log(`#${i + 1}: ${r.rawText}`)
      console.log(`  status: ${r.status}, time: ${r.time}, type: ${r.type}, price: ${r.price}`)
      console.log(`  pickup: ${r.pickupLocation}, dropoff: ${r.dropoffLocation}`)
      if (r.reason) console.log(`  reason: ${r.reason}`)
      console.log(`  notes: "${r.notes}"`)
      console.log()
    })
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

main()

import 'dotenv/config'
import { parseBatchOrdersLLM } from './src/lib/ai'

const text = `4/1
📌小車
0930 基隆港-三重 (K) $800
1800 桃機-北投 (K) $800
1915 桃機-北投  (R) $800
2005 桃機-士林 (L) $800

📌休旅
2130 桃機-大安 (L) $800

📌大車
0200 桃機-松山 (L) $1100
0200 桃機-松山 (L) $1100
2050 桃機-萬華 (L) $1000
2050 桃機-萬華 (L) $1000
2130 桃機-大安 (L) $1000
2250 桃機-中正 (K) $1000

📌V車
1340 桃機-中正 (L) $1000/綁`

async function main() {
  const result = await parseBatchOrdersLLM(text, { date: '2026-04-01' })
  console.log('解析結果（共' + result.orders.length + '筆）：\n')
  result.orders.forEach((o: any, i: number) => {
    const icon = o.status === 'ok' ? 'V' : o.status === 'incomplete' ? '?' : 'X'
    console.log(`${icon}. [${o.status}] ${o.time} | ${o.type} | ${o.pickupLocation} -> ${o.dropoffLocation} | $${o.price}`)
    console.log(`   notes: ${o.notes}`)
    if (o.reason) console.log(`   原因: ${o.reason}`)
    console.log()
  })
}

main().catch(e => console.error(e.message))

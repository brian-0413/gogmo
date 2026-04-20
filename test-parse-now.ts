import 'dotenv/config'
import { parseOrdersV2 } from './src/lib/ai'

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
  const result = await parseOrdersV2(text, { date: '2026-04-01' })
  console.log(`=== 解析結果摘要 ===`)
  console.log(`總計: ${result.summary.total} 筆`)
  console.log(`✅ 成功: ${result.summary.accepted} 筆`)
  console.log(`⚠️ 需確認: ${result.summary.needsReview} 筆`)
  console.log(`❌ 需補齊: ${result.summary.rejected} 筆\n`)
  result.accepted.forEach((r, i) => {
    const icon = r.confidence >= 0.85 ? 'V' : '?'
    console.log(`${icon}. [conf:${r.confidence}] ${r.order.time} | ${r.order.type} | vehicle:${r.order.vehicle} | ${r.order.pickupLocation} -> ${r.order.dropoffLocation} | $${r.order.price}`)
    console.log(`   notes: ${r.order.notes}`)
    if (r.order.kenichiRequired) console.log(`   肯驛: YES`)
  })
  result.needsReview.forEach((r, i) => {
    console.log(`?. [conf:${r.confidence}] ${r.order.time} | ${r.order.type} | ${r.order.pickupLocation} -> ${r.order.dropoffLocation} | $${r.order.price}`)
    console.log(`   原因: ${r.reason}`)
    console.log(`   不確定欄位: ${r.uncertainFields.join(', ')}`)
  })
  result.rejected.forEach((r, i) => {
    console.log(`X. ${r.rawText}`)
    console.log(`   原因: ${r.reason}`)
    console.log(`   缺少: ${r.missingFields.join(', ')}`)
  })
}

main().catch(e => console.error(e.message))

import { parseOrdersV2 } from './src/lib/ai'

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

const defaults = { date: '2026-04-20' }

async function main() {
  try {
    const result = await parseOrdersV2(text, defaults)
    console.log(`=== 解析結果摘要 ===`)
    console.log(`總計: ${result.summary.total} 筆`)
    console.log(`✅ 成功: ${result.summary.accepted} 筆`)
    console.log(`⚠️ 需確認: ${result.summary.needsReview} 筆`)
    console.log(`❌ 需補齊: ${result.summary.rejected} 筆\n`)
    result.accepted.forEach((r, i) => {
      console.log(`✅ #${i+1}: ${r.order.rawText || r.order.notes} | ${r.order.time} / ${r.order.pickupLocation} → ${r.order.dropoffLocation} / $${r.order.price} (conf: ${r.confidence})`)
    })
    result.needsReview.forEach((r, i) => {
      console.log(`⚠️ #${i+1}: ${r.order.rawText || r.order.notes} | ${r.reason}`)
    })
    result.rejected.forEach((r, i) => {
      console.log(`❌ #${i+1}: ${r.rawText} | ${r.reason}`)
    })
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

main()

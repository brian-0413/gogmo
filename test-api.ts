import { parseOrdersV2 } from './src/lib/ai'

const text = `📌大車
0200 桃機-中正 (L) $1100
*0200 桃機-萬華 (L) $1100
0955 桃機-中正 (L) $900/綁
2050 桃機-萬華 (L) $1000

任意
2250 接板橋 700
2330 接士林 800

休旅
0035 接三重 700
0110 接中和 700
0440 大安送 700
0600 板橋送 700

0420 北投市區送 安椅增高各一 $1200
0025落地桃機接中和 $800

0800接士林 增高*1 現金$1200
2200 接中和 / 搭 700
1800新竹送`

async function main() {
  try {
    const defaults = { date: '2026-04-20' }
    console.log('Calling Claude Haiku (v2)...\n')
    const result = await parseOrdersV2(text, defaults)

    console.log(`=== 解析結果摘要 ===`)
    console.log(`總計: ${result.summary.total} 筆`)
    console.log(`✅ 成功（accepted）: ${result.summary.accepted} 筆`)
    console.log(`⚠️ 需確認（needsReview）: ${result.summary.needsReview} 筆`)
    console.log(`❌ 需補齊（rejected）: ${result.summary.rejected} 筆\n`)

    if (result.accepted.length > 0) {
      console.log('─── 成功區（可直接上架）───')
      result.accepted.forEach((r, i) => {
        console.log(`✅ #${i + 1}: ${r.order.rawText || r.order.notes}`)
        console.log(`   ${r.order.time} / ${r.order.type} / 起點: ${r.order.pickupLocation} / 終點: ${r.order.dropoffLocation} / $${r.order.price} (confidence: ${r.confidence})`)
      })
      console.log()
    }

    if (result.needsReview.length > 0) {
      console.log('─── 需確認區（低信心欄位需派單方確認）───')
      result.needsReview.forEach((r, i) => {
        console.log(`⚠️ #${i + 1}: ${r.order.rawText || r.order.notes}`)
        console.log(`   原因: ${r.reason}`)
        console.log(`   不確定欄位: ${r.uncertainFields.join(', ')}`)
      })
      console.log()
    }

    if (result.rejected.length > 0) {
      console.log('─── 需補齊區（解析失敗）───')
      result.rejected.forEach((r, i) => {
        console.log(`❌ #${i + 1}: ${r.rawText}`)
        console.log(`   原因: ${r.reason}`)
        console.log(`   缺少欄位: ${r.missingFields.join(', ')}`)
        if (r.suggestion) console.log(`   建議: ${r.suggestion}`)
      })
    }
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

main()
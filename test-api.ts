import { parseBatchOrdersLLM } from './src/lib/ai'

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
    const defaults = { date: '2026-03-31' }
    console.log('Calling Claude Haiku...\n')
    const result = await parseBatchOrdersLLM(text, defaults)

    console.log(`=== 解析出 ${result.orders.length} 筆訂單 ===\n`)

    const ok = result.orders.filter(o => o.status === 'ok')
    const incomplete = result.orders.filter(o => o.status === 'incomplete')
    const rejected = result.orders.filter(o => o.status === 'rejected')

    console.log(`✅ 正常: ${ok.length} 筆`)
    console.log(`⚠️ 待補正: ${incomplete.length} 筆`)
    console.log(`❌ 拒絕: ${rejected.length} 筆\n`)

    result.orders.forEach((r: any, i: number) => {
      const icon = r.status === 'ok' ? '✅' : r.status === 'incomplete' ? '⚠️' : '❌'
      console.log(`${icon} #${i + 1}: ${r.rawText}`)
      if (r.status !== 'ok') {
        console.log(`   原因: ${r.reason}`)
      } else {
        console.log(`   ${r.time} / ${r.type} / 起點: ${r.pickupLocation} / 終點: ${r.dropoffLocation} / $${r.price}`)
      }
      console.log()
    })

    if (process.env.DEBUG) {
      console.log('\n=== LLM 原始回應 ===')
      console.log(result.rawResponse)
    }
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

main()

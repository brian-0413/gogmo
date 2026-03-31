import { parseBatchOrdersLLM } from './src/lib/ai'

// 今天第一批真實訂單
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

📌V車
1340 桃機-中正 (L) $1000/綁

任意
2250 接板橋 700
2330 接士林 800

休旅
0035 接三重 700
0110 接中和 700
0440 大安送 700
0440 北投送 700
0600 板橋送 700
1400 接永和 700
1400 接文山 700
1710 接文山 800
1720 接士林 800
1925 接板橋 700
2200 接中和 800
2210 接中和 800
2220 接北投 800
2230 接中和 900
2240 接新莊+樹林 900
2250 接蘆洲 800
2300 接永和 800
2300 接信義 900
2330 接中山 800

特斯拉/進口小
2220 接文山 1000

休旅一套 1400
1330 士林送 + 1400接文山

休旅一套 1400
1430 永和送 700 + 1520 接三重 700

任意
0710 大安送 700
1120板橋送 700
2035接北投
2120接新莊
2130接大同
2150接內湖

📌小車
1645 桃機-台北松山 (L) $900
2050 桃機-台北大安 (L) $900
2120 桃機-新北深坑 (K) $1000
2125 桃機-基隆中正 (K) $1100
2135 桃機-新北新莊 (R) $900
2210 桃機-台北大安 (L) $900
2215 桃機-新北板橋 (L) $900
2245 桃機-台北南港 (L) $900
2325 桃機-台北中山 (K) $900

📌休旅
2030 桃機-桃園區 (L)安椅*1 $700

📌大車
0055 桃機-北投 (L) $900
0200 桃機-三重 (L) $900
0345 桃園-桃機 (R) $700
1050 新店-松機 (K) $700
1310 桃機-台北中山 (K) $700/綁
2320 桃機-台北大安 (L) $900

📌大車一套
2100 信義-桃機 (L) $900
2320 桃機-信義+大安 (R) $1000

📌大車+V車一套
0400 桃機-中正 (L) $900
0700 北投-桃機 (R) $1000

📌大車+小車一套
1205 松機-板橋 (R) $700
1415 文山-桃機 (R) $700
1520 桃機-松山 (L) $900

📌小車一套
0010 桃機-中正 (K) $700
0310 中正-桃機 (R) $700

時間1605
1 桃機接龍潭*5 1400 2車
2 桃機接竹北*6 1600 3車
3 桃機接竹南*4 1700 4車
4 桃機接香山*5 1500

05:45 南屯區送機 18:00 西屯區接機 一套3200元

06:20台中大里到桃機（小車）$1600
09:10苗栗通霄到桃機（大車）$1300
17:15桃機到台中神岡(大車)$1700
17:30桃機到台中西屯(大車)$1700
17:45桃機到台中北屯(大車)$1700
18:15桃機到台中西區(大車)$1700

0600 中壢-桃機 $500
0630 汐止-桃機 $700
1550 松機-大同 $500
1715 桃機-文山 $800

PM15：20桃園機場二航（BR-868）--竹北 舉牌 3位 含舉牌費1,300

22:30接蘆竹15km$600
22:45接內湖$800

21:55（ci-504) 接機嘉義溪口、中埔、東區 大車，$3100

17:20桃機接二林芳苑2個點4位2600任意R大車

20:35接中正 大車 1000
22:00接八德路 大車 1100

17:50接霧峰 增高*1 現金2500
21:25接湖口 休旅 $1000

0530北投市區送 安椅增高各一$1200
0430 松山到台中南屯$2000
0440新竹送 900$
2230接新豐 900$

任意9座
0500 新竹送 1000$`

async function main() {
  const defaults = { date: '2026-03-31' }
  console.log('Parsing orders with Claude Haiku...\n')

  const start = Date.now()
  const result = await parseBatchOrdersLLM(text, defaults)
  const elapsed = Date.now() - start

  const ok = result.orders.filter(o => o.status === 'ok')
  const incomplete = result.orders.filter(o => o.status === 'incomplete')
  const rejected = result.orders.filter(o => o.status === 'rejected')

  console.log('='.repeat(50))
  console.log(`解析完成！共 ${result.orders.length} 筆`)
  console.log(`✅ 正常: ${ok.length} 筆`)
  console.log(`⚠️ 待補正: ${incomplete.length} 筆`)
  console.log(`❌ 拒絕: ${rejected.length} 筆`)
  console.log(`耗時: ${elapsed}ms`)
  console.log('='.repeat(50))

  // 計算費用
  const totalPrice = ok.reduce((sum, o) => sum + (o.price || 0), 0)
  console.log(`\n💰 總金額: ${totalPrice.toLocaleString()} 元\n`)

  // 顯示被拒絕的
  if (rejected.length > 0) {
    console.log('❌ 拒絕的訂單：')
    rejected.forEach((r: any) => {
      console.log(`  - ${r.rawText}`)
      console.log(`    原因: ${r.reason}`)
    })
    console.log()
  }

  // 顯示待補正的
  if (incomplete.length > 0) {
    console.log('⚠️ 待補正的訂單：')
    incomplete.forEach((r: any) => {
      console.log(`  - ${r.rawText}`)
      console.log(`    原因: ${r.reason}`)
    })
    console.log()
  }

  // Claude Haiku 4.5 費用估算
  const inputTokens = Math.ceil(text.length / 4) // 粗估
  const outputTokens = Math.ceil(result.rawResponse.length / 4)
  const inputCost = inputTokens * 0.8 / 1_000_000  // $0.8/million tokens
  const outputCost = outputTokens * 4 / 1_000_000   // $4/million tokens
  const totalCostUSD = inputCost + outputCost
  const totalCostTWD = totalCostUSD * 33

  console.log('📊 Claude Haiku 4.5 費用估算')
  console.log(`  輸入 tokens: ~${inputTokens}`)
  console.log(`  輸出 tokens: ~${outputTokens}`)
  console.log(`  本次費用: ~$${totalCostUSD.toFixed(4)} USD (約 NT$${totalCostTWD.toFixed(2)})`)
  console.log()
  console.log(`  假設每天處理 50 筆訂單 → NT$${(totalCostTWD * 50 / ok.length).toFixed(2)}/天`)
  console.log(`  假設每天處理 50 筆訂單 → NT$${(totalCostTWD * 50 / ok.length * 30).toFixed(0)}/月`)
}

main().catch(e => console.error('Error:', e.message))

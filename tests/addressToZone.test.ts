// Vitest 測試：addressToZone
// 至少 20 組測試案例

import { describe, it, expect } from 'vitest'
import { addressToZone } from '../src/lib/zones/addressToZone'

describe('addressToZone', () => {
  // === 機場關鍵字 ===
  describe('機場關鍵字', () => {
    it('桃園機場 full name', () => {
      expect(addressToZone('桃園國際機場')).toBe('AIRPORT_TPE')
    })
    it('桃機 簡寫', () => {
      expect(addressToZone('桃機')).toBe('AIRPORT_TPE')
    })
    it('TPE 代碼', () => {
      expect(addressToZone('TPE')).toBe('AIRPORT_TPE')
    })
    it('桃園機場第一航廈', () => {
      expect(addressToZone('桃園國際機場第一航廈')).toBe('AIRPORT_TPE')
    })
    it('桃園機場第二航廈', () => {
      expect(addressToZone('桃園國際機場第二航廈')).toBe('AIRPORT_TPE')
    })
    it('松山機場 full name', () => {
      expect(addressToZone('松山機場')).toBe('AIRPORT_TSA')
    })
    it('松機 簡寫', () => {
      expect(addressToZone('松機')).toBe('AIRPORT_TSA')
    })
    it('TSA 代碼', () => {
      expect(addressToZone('TSA')).toBe('AIRPORT_TSA')
    })
    it('清泉崗', () => {
      expect(addressToZone('清泉崗機場')).toBe('AIRPORT_RMQ')
    })
    it('小港機場', () => {
      expect(addressToZone('小港機場')).toBe('AIRPORT_KHH')
    })
  })

  // === 台北市 ===
  describe('台北市行政區', () => {
    it('大安區', () => {
      expect(addressToZone('大安區')).toBe('TPE_EAST')
    })
    it('信義區', () => {
      expect(addressToZone('信義區')).toBe('TPE_EAST')
    })
    it('松山區', () => {
      expect(addressToZone('松山區')).toBe('TPE_EAST')
    })
    it('新北市板橋區', () => {
      expect(addressToZone('新北市板橋區中山路')).toBe('NTPE_WEST')
    })
    it('台北市中山區南京西路', () => {
      expect(addressToZone('台北市中山區南京西路')).toBe('TPE_WEST')
    })
    it('士林區', () => {
      expect(addressToZone('士林區')).toBe('TPE_NORTH')
    })
    it('北投區', () => {
      expect(addressToZone('北投區')).toBe('TPE_NORTH')
    })
    it('內湖區', () => {
      expect(addressToZone('內湖區')).toBe('TPE_NORTHEAST')
    })
    it('南港區', () => {
      expect(addressToZone('南港區')).toBe('TPE_NORTHEAST')
    })
    it('文山區', () => {
      expect(addressToZone('文山區')).toBe('TPE_SOUTH')
    })
  })

  // === 新北市 ===
  describe('新北市行政區', () => {
    it('板橋區', () => {
      expect(addressToZone('板橋區')).toBe('NTPE_WEST')
    })
    it('中和區', () => {
      expect(addressToZone('中和區')).toBe('NTPE_WEST')
    })
    it('永和區', () => {
      expect(addressToZone('永和區')).toBe('NTPE_WEST')
    })
    it('三重區', () => {
      expect(addressToZone('三重區')).toBe('NTPE_NORTHWEST')
    })
    it('新莊區', () => {
      expect(addressToZone('新莊區')).toBe('NTPE_NORTHWEST')
    })
    it('新店區', () => {
      expect(addressToZone('新店區')).toBe('NTPE_EAST')
    })
    it('林口區', () => {
      expect(addressToZone('林口區')).toBe('NTPE_WESTEXT')
    })
    it('淡水區', () => {
      expect(addressToZone('淡水區')).toBe('NTPE_COASTAL')
    })
    it('汐止區', () => {
      expect(addressToZone('汐止區')).toBe('NTPE_NORTHEAST')
    })
  })

  // === 基隆市 ===
  describe('基隆市行政區', () => {
    it('基隆市仁愛區', () => {
      expect(addressToZone('基隆市仁愛區')).toBe('NTPE_COASTAL')
    })
    it('基隆市中正區', () => {
      expect(addressToZone('基隆市中正區')).toBe('NTPE_COASTAL')
    })
    it('基隆市暖暖區', () => {
      expect(addressToZone('基隆市暖暖區')).toBe('NTPE_COASTAL')
    })
    it('基隆市中山區', () => {
      expect(addressToZone('基隆市中山區')).toBe('NTPE_COASTAL')
    })
    it('暖暖區（無城市前綴）', () => {
      // 暖暖區屬 NTPE_COASTAL（北海岸），根據 gogmo-zones-matrix.md
      expect(addressToZone('暖暖區')).toBe('NTPE_COASTAL')
    })
  })

  // === 其他縣市 ===
  describe('其他縣市', () => {
    it('宜蘭縣礁溪鄉', () => {
      expect(addressToZone('礁溪鄉')).toBe('YILAN_NORTH')
    })
    it('宜蘭市（宜蘭縣市區）', () => {
      expect(addressToZone('宜蘭市')).toBe('YILAN_NORTH')
    })
    it('新竹市', () => {
      expect(addressToZone('新竹市')).toBe('HSINCHU')
    })
    it('苗栗市', () => {
      expect(addressToZone('苗栗市')).toBe('MIAOLI')
    })
  })

  // === 邊界與失敗 ===
  describe('邊界與失敗', () => {
    it('花蓮市 → OTHER（不支援）', () => {
      expect(addressToZone('花蓮市')).toBe(null)
    })
    it('台東市 → OTHER（不支援）', () => {
      expect(addressToZone('台東市')).toBe(null)
    })
    it('空字串 → null', () => {
      expect(addressToZone('')).toBe(null)
    })
    it('完全不認得的地址 → null', () => {
      expect(addressToZone('asdfghjkl')).toBe(null)
    })
    it('只有數字 → null', () => {
      expect(addressToZone('12345')).toBe(null)
    })
  })
})

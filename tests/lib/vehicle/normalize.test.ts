import { describe, it, expect } from 'vitest'
import { normalizeVehicleInput } from '@/lib/vehicle/normalize'
import { VehicleType, RequirementLevel } from '@/lib/vehicle/types'

describe('normalizeVehicleInput', () => {
  it('空值回傳未指定', () => {
    expect(normalizeVehicleInput('')).toEqual({
      vehicleType: null,
      requirement: RequirementLevel.ANY,
      customVehicleNote: null,
    })
    expect(normalizeVehicleInput(null)).toEqual({
      vehicleType: null,
      requirement: RequirementLevel.ANY,
      customVehicleNote: null,
    })
    expect(normalizeVehicleInput(undefined)).toEqual({
      vehicleType: null,
      requirement: RequirementLevel.ANY,
      customVehicleNote: null,
    })
  })

  it('「任意R」轉為未指定', () => {
    const result = normalizeVehicleInput('任意R')
    expect(result.vehicleType).toBeNull()
    expect(result.requirement).toBe(RequirementLevel.ANY)
  })

  it('「any」轉為未指定', () => {
    const result = normalizeVehicleInput('any')
    expect(result.vehicleType).toBeNull()
    expect(result.requirement).toBe(RequirementLevel.ANY)
  })

  it('舊代號 small 轉為 SEDAN_5', () => {
    expect(normalizeVehicleInput('small').vehicleType).toBe(VehicleType.SEDAN_5)
  })

  it('舊代號 suv 轉為 SUV_5', () => {
    expect(normalizeVehicleInput('suv').vehicleType).toBe(VehicleType.SUV_5)
  })

  it('舊代號 small_suv 轉為 SUV_5', () => {
    expect(normalizeVehicleInput('small_suv').vehicleType).toBe(VehicleType.SUV_5)
  })

  it('舊代號 van7 轉為 MPV_7', () => {
    expect(normalizeVehicleInput('van7').vehicleType).toBe(VehicleType.MPV_7)
  })

  it('舊代號 van9 轉為 VAN_9', () => {
    expect(normalizeVehicleInput('van9').vehicleType).toBe(VehicleType.VAN_9)
  })

  it('中文「7人座」轉為 MPV_7', () => {
    expect(normalizeVehicleInput('7人座').vehicleType).toBe(VehicleType.MPV_7)
  })

  it('中文「9人座」轉為 VAN_9', () => {
    expect(normalizeVehicleInput('9人座').vehicleType).toBe(VehicleType.VAN_9)
  })

  it('Alphard 轉為 CUSTOM 並保留車款名稱', () => {
    const result = normalizeVehicleInput('Alphard')
    expect(result.vehicleType).toBe(VehicleType.CUSTOM)
    expect(result.customVehicleNote).toBe('Alphard')
  })

  it('VITO 轉為 CUSTOM 並保留車款名稱', () => {
    const result = normalizeVehicleInput('VITO')
    expect(result.vehicleType).toBe(VehicleType.CUSTOM)
    expect(result.customVehicleNote).toBe('VITO')
  })

  it('完全未知的字串視為 CUSTOM', () => {
    const result = normalizeVehicleInput('Tesla Model X 6 人座')
    expect(result.vehicleType).toBe(VehicleType.CUSTOM)
    expect(result.customVehicleNote).toBe('Tesla Model X 6 人座')
  })

  it('新標準代號 SEDAN_5 保持不變', () => {
    expect(normalizeVehicleInput('SEDAN_5').vehicleType).toBe(VehicleType.SEDAN_5)
  })

  it('新標準代號 MPV_7 保持不變', () => {
    expect(normalizeVehicleInput('MPV_7').vehicleType).toBe(VehicleType.MPV_7)
  })
})

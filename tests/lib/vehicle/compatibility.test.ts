import { describe, it, expect } from 'vitest'
import { isVehicleCompatible } from '@/lib/vehicle/compatibility'
import { VehicleType, RequirementLevel } from '@/lib/vehicle/types'

describe('isVehicleCompatible', () => {
  describe('EXACT 模式', () => {
    it('完全符合時可接', () => {
      expect(
        isVehicleCompatible(VehicleType.MPV_7, VehicleType.MPV_7, RequirementLevel.EXACT)
      ).toBe(true)
    })

    it('不符合時不可接', () => {
      expect(
        isVehicleCompatible(VehicleType.SEDAN_5, VehicleType.MPV_7, RequirementLevel.EXACT)
      ).toBe(false)
    })
  })

  describe('MIN 模式', () => {
    it('司機車型較高時可接', () => {
      expect(
        isVehicleCompatible(VehicleType.MPV_7, VehicleType.SEDAN_5, RequirementLevel.MIN)
      ).toBe(true)
    })

    it('司機車型較低時不可接', () => {
      expect(
        isVehicleCompatible(VehicleType.SEDAN_5, VehicleType.MPV_7, RequirementLevel.MIN)
      ).toBe(false)
    })

    it('同等級可接', () => {
      expect(
        isVehicleCompatible(VehicleType.SUV_5, VehicleType.SEDAN_5, RequirementLevel.MIN)
      ).toBe(true)
    })
  })

  describe('ANY 模式', () => {
    it('任何車型都可接', () => {
      expect(
        isVehicleCompatible(VehicleType.SEDAN_5, VehicleType.VAN_9, RequirementLevel.ANY)
      ).toBe(true)
      expect(
        isVehicleCompatible(VehicleType.VAN_9, VehicleType.SEDAN_5, RequirementLevel.ANY)
      ).toBe(true)
    })
  })

  describe('CUSTOM 模式', () => {
    it('CUSTOM 訂單僅 CUSTOM 司機可接', () => {
      expect(
        isVehicleCompatible(VehicleType.CUSTOM, VehicleType.CUSTOM, RequirementLevel.EXACT)
      ).toBe(true)
      expect(
        isVehicleCompatible(VehicleType.MPV_7, VehicleType.CUSTOM, RequirementLevel.ANY)
      ).toBe(false)
    })

    it('CUSTOM 司機僅能接 CUSTOM 訂單', () => {
      expect(
        isVehicleCompatible(VehicleType.CUSTOM, VehicleType.SEDAN_5, RequirementLevel.ANY)
      ).toBe(false)
    })
  })
})

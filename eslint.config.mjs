import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^(small|suv|van7|van9|small_sedan|small_suv|any_r)$/]",
          message: '禁止硬編碼舊車型代號。請使用 import { VehicleType } from "@/lib/vehicle" 並使用 VehicleType.SEDAN_5 等標準代號。',
        },
        {
          selector: "Literal[value=/^(小車|休旅|休旅車|7人座|9人座|VITO|GRANVIA|自填)$/]",
          message: '禁止硬編碼中文車型字串。請從 @/lib/vehicle 引入 VEHICLE_LABELS 顯示中文。',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/constants',
              importNames: ['VEHICLE_LABELS'],
              message: 'VEHICLE_LABELS 請從 @/lib/vehicle import',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/vehicle/**/*.ts', 'prisma/migrations/**/*.sql'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['src/lib/vehicle-compat.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    // constants.ts 有舊 VEHICLE_LABELS 定義，用於向後相容（舊資料顯示）
    files: ['src/lib/constants.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Legacy files with hardcoded vehicle strings (for backward compatibility during migration)
    files: [
      'src/app/api/orders/route.ts',
      'src/app/api/orders/[id]/route.ts',
      'src/app/api/orders/[id]/accept/route.ts',
      'src/app/api/orders/match/route.ts',
      'src/app/api/orders/parse/route.ts',
      'src/app/api/orders/[id]/transfer/route.ts',
      'src/app/api/orders/[id]/transfer-accept/route.ts',
      'src/app/api/dispatchers/settlement/route.ts',
      'src/app/api/drivers/pricing/route.ts',
      'src/app/dashboard/driver/page.tsx',
      'src/components/FlipboardGrid.tsx',
      'src/components/driver/SelfDispatchChat.tsx',
      'src/components/driver/SmartSchedulePanel.tsx',
      'src/components/book/QROrderChat.tsx',
      'src/app/dashboard/admin/users/page.tsx',
      'src/components/driver/ProfileTab.tsx',
      'src/components/driver/SquadTab.tsx',
      'src/components/dispatcher/FleetControl.tsx',
      'src/types/index.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]);

export default eslintConfig;
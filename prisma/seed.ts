// @ts-nocheck
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL!
const sslConnectionString = connectionString.includes('sslmode')
  ? connectionString.replace(/sslmode=[^&]*/g, 'sslmode=no-verify')
  : connectionString + (connectionString.includes('?') ? '&' : '?') + 'sslmode=no-verify'

const pool = new pg.Pool({ connectionString: sslConnectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

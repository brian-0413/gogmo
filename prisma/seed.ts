// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

let connectionString = process.env.DATABASE_URL
const url = new URL(connectionString!)
url.searchParams.set('sslmode', 'no-verify')
connectionString = url.toString()
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

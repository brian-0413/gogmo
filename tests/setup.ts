// Test setup — runs before all tests
// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-secret-key'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://vwvixbmnqbxfoyexuzvs.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Create authentication user for testing
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTestUser() {
  console.log('👤 Creating test user...')
  
  const testUser = {
    email: 'claude.test@gmail.com',
    password: 'test123456',
    name: 'テストユーザー'
  }
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: {
          name: testUser.name
        }
      }
    })
    
    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ Test user already exists')
        return true
      } else {
        console.error('❌ Error creating user:', error)
        return false
      }
    }
    
    console.log('✅ Test user created successfully:', data.user?.email)
    console.log('📧 Please check email for verification link (if email confirmation is enabled)')
    return true
  } catch (err) {
    console.error('❌ Error:', err)
    return false
  }
}

async function main() {
  await createTestUser()
  
  console.log('\n🔐 Test Login Credentials:')
  console.log('Email: claude.test@gmail.com')
  console.log('Password: test123456')
  console.log('\n🌐 Access the app at: http://localhost:5175')
}

main()
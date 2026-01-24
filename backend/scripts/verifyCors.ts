// backend/scripts/verifyCors.ts
import { getCorsConfig } from '../src/utils/corsConfig';

interface OriginTestResult {
  origin: string | null;
  allowed: boolean;
  error?: string;
}

const verifyCorsConfiguration = (): void => {
  console.log('YoScore CORS Configuration Verification');
  console.log('=======================================\n');
  
  const corsConfig = getCorsConfig();
  const frontendUrl = process.env.FRONTEND_URL;
  
  console.log('Configuration Details:');
  console.log(`- Frontend URL from env: ${frontendUrl}`);
  
  // Handle methods property safely
  if (Array.isArray(corsConfig.methods)) {
    console.log(`- Allowed methods: ${corsConfig.methods.join(', ')}`);
  } else if (typeof corsConfig.methods === 'string') {
    console.log(`- Allowed methods: ${corsConfig.methods}`);
  } else {
    console.log('- Allowed methods: Not specified');
  }
  
  console.log(`- Credentials allowed: ${corsConfig.credentials}`);
  console.log(`- Max age: ${corsConfig.maxAge} seconds\n`);
  
  // Test origins
  const testOrigins: (string | undefined)[] = [
    'http://localhost:8081',
    'http://localhost:3000',
    'http://malicious-site.com',
    undefined
  ];
  
  console.log('Origin Validation Tests:');
  console.log('------------------------');
  
  const testResults: OriginTestResult[] = [];
  
  testOrigins.forEach(testOrigin => {
    if (typeof corsConfig.origin === 'function') {
      corsConfig.origin(testOrigin, (err, allowed) => {
        const result: OriginTestResult = {
          origin: testOrigin || '(no origin)',
          allowed: !!allowed,
          error: err?.message
        };
        testResults.push(result);
        
        const status = allowed ? '✓ ALLOWED' : '✗ BLOCKED';
        const errorMsg = err ? ` - ${err.message}` : '';
        console.log(`  ${testOrigin || '(no origin)'}: ${status}${errorMsg}`);
      });
    } else if (corsConfig.origin === '*') {
      console.log(`  ${testOrigin || '(no origin)'}: ✓ ALLOWED (wildcard *)`);
    } else if (Array.isArray(corsConfig.origin)) {
      const isAllowed = corsConfig.origin.some(allowedOrigin => 
        allowedOrigin === testOrigin || 
        allowedOrigin === '*' || 
        (testOrigin && allowedOrigin instanceof RegExp && allowedOrigin.test(testOrigin))
      );
      const status = isAllowed ? '✓ ALLOWED' : '✗ BLOCKED';
      console.log(`  ${testOrigin || '(no origin)'}: ${status}`);
    } else {
      const isAllowed = corsConfig.origin === testOrigin || corsConfig.origin === '*';
      const status = isAllowed ? '✓ ALLOWED' : '✗ BLOCKED';
      console.log(`  ${testOrigin || '(no origin)'}: ${status}`);
    }
  });
  
  console.log('\nSummary:');
  console.log('--------');
  const allowedCount = testResults.filter(r => r.allowed).length;
  const blockedCount = testResults.filter(r => !r.allowed).length;
  console.log(`- Total tests: ${testResults.length}`);
  console.log(`- Allowed origins: ${allowedCount}`);
  console.log(`- Blocked origins: ${blockedCount}`);
  
  if (frontendUrl === 'http://localhost:8081') {
    console.log('\n✅ FRONTEND_URL correctly configured for port 8081');
  } else {
    console.log(`\n⚠️  FRONTEND_URL is set to: ${frontendUrl}`);
    console.log('   Expected: http://localhost:8081');
  }
};

if (require.main === module) {
  require('dotenv').config();
  verifyCorsConfiguration();
}

export { verifyCorsConfiguration };
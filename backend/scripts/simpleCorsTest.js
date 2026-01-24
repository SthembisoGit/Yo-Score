// backend/scripts/simpleCorsTest.js
require('dotenv').config();

console.log('YoScore CORS Simple Test');
console.log('========================\n');

console.log('Current Configuration:');
console.log(`- FRONTEND_URL: ${process.env.FRONTEND_URL}`);
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`- PORT: ${process.env.PORT || 3000}`);

console.log('\nExpected Behavior:');
console.log('- Requests from http://localhost:8081: ALLOWED');
console.log('- Requests from other origins: BLOCKED');
console.log('- Credentials: ALLOWED');

console.log('\nTo test manually, run these commands:');
console.log('1. curl -v http://localhost:3000/health');
console.log('2. curl -H "Origin: http://localhost:8081" -v http://localhost:3000/health');
console.log('3. curl -H "Origin: http://wrong-site.com" -v http://localhost:3000/health');
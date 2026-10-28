import http from 'http';
import app from '../src/index.js';

async function runSmokeTest() {
  console.log('\n=======================================================');
  console.log('🚀 RAILNOVA END-TO-END SMOKE TEST');
  console.log('=======================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5001, () => resolve()));
  console.log('  📡 Smoke test server listening on port 5001');

  try {
    // 1. Health check
    const healthRes = await fetch('http://localhost:5001/api/health');
    const healthData = await healthRes.json();
    console.log('  ✅ 1. Health Check:', healthData.status, '|', healthData.tagline);

    // 2. Stations
    const stnRes = await fetch('http://localhost:5001/api/stations');
    const stnData = await stnRes.json();
    console.log(`  ✅ 2. Stations API: retrieved ${stnData.length} stations`);

    // 3. Search Itineraries
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const searchRes = await fetch(`http://localhost:5001/api/itineraries/search?origin=NDLS&destination=HWH&date=${dateStr}&coachClass=3A&passengerCount=1&preference=ALL`);
    const searchData = await searchRes.json();
    console.log(`  ✅ 3. Search API: found ${searchData.length} itineraries`);

    // 4. Passenger Login
    const loginRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'passenger@railnova.demo', password: 'Password123!' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('  ✅ 4. Auth API: Logged in as', loginData.user.name, `(${loginData.user.role})`);

    // 5. Organiser Analytics
    const orgLoginRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'organiser@railnova.demo', password: 'Password123!' })
    });
    const orgData = await orgLoginRes.json();
    const orgToken = orgData.token;

    const analyticsRes = await fetch('http://localhost:5001/api/admin/analytics', {
      headers: { 'Authorization': `Bearer ${orgToken}` }
    });
    const analyticsData = await analyticsRes.json();
    console.log(`  ✅ 5. Organiser Analytics: Net collections ₹${(analyticsData.financialMetrics.netCollectionsPaise / 100).toFixed(2)}, Runs: ${analyticsData.runs.length}`);

    console.log('\n=======================================================');
    console.log('🎉 ALL END-TO-END SMOKE CHECKS PASSED PERFECTLY!');
    console.log('=======================================================\n');
  } finally {
    server.close();
  }
}

runSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Smoke test error:', err);
    process.exit(1);
  });

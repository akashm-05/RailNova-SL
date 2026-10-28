import bcrypt from 'bcryptjs';
import { getDb, withTransaction } from './connection.js';

export async function seedDatabase() {
  console.log('[RailNova Seed] Seeding deterministic demo data with South Indian network...');
  const db = await getDb();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Users
  const users = [
    { id: 'usr-pass-1', email: 'passenger@railnova.demo', name: 'Aarav Sharma', role: 'PASSENGER' },
    { id: 'usr-org-1', email: 'organiser@railnova.demo', name: 'Vikram Malhotra (NR)', role: 'ORGANISER' },
    { id: 'usr-org-2', email: 'organiser2@railnova.demo', name: 'Sunita Rao (CR)', role: 'ORGANISER' },
    { id: 'usr-pass-2', email: 'priya@railnova.demo', name: 'Priya Patel', role: 'PASSENGER' },
    { id: 'usr-pass-3', email: 'rajesh.iyer@railnova.demo', name: 'Rajesh Iyer', role: 'PASSENGER' },
    { id: 'usr-pass-4', email: 'ananya.s@railnova.demo', name: 'Ananya Swaminathan', role: 'PASSENGER' },
    { id: 'usr-pass-5', email: 'suresh.nair@railnova.demo', name: 'Suresh Nair', role: 'PASSENGER' },
    { id: 'usr-pass-6', email: 'karthik.reddy@railnova.demo', name: 'Karthik Reddy', role: 'PASSENGER' }
  ];

  for (const u of users) {
    await db.query(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET password_hash = $3, name = $4, role = $5
    `, [u.id, u.email, passwordHash, u.name, u.role]);
  }

  // 2. Comprehensive Station Network (North, East, Central, and South India)
  const stations = [
    // North & East
    { id: 'stn-ndls', code: 'NDLS', name: 'New Delhi', city: 'New Delhi', state: 'Delhi' },
    { id: 'stn-cnb', code: 'CNB', name: 'Kanpur Central', city: 'Kanpur', state: 'Uttar Pradesh' },
    { id: 'stn-pryj', code: 'PRYJ', name: 'Prayagraj Junction', city: 'Prayagraj', state: 'Uttar Pradesh' },
    { id: 'stn-ddu', code: 'DDU', name: 'Pt. Deen Dayal Upadhyaya', city: 'Varanasi', state: 'Uttar Pradesh' },
    { id: 'stn-hwh', code: 'HWH', name: 'Howrah Junction', city: 'Kolkata', state: 'West Bengal' },
    // Central Junctions
    { id: 'stn-bpl', code: 'BPL', name: 'Bhopal Junction', city: 'Bhopal', state: 'Madhya Pradesh' },
    { id: 'stn-ngp', code: 'NGP', name: 'Nagpur Junction', city: 'Nagpur', state: 'Maharashtra' },
    { id: 'stn-bza', code: 'BZA', name: 'Vijayawada Junction', city: 'Vijayawada', state: 'Andhra Pradesh' },
    // South India
    { id: 'stn-mas', code: 'MAS', name: 'MGR Chennai Central', city: 'Chennai', state: 'Tamil Nadu' },
    { id: 'stn-sbc', code: 'SBC', name: 'KSR Bengaluru City', city: 'Bengaluru', state: 'Karnataka' },
    { id: 'stn-sc', code: 'SC', name: 'Secunderabad Junction', city: 'Hyderabad', state: 'Telangana' },
    { id: 'stn-ers', code: 'ERS', name: 'Ernakulam Junction (South)', city: 'Kochi', state: 'Kerala' },
    { id: 'stn-cbe', code: 'CBE', name: 'Coimbatore Junction', city: 'Coimbatore', state: 'Tamil Nadu' }
  ];

  for (const s of stations) {
    await db.query(`
      INSERT INTO stations (id, code, name, city, state)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (code) DO UPDATE SET name = $3, city = $4, state = $5
    `, [s.id, s.code, s.name, s.city, s.state]);
  }

  // 3. Fare Rules
  const fareRules = [
    { id: 'fr-sl', class_code: 'SL', base_rate_per_km: 0.45, min_fare: 15000 },
    { id: 'fr-3a', class_code: '3A', base_rate_per_km: 1.15, min_fare: 50000 },
    { id: 'fr-2a', class_code: '2A', base_rate_per_km: 1.75, min_fare: 75000 },
    { id: 'fr-1a', class_code: '1A', base_rate_per_km: 2.80, min_fare: 125000 }
  ];

  for (const fr of fareRules) {
    await db.query(`
      INSERT INTO fare_rules (id, class_code, base_rate_per_km, min_fare, active)
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT (class_code) DO UPDATE SET base_rate_per_km = $3, min_fare = $4
    `, [fr.id, fr.class_code, fr.base_rate_per_km, fr.min_fare]);
  }

  // 4. Trains Fleet (North, East, and South India)
  const trains = [
    // 1. Rajdhani Express (Delhi -> Howrah)
    { id: 'trn-12301', num: '12301', name: 'RailNova Rajdhani Express', src: 'NDLS', dest: 'HWH', org: 'usr-org-1' },
    // 2. Eastern Connect Express (Prayagraj -> Howrah)
    { id: 'trn-12424', num: '12424', name: 'Eastern Connect Express', src: 'PRYJ', dest: 'HWH', org: 'usr-org-2' },
    // 3. Tamil Nadu Superfast Express (Delhi -> Chennai Central)
    { id: 'trn-12622', num: '12622', name: 'Tamil Nadu Superfast Express', src: 'NDLS', dest: 'MAS', org: 'usr-org-1' },
    // 4. Karnataka Superfast Express (Delhi -> Bengaluru SBC)
    { id: 'trn-12628', num: '12628', name: 'Karnataka Superfast Express', src: 'NDLS', dest: 'SBC', org: 'usr-org-1' },
    // 5. Chennai - Bengaluru Shatabdi Express (Chennai -> Bengaluru)
    { id: 'trn-12007', num: '12007', name: 'Chennai - Bengaluru Shatabdi Express', src: 'MAS', dest: 'SBC', org: 'usr-org-1' },
    // 6. Telangana Superfast Express (Delhi -> Secunderabad / Hyderabad)
    { id: 'trn-12724', num: '12724', name: 'Telangana Superfast Express', src: 'NDLS', dest: 'SC', org: 'usr-org-1' },
    // 7. Kerala Superfast Express (Delhi -> Ernakulam / Kochi)
    { id: 'trn-12626', num: '12626', name: 'Kerala Superfast Express', src: 'NDLS', dest: 'ERS', org: 'usr-org-1' },
    // 8. Northern Shuttle Express (Delhi -> Kanpur)
    { id: 'trn-12004', num: '12004', name: 'Northern Shuttle Express', src: 'NDLS', dest: 'CNB', org: 'usr-org-1' }
  ];

  for (const t of trains) {
    await db.query(`
      INSERT INTO trains (id, organiser_id, train_number, name, source_station_code, dest_station_code)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (train_number) DO UPDATE SET name = $4, source_station_code = $5, dest_station_code = $6
    `, [t.id, t.org, t.num, t.name, t.src, t.dest]);

    await db.query(`
      INSERT INTO routes (id, train_id, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `, [`rt-${t.num}`, t.id, `${t.name} Mainline Route`]);
  }

  // 5. Route Stops Config
  const routesData: Record<string, { stnId: string; km: number; dwell: number; change: boolean }[]> = {
    // 12301: NDLS -> CNB -> PRYJ -> DDU -> HWH
    'rt-12301': [
      { stnId: 'stn-ndls', km: 0, dwell: 0, change: true },
      { stnId: 'stn-cnb', km: 440, dwell: 10, change: true },
      { stnId: 'stn-pryj', km: 635, dwell: 15, change: true },
      { stnId: 'stn-ddu', km: 785, dwell: 5, change: false },
      { stnId: 'stn-hwh', km: 1450, dwell: 0, change: true }
    ],
    // 12424: PRYJ -> DDU -> HWH
    'rt-12424': [
      { stnId: 'stn-pryj', km: 0, dwell: 0, change: true },
      { stnId: 'stn-ddu', km: 150, dwell: 10, change: true },
      { stnId: 'stn-hwh', km: 815, dwell: 0, change: true }
    ],
    // 12622: Tamil Nadu Exp: NDLS -> BPL -> NGP -> BZA -> MAS
    'rt-12622': [
      { stnId: 'stn-ndls', km: 0, dwell: 0, change: true },
      { stnId: 'stn-bpl', km: 705, dwell: 10, change: true },
      { stnId: 'stn-ngp', km: 1095, dwell: 15, change: true },
      { stnId: 'stn-bza', km: 1760, dwell: 15, change: true },
      { stnId: 'stn-mas', km: 2185, dwell: 0, change: true }
    ],
    // 12628: Karnataka Exp: NDLS -> BPL -> NGP -> SBC
    'rt-12628': [
      { stnId: 'stn-ndls', km: 0, dwell: 0, change: true },
      { stnId: 'stn-bpl', km: 705, dwell: 10, change: true },
      { stnId: 'stn-ngp', km: 1095, dwell: 15, change: true },
      { stnId: 'stn-sbc', km: 2380, dwell: 0, change: true }
    ],
    // 12007: Chennai -> Bengaluru Shatabdi
    'rt-12007': [
      { stnId: 'stn-mas', km: 0, dwell: 0, change: true },
      { stnId: 'stn-sbc', km: 360, dwell: 0, change: true }
    ],
    // 12724: Telangana Exp: NDLS -> BPL -> NGP -> SC
    'rt-12724': [
      { stnId: 'stn-ndls', km: 0, dwell: 0, change: true },
      { stnId: 'stn-bpl', km: 705, dwell: 10, change: true },
      { stnId: 'stn-ngp', km: 1095, dwell: 15, change: true },
      { stnId: 'stn-sc', km: 1670, dwell: 0, change: true }
    ],
    // 12626: Kerala Exp: NDLS -> BPL -> NGP -> CBE -> ERS
    'rt-12626': [
      { stnId: 'stn-ndls', km: 0, dwell: 0, change: true },
      { stnId: 'stn-bpl', km: 705, dwell: 10, change: true },
      { stnId: 'stn-ngp', km: 1095, dwell: 15, change: true },
      { stnId: 'stn-cbe', km: 2380, dwell: 10, change: true },
      { stnId: 'stn-ers', km: 2600, dwell: 0, change: true }
    ],
    // 12004: Northern Shuttle: NDLS -> CNB
    'rt-12004': [
      { stnId: 'stn-ndls', km: 0, dwell: 0, change: true },
      { stnId: 'stn-cnb', km: 440, dwell: 0, change: true }
    ]
  };

  for (const [routeId, stops] of Object.entries(routesData)) {
    for (let seq = 0; seq < stops.length; seq++) {
      const s = stops[seq];
      await db.query(`
        INSERT INTO route_stops (id, route_id, station_id, stop_sequence, distance_km, default_dwell_minutes, is_change_permitted)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (route_id, stop_sequence) DO UPDATE SET distance_km = $5, is_change_permitted = $7
      `, [`stop-${routeId}-${seq}`, routeId, s.stnId, seq, s.km, s.dwell, s.change]);
    }
  }

  // 6. Generate Train Runs for Dynamic Dates (Today + next 6 days)
  const today = new Date();
  const dateStrings: string[] = [];
  for (let i = 0; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dateStrings.push(d.toISOString().split('T')[0]);
  }

  const activeTrainsForRuns = [
    { num: '12301', route: 'rt-12301', depHour: 6, durHours: 16.5 },
    { num: '12424', route: 'rt-12424', depHour: 14, durHours: 8.5 },
    { num: '12622', route: 'rt-12622', depHour: 22, durHours: 32 },  // Tamil Nadu Exp
    { num: '12628', route: 'rt-12628', depHour: 20, durHours: 36 },  // Karnataka Exp
    { num: '12007', route: 'rt-12007', depHour: 6, durHours: 4.8 },  // MAS -> SBC Shatabdi
    { num: '12724', route: 'rt-12724', depHour: 16, durHours: 24 },  // Telangana Exp
    { num: '12626', route: 'rt-12626', depHour: 11, durHours: 40 }   // Kerala Exp
  ];

  // Coach configuration: SL (48 seats), 3A (40 seats), 2A (24 seats), 1A (12 seats) for fast seeding
  const coaches = [
    { code: 'S1', type: 'SL', totalSeats: 48, fare: 52000 },
    { code: 'B1', type: '3A', totalSeats: 40, fare: 135000 },
    { code: 'A1', type: '2A', totalSeats: 24, fare: 195000 },
    { code: 'H1', type: '1A', totalSeats: 12, fare: 310000 }
  ];

  const getBerthType = (type: string, sNum: number) => {
    if (type === '1A') return 'CABIN';
    if (type === '2A') {
      const rem = sNum % 6;
      if (rem === 1 || rem === 3) return 'LOWER';
      if (rem === 2 || rem === 4) return 'UPPER';
      if (rem === 5) return 'SIDE_LOWER';
      return 'SIDE_UPPER';
    }
    const rem = sNum % 8;
    if (rem === 1 || rem === 4) return 'LOWER';
    if (rem === 2 || rem === 5) return 'MIDDLE';
    if (rem === 3 || rem === 6) return 'UPPER';
    if (rem === 7) return 'SIDE_LOWER';
    return 'SIDE_UPPER';
  };

  for (const dateStr of dateStrings) {
    for (const tInfo of activeTrainsForRuns) {
      const runId = `run-${tInfo.num}-${dateStr}`;

      await db.query(`
        INSERT INTO train_runs (id, train_id, route_id, run_date, status)
        VALUES ($1, $2, $3, $4, 'SCHEDULED')
        ON CONFLICT (train_id, run_date) DO UPDATE SET status = 'SCHEDULED'
      `, [runId, `trn-${tInfo.num}`, tInfo.route, dateStr]);

      // Populate run stops
      const routeStops = routesData[tInfo.route] || [];
      const baseTime = new Date(`${dateStr}T${String(tInfo.depHour).padStart(2, '0')}:00:00.000Z`).getTime();
      const totalKm = routeStops[routeStops.length - 1]?.km || 1000;

      for (let sIdx = 0; sIdx < routeStops.length; sIdx++) {
        const rs = routeStops[sIdx];
        const fraction = totalKm > 0 ? rs.km / totalKm : 0;
        const stopTimeMs = baseTime + fraction * (tInfo.durHours * 3600000);
        const arr = sIdx === 0 ? null : new Date(stopTimeMs);
        const dep = sIdx === routeStops.length - 1 ? null : new Date(stopTimeMs + (rs.dwell || 5) * 60000);

        await db.query(`
          INSERT INTO run_stops (id, run_id, station_id, stop_sequence, arrival_time, departure_time, distance_from_origin_km, is_change_permitted)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (run_id, stop_sequence) DO UPDATE SET arrival_time = $5, departure_time = $6
        `, [`rs-${runId}-${sIdx}`, runId, rs.stnId, sIdx, arr?.toISOString() || null, dep?.toISOString() || null, rs.km, rs.change]);
      }

      // Batch insert seats per coach for speed
      for (const coach of coaches) {
        const seatValues: string[] = [];
        const seatParams: any[] = [];
        let pIdx = 1;

        for (let sNum = 1; sNum <= coach.totalSeats; sNum++) {
          const berthType = getBerthType(coach.type, sNum);
          const seatId = `seat-${runId}-${coach.code}-${sNum}`;
          seatValues.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, false)`);
          seatParams.push(seatId, runId, coach.code, coach.type, sNum, berthType, coach.fare);
          pIdx += 7;
        }

        if (seatValues.length > 0) {
          await db.query(`
            INSERT INTO run_seats (id, run_id, coach_code, coach_type, seat_number, berth_type, base_fare, is_disabled)
            VALUES ${seatValues.join(', ')}
            ON CONFLICT (run_id, coach_code, seat_number) DO NOTHING
          `, seatParams);
        }
      }
    }
  }

  // 7. Seed Authentic Sample Bookings Across Services (North, Central, and South)
  const tomorrow = dateStrings[1];
  const sampleBookings = [
    {
      id: 'bk-south-1',
      pnr: 'RN-740192',
      userId: 'usr-pass-1',
      name: 'Aarav Sharma',
      age: 29,
      gender: 'M',
      runId: `run-12622-${tomorrow}`,
      trainNum: '12622',
      trainName: 'Tamil Nadu Superfast Express',
      from: 'NDLS',
      to: 'MAS',
      coach: 'B1',
      seatNum: 11,
      type: '3A',
      fare: 235000,
      journeyType: 'DIRECT'
    },
    {
      id: 'bk-south-2',
      pnr: 'RN-812394',
      userId: 'usr-pass-2',
      name: 'Priya Patel',
      age: 26,
      gender: 'F',
      runId: `run-12628-${tomorrow}`,
      trainNum: '12628',
      trainName: 'Karnataka Superfast Express',
      from: 'NDLS',
      to: 'SBC',
      coach: 'A1',
      seatNum: 5,
      type: '2A',
      fare: 295000,
      journeyType: 'DIRECT'
    },
    {
      id: 'bk-south-3',
      pnr: 'RN-529103',
      userId: 'usr-pass-3',
      name: 'Rajesh Iyer',
      age: 38,
      gender: 'M',
      runId: `run-12007-${tomorrow}`,
      trainNum: '12007',
      trainName: 'Chennai - Bengaluru Shatabdi Express',
      from: 'MAS',
      to: 'SBC',
      coach: 'B1',
      seatNum: 15,
      type: '3A',
      fare: 98000,
      journeyType: 'DIRECT'
    },
    {
      id: 'bk-north-1',
      pnr: 'RN-630291',
      userId: 'usr-pass-4',
      name: 'Ananya Swaminathan',
      age: 32,
      gender: 'F',
      runId: `run-12301-${tomorrow}`,
      trainNum: '12301',
      trainName: 'RailNova Rajdhani Express',
      from: 'NDLS',
      to: 'HWH',
      coach: 'B1',
      seatNum: 1,
      type: '3A',
      fare: 150000,
      journeyType: 'DIRECT'
    },
    {
      id: 'bk-kerala-1',
      pnr: 'RN-419283',
      userId: 'usr-pass-5',
      name: 'Suresh Nair',
      age: 44,
      gender: 'M',
      runId: `run-12626-${tomorrow}`,
      trainNum: '12626',
      trainName: 'Kerala Superfast Express',
      from: 'NDLS',
      to: 'ERS',
      coach: 'S1',
      seatNum: 21,
      type: 'SL',
      fare: 89000,
      journeyType: 'DIRECT'
    },
    {
      id: 'bk-telangana-1',
      pnr: 'RN-902184',
      userId: 'usr-pass-6',
      name: 'Karthik Reddy',
      age: 31,
      gender: 'M',
      runId: `run-12724-${tomorrow}`,
      trainNum: '12724',
      trainName: 'Telangana Superfast Express',
      from: 'NDLS',
      to: 'SC',
      coach: 'A1',
      seatNum: 14,
      type: '2A',
      fare: 210000,
      journeyType: 'DIRECT'
    }
  ];

  for (const bk of sampleBookings) {
    // 1. Booking record
    await db.query(`
      INSERT INTO bookings (id, reference, user_id, journey_type, status, total_amount, disruption_status)
      VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, 'NONE')
      ON CONFLICT (id) DO UPDATE SET status = 'CONFIRMED'
    `, [bk.id, bk.pnr, bk.userId, bk.journeyType, bk.fare]);

    // 2. Booking Leg
    await db.query(`
      INSERT INTO booking_legs (id, booking_id, leg_order, run_id, from_station_code, to_station_code, from_stop_seq, to_stop_seq, departure_time, arrival_time, leg_fare, coach_code)
      VALUES ($1, $2, 1, $3, $4, $5, 0, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6, $7)
      ON CONFLICT (booking_id, leg_order) DO NOTHING
    `, [`leg-${bk.id}`, bk.id, bk.runId, bk.from, bk.to, bk.fare, bk.coach]);

    // 3. Passenger
    await db.query(`
      INSERT INTO passengers (id, booking_id, full_name, age, gender)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `, [`pax-${bk.id}`, bk.id, bk.name, bk.age, bk.gender]);

    // 4. Seat Allocation
    const seatId = `seat-${bk.runId}-${bk.coach}-${bk.seatNum}`;
    await db.query(`
      INSERT INTO seat_allocations (id, booking_id, leg_id, passenger_id, run_seat_id, from_stop_seq, to_stop_seq, journey_interval, status)
      VALUES ($1, $2, $3, $4, $5, 0, 4, int4range(0, 4), 'CONFIRMED')
      ON CONFLICT (id) DO NOTHING
    `, [`sa-${bk.id}`, bk.id, `leg-${bk.id}`, `pax-${bk.id}`, seatId]);

    // 5. Payment Attempt
    await db.query(`
      INSERT INTO payment_attempts (id, booking_id, idempotency_key, amount, status, scenario, gateway_ref)
      VALUES ($1, $2, $3, $4, 'SUCCEEDED', 'SUCCESS', $5)
      ON CONFLICT (booking_id, idempotency_key) DO NOTHING
    `, [`pm-${bk.id}`, bk.id, `idem-${bk.pnr}`, bk.fare, `GATEWAY-${bk.pnr}`]);
  }

  // 8. Seed Audit Log baseline
  const auditEntries = [
    { action: 'NETWORK_INITIALIZED', entityType: 'SYSTEM', entityId: 'PAN_INDIA', outcome: 'SUCCESS', details: 'North, Central & South India railway corridors operational.' },
    { action: 'FLEET_EXPANDED', entityType: 'TRAIN', entityId: '12622', outcome: 'SUCCESS', details: 'Added 12622 Tamil Nadu Express (NDLS ➔ MAS).' },
    { action: 'FLEET_EXPANDED', entityType: 'TRAIN', entityId: '12628', outcome: 'SUCCESS', details: 'Added 12628 Karnataka Express (NDLS ➔ SBC).' },
    { action: 'FLEET_EXPANDED', entityType: 'TRAIN', entityId: '12007', outcome: 'SUCCESS', details: 'Added 12007 Shatabdi Express (MAS ➔ SBC).' },
    { action: 'FARE_MATRIX_SYNCHRONIZED', entityType: 'FARE_RULE', entityId: 'ALL', outcome: 'SUCCESS', details: 'Verified base distance rates for SL, 3A, 2A, 1A.' }
  ];

  for (let idx = 0; idx < auditEntries.length; idx++) {
    const a = auditEntries[idx];
    await db.query(`
      INSERT INTO audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, outcome, metadata, details, created_at)
      VALUES ($1, 'usr-org-1', 'Central Traffic Controller', $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP - interval '${(idx + 1) * 15} minutes')
      ON CONFLICT (id) DO NOTHING
    `, [`seed-audit-${idx}`, a.action, a.entityType, a.entityId, a.outcome, JSON.stringify({ verified: true }), a.details]);
  }

  console.log('[RailNova Seed] Deterministic Pan-India seed data successfully initialized.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

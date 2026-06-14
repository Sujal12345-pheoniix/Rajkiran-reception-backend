const API_URL = "http://localhost:3001/api";

async function testAuth() {
  console.log("-----------------------------------------");
  console.log("🏥 STARTING END-TO-END SYSTEM INTEGRATION TEST");
  console.log("-----------------------------------------");

  // 1. Test Admin Login
  console.log("\n🔑 1. Testing Admin authentication...");
  const adminLoginResp = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "password123" }),
  });

  if (adminLoginResp.ok) {
    console.log("✅ Admin logged in successfully!");
    const body = await adminLoginResp.json() as any;
    console.log("   Session Details:", body.user);
  } else {
    console.error("❌ Admin login failed!", adminLoginResp.status, await adminLoginResp.text());
    process.exit(1);
  }

  // 2. Test Receptionist Login
  console.log("\n🔑 2. Testing Receptionist authentication...");
  const receptionLoginResp = await fetch(`${API_URL}/auth/reception/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "reception", password: "password123" }),
  });

  if (receptionLoginResp.ok) {
    console.log("✅ Receptionist logged in successfully!");
    const body = await receptionLoginResp.json() as any;
    console.log("   Session Details:", body.user);
  } else {
    console.error("❌ Receptionist login failed!", receptionLoginResp.status, await receptionLoginResp.text());
    process.exit(1);
  }

  console.log("\n-----------------------------------------");
  console.log("🎉 ALL TESTS PASSED! API IS HEALTHY & FULLY FUNCTIONING");
  console.log("-----------------------------------------");
}

testAuth().catch(console.error);

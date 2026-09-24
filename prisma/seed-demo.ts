// Run with: npm run seed:demo
// Wipes the connected database and fills it with realistic fake data for a public demo.
// DO NOT run this against your real organization's database.
import { seedDemoData } from "../src/lib/demoSeed";

seedDemoData()
  .then((creds) => {
    console.log("Demo data seeded. Login with:");
    console.log(creds);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

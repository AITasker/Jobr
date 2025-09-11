import { seedJobs } from "./seedJobs";

async function main() {
  try {
    console.log("Starting database seeding...");
    await seedJobs();
    console.log("Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

main();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const problems = [
    {
      id: "two_sum",
      title: "1. Two Sum",
      description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.\n\nYou can return the answer in any order.\n\n**Example 1:**\nInput: `nums = [2,7,11,15], target = 9`\nOutput: `[0,1]`\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].\n\n**Constraints:**\n- `2 ≤ nums.length ≤ 10⁴`\n- `-10⁹ ≤ nums[i] ≤ 10⁹`\n- `-10⁹ ≤ target ≤ 10⁹`\n- Only one valid answer exists.",
      difficulty: "Easy",
      topic: "Arrays",
      testCases: [
        { input: "4\n2 7 11 15\n9", expected_output: "0 1" },
        { input: "3\n3 2 4\n6", expected_output: "1 2" },
        { input: "2\n3 3\n6", expected_output: "0 1" },
        { input: "5\n1 5 3 7 2\n9", expected_output: "1 4" },
        { input: "4\n-1 -2 -3 -4\n-6", expected_output: "1 3" },
      ]
    },
    {
      id: "reverse_string",
      title: "344. Reverse String",
      description: "Write a function that reverses a string. The input string is given as an array of characters `s`.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.\n\n**Example 1:**\nInput: `s = [\"h\",\"e\",\"l\",\"l\",\"o\"]`\nOutput: `[\"o\",\"l\",\"l\",\"e\",\"h\"]`\n\n**Constraints:**\n- `1 <= s.length <= 10^5`\n- `s[i]` is a printable ascii character.",
      difficulty: "Easy",
      topic: "Strings",
      testCases: [
        { input: "5\nh e l l o", expected_output: "o l l e h" },
        { input: "6\nH a n n a h", expected_output: "h a n n a H" }
      ]
    }
  ];

  for (const problem of problems) {
    await prisma.problem.upsert({
      where: { id: problem.id },
      update: problem,
      create: problem,
    });
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting to seed database...");

  // Optional: Clear existing problems to prevent duplicates if you run this multiple times
  await prisma.problem.deleteMany();
  console.log("Cleared existing problems.");

  const problems = [
    {
      title: "Add Two Integers",
      description: "Given two integers `a` and `b`, return their sum. \n\n**Input Format:** A single line containing two space-separated integers.\n**Output Format:** Print the integer sum.",
      difficulty: "Easy",
      topic: "Math",
      testCases: [
        { stdin: "12 5", expected_output: "17" },
        { stdin: "-10 4", expected_output: "-6" },
        { stdin: "0 0", expected_output: "0" }
      ]
    },
    {
      title: "Palindrome Number",
      description: "Given an integer `x`, print `true` if `x` is a palindrome, and `false` otherwise. \n\n**Input Format:** A single integer `x`.\n**Output Format:** Print the string `true` or `false`.",
      difficulty: "Easy",
      topic: "Math",
      testCases: [
        { stdin: "121", expected_output: "true" },
        { stdin: "-121", expected_output: "false" },
        { stdin: "10", expected_output: "false" }
      ]
    },
    {
      title: "Fibonacci Number",
      description: "The Fibonacci numbers form a sequence where each number is the sum of the two preceding ones, starting from 0 and 1. Given `n`, calculate `F(n)`. \n\n**Input Format:** A single integer `n`.\n**Output Format:** Print the `n`th Fibonacci integer.",
      difficulty: "Easy",
      topic: "Dynamic Programming",
      testCases: [
        { stdin: "2", expected_output: "1" },
        { stdin: "3", expected_output: "2" },
        { stdin: "4", expected_output: "3" },
        { stdin: "10", expected_output: "55" }
      ]
    },
    {
      title: "Valid Anagram",
      description: "Given two strings `s` and `t`, print `true` if `t` is an anagram of `s`, and `false` otherwise. \n\n**Input Format:** A single line with two space-separated strings.\n**Output Format:** Print `true` or `false`.",
      difficulty: "Easy",
      topic: "Strings",
      testCases: [
        { stdin: "anagram nagaram", expected_output: "true" },
        { stdin: "rat car", expected_output: "false" },
        { stdin: "listen silent", expected_output: "true" }
      ]
    },
    {
      title: "Maximum Subarray (Kadane's Algorithm)",
      description: "Given an integer array, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum. \n\n**Input Format:** The first line contains the integer `N` (size of array). The second line contains `N` space-separated integers.\n**Output Format:** Print the maximum sum integer.",
      difficulty: "Medium",
      topic: "Arrays",
      testCases: [
        { stdin: "9\n-2 1 -3 4 -1 2 1 -5 4", expected_output: "6" },
        { stdin: "1\n1", expected_output: "1" },
        { stdin: "5\n5 4 -1 7 8", expected_output: "23" },
        { stdin: "3\n-1 -2 -3", expected_output: "-1" }
      ]
    }
  ];

  for (const problem of problems) {
    const createdProblem = await prisma.problem.create({
      data: problem
    });
    console.log(`Created problem: ${createdProblem.title}`);
  }

  console.log("Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
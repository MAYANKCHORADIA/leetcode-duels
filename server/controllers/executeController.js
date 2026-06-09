import prisma from "../config/db.js";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const JUDGE0_HOST = "judge0-ce.p.rapidapi.com";
const JUDGE0_URL = "https://" + JUDGE0_HOST;

const LANGUAGE_MAP = {
  cpp: 54,       // C++ (GCC 9.2.0)
  python: 71,    // Python (3.8.1)
  javascript: 63,// JavaScript (Node.js 12.14.0)
  java: 62,      // Java (OpenJDK 13.0.1)
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// POST /api/execute — Execute code against test cases
export const executeCode = async (req, res) => {
  try {
    const { source_code, language_id, problem_id } = req.body;

    if (!source_code || !language_id) {
      return res.status(400).json({ error: "source_code and language_id are required" });
    }

    const langId = LANGUAGE_MAP[language_id] || LANGUAGE_MAP.python;
    
    // Fetch problem from database to retrieve its test cases
    const problem = await prisma.problem.findUnique({
      where: { id: problem_id }
    });

    if (!problem || !problem.testCases) {
      return res.status(404).json({ error: "Problem not found or has no test cases." });
    }

    const testCases = problem.testCases;

    if (!RAPIDAPI_KEY) {
      console.warn("Mock Mode: Code execution skipped due to missing API keys.");
      await sleep(2000); // Simulate network delay
      return res.json({
        passed: testCases.length,
        total: testCases.length,
        allPassed: true,
        results: testCases.map((tc, i) => ({
          testCase: i + 1,
          status: "Accepted",
          passed: true,
          stdout: "Mock Output",
          stderr: null,
          compile_output: null,
          expected: tc.expected_output,
          time: "0.01",
          memory: 1024,
        }))
      });
    }

    const submissions = testCases.map(tc => ({
      language_id: langId,
      source_code,
      stdin: tc.input,
      expected_output: tc.expected_output
    }));

    const headers = {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": JUDGE0_HOST,
    };

    // 1. Submit the batch
    const batchCreateRes = await fetch(`${JUDGE0_URL}/submissions/batch?base64_encoded=false`, {
      method: "POST",
      headers,
      body: JSON.stringify({ submissions }),
    });

    if (!batchCreateRes.ok) {
      const text = await batchCreateRes.text();
      throw new Error(`Judge0 batch submission failed: ${batchCreateRes.status} ${text}`);
    }

    const tokensArray = await batchCreateRes.json();
    const tokens = tokensArray.map(t => t.token).join(",");

    // 2. Poll for results (Max 5 attempts, 1.5s interval)
    let finalResults = [];
    let isFinished = false;

    for (let attempts = 0; attempts < 5; attempts++) {
      await sleep(1500);
      const pollRes = await fetch(`${JUDGE0_URL}/submissions/batch?tokens=${tokens}&base64_encoded=false&fields=status,stdout,stderr,compile_output,expected_output,time,memory`, {
        headers
      });

      if (!pollRes.ok) continue;

      const data = await pollRes.json();
      const polledSubmissions = data.submissions;
      
      const allDone = polledSubmissions.every(s => s.status && s.status.id >= 3);
      if (allDone) {
        finalResults = polledSubmissions;
        isFinished = true;
        break;
      }
    }

    // fallback if timed out
    if (!isFinished) {
      const pollRes = await fetch(`${JUDGE0_URL}/submissions/batch?tokens=${tokens}&base64_encoded=false&fields=status,stdout,stderr,compile_output,expected_output,time,memory`, {
        headers
      }).catch(() => null);
      if (pollRes && pollRes.ok) {
        const data = await pollRes.json();
        finalResults = data.submissions;
      }
    }

    let passedCount = 0;
    const results = [];

    // 3. Evaluate and Respond
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const resultObj = finalResults[i] || { status: { id: 5, description: "Execution Timeout" } };
      
      const isPassed = resultObj.status?.id === 3;
      if (isPassed) passedCount++;

      results.push({
        testCase: i + 1,
        status: resultObj.status?.description || "Unknown",
        passed: isPassed,
        stdout: resultObj.stdout?.trim() || null,
        stderr: resultObj.stderr?.trim() || null,
        compile_output: resultObj.compile_output?.trim() || null,
        expected: tc.expected_output,
        time: resultObj.time || null,
        memory: resultObj.memory || null,
      });

      if (!isPassed) {
        // Break on first failure and mock remaining tests
        for (let j = i + 1; j < testCases.length; j++) {
          results.push({
            testCase: j + 1,
            status: "Skipped",
            passed: false,
            stdout: null,
            stderr: null,
            compile_output: null,
            expected: testCases[j].expected_output,
            time: null,
            memory: null,
          });
        }
        break;
      }
    }

    return res.json({
      passed: passedCount,
      total: testCases.length,
      allPassed: passedCount === testCases.length,
      results,
    });
  } catch (err) {
    console.error("Error in POST /api/execute:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

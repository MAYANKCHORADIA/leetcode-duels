# Product Requirements Document (PRD): LeetCode Duels

## 1. Project Overview
LeetCode Duels is a real-time, competitive programming web application. Users challenge each other to solve algorithmic problems under timed conditions. The platform features live opponent progress tracking, secure code execution, and an Elo-based ranking system.

## 2. Detailed User Flow
1. **Onboarding:** User lands on the homepage. They are prompted to enter a `username` and `college_name`. This data is saved to the database, and a session is created (stored in local storage/cookies). Default Elo is set to 1200.
2. **Dashboard/Lobby:** User sees their current Elo, Match History, and two primary actions: "Create Room" or "Join Room".
3. **Room Creation:** User clicks "Create Room". A modal asks for:
   - Difficulty (Easy, Medium, Hard)
   - Topic (Arrays, DP, Graphs, etc.)
   - Time Limit (e.g., 15, 30, 45 minutes)
4. **Waiting Room:** The backend generates a unique `roomId`. The user is placed in a waiting room UI displaying a copyable invite link.
5. **Match Start:** Guest pastes the link and joins. The server verifies both players are present, fetches a random problem matching the criteria, and emits a `match_start` event with the problem payload.
6. **The Duel:** - Split-screen UI: Problem description (Left) / Monaco Code Editor (Right).
   - Live progress indicator shows opponent status (e.g., "Typing...", "Running Tests...", "Passed 2/5").
7. **Match Resolution:** A user clicks "Submit". The code is sent to Judge0. 
   - If all tests pass: The server declares this user the winner, calculates new Elo ratings, and redirects both users to the "Match Summary" screen.
   - If time runs out: The user with the most passed test cases wins.

## 3. Edge Cases & Error Handling Constraints
* **Disconnects:** If a user disconnects via Socket.io, they have a 60-second grace period to reconnect before automatically forfeiting the match.
* **Cheating Prevention:** The frontend must never hold the answers to hidden test cases. All code evaluation must happen securely via the backend communicating with Judge0.
* **Judge0 Timeouts:** If the Judge0 API takes longer than 10 seconds to respond, the UI must show a "Execution Timeout" error and allow the user to resubmit without penalty.
* **Routing:** Strictly use Next.js App Router (`/app` directory). Do not install react-router-dom.
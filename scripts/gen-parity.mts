import { writeFileSync } from "node:fs";
import { ask, answerToText } from "../src/lib/assistant";

const questions = [
  "",
  "What pressure was BASS-II run at?",
  "What oxygen did BASS2-B1 report?",
  "Does the corpus include partial-gravity data?",
  "Compare BASS-II and Saffire-I.",
  "What did LUCI find?",
  "What materials are in the corpus?",
  "Which records are flagged suspect?",
  "What is missing from the corpus?",
  "Show the validation cross-check.",
  "Is this material safe in a lunar cabin?",
  "hello",
  "What flow did SAFFIRE1-S1 report?",
  "BASS2-B1",
];

const cases = questions.map((q) => {
  const answer = ask(q);
  return { question: q, answer, text: answerToText(answer) };
});

writeFileSync("backend/tests/fixtures/parity.json", JSON.stringify(cases, null, 2));
console.log("wrote", cases.length, "cases");

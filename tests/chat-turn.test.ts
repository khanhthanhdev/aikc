import assert from "node:assert/strict";
import test from "node:test";
import { getFallbackVideoQuery, isTutorialQuestion } from "~/lib/chat-turn";

test("how-to questions count as tutorial questions, with or without marks", () => {
  for (const question of [
    "Cách dùng ChatGPT để luyện nói tiếng Anh",
    "cach su dung notion cho nguoi moi",
    "Hướng dẫn dùng Perplexity",
    "Làm sao để dùng Gamma tạo slide nhanh?",
    "Làm thế nào để sử dụng Zotero?",
    "Bắt đầu với Canva như thế nào?",
    "Có video hướng dẫn dùng Quizlet không?",
    "How to use GitHub Copilot in VS Code?",
    "How do I get started with Zotero?",
    "Any Notion tutorial?",
  ]) {
    assert.equal(isTutorialQuestion(question), true, question);
  }
});

test("pricing, comparison and recommendation questions are not tutorials", () => {
  for (const question of [
    "Notion giá bao nhiêu?",
    "So sánh ChatGPT và Gemini",
    "Công cụ nào tốt nhất để viết luận?",
    "Phong cách viết của Claude thế nào?",
    "Is Grammarly free?",
    "What are alternatives to Canva?",
  ]) {
    assert.equal(isTutorialQuestion(question), false, question);
  }
});

test("fallback video query keeps the topic of a follow-up and the tool name", () => {
  assert.equal(
    getFallbackVideoQuery(["Notion là gì?", "Có video không?"]),
    "Notion là gì? Có video không?"
  );
  assert.equal(
    getFallbackVideoQuery(["a", "b", "Hướng dẫn dùng"], "Notion"),
    "Notion b Hướng dẫn dùng"
  );
  assert.equal(
    getFallbackVideoQuery(["Hướng dẫn dùng notion"], "Notion"),
    "Hướng dẫn dùng notion"
  );
  assert.equal(getFallbackVideoQuery(["x".repeat(500)]).length, 120);
});

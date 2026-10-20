import assert from "node:assert/strict";
import test from "node:test";
import {
  getFallbackVideoQuery,
  isToolOverviewQuestion,
  isTutorialQuestion,
} from "~/lib/chat-turn";

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
    "How does Notion work?",
    "Notion hoạt động như thế nào?",
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

test("overview questions about a named library tool count", () => {
  const libraryToolNames = ["Perplexity", "Notion", "Zotero"];
  for (const question of [
    "What is Perplexity?",
    "What's Notion and how can it help me study?",
    "Tell me about Zotero",
    "What can Notion do?",
    "Perplexity là gì?",
    "Notion có những tính năng gì?",
    "Giới thiệu về Zotero",
  ]) {
    assert.equal(
      isToolOverviewQuestion(question, { libraryToolNames }),
      true,
      question
    );
  }
});

test("overview questions on a tool page count without naming the tool", () => {
  for (const question of [
    "What can this tool do?",
    "Công cụ này là gì?",
    "What are its main features?",
  ]) {
    assert.equal(
      isToolOverviewQuestion(question, { currentToolName: "Notion" }),
      true,
      question
    );
  }
});

test("overview questions need a tool and exclude pricing and comparisons", () => {
  const libraryToolNames = ["Perplexity", "Notion", "Canva"];
  for (const question of [
    "What is machine learning?",
    "What is the best tool for citations?",
    "What are alternatives to Canva?",
    "What is Notion's pricing?",
    "What is the difference between Notion and Perplexity?",
    "Notion giá bao nhiêu?",
    "So sánh Notion và Perplexity là gì?",
    "What is Notionary?",
  ]) {
    assert.equal(
      isToolOverviewQuestion(question, { libraryToolNames }),
      false,
      question
    );
  }
  assert.equal(
    isToolOverviewQuestion("Is it free?", { currentToolName: "Notion" }),
    false
  );
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

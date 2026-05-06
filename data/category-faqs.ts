import type { FAQItem } from "~/lib/json-ld/builders/faq";

type CategoryFAQData = Record<string, FAQItem[]>;

export const categoryFAQs: CategoryFAQData = {
  // Default FAQs for all categories
  default: [
    {
      question: "What are AI study and work tools?",
      answer:
        "AI study and work tools are software applications that leverage artificial intelligence to enhance productivity, learning, and efficiency in academic and professional settings. These tools help automate tasks, improve writing, assist with research, and optimize workflows.",
    },
    {
      question: "How do I choose the best tool for my needs?",
      answer:
        "Consider your specific use case, budget, required features, platform compatibility, and ease of use. Browse our categorized listings to find tools that match your requirements. Many tools offer free trials, so you can test before committing.",
    },
    {
      question: "Are these tools suitable for students?",
      answer:
        "Yes! Many tools in our directory are specifically designed for students or offer student discounts. They can help with research, writing, note-taking, project management, and exam preparation.",
    },
    {
      question: "Do I need technical skills to use these tools?",
      answer:
        "Most AI tools are designed to be user-friendly and require minimal technical knowledge. Many offer intuitive interfaces, tutorials, and customer support to help you get started quickly.",
    },
  ],

  // Category-specific FAQs
  writing: [
    {
      question: "What are the best AI writing tools for students?",
      answer:
        "The best AI writing tools for students include grammar checkers, essay assistants, and research aids that help improve writing quality, check for plagiarism, and enhance overall composition skills. Popular options include tools for paraphrasing, citation generation, and style improvements.",
    },
    {
      question: "Are AI writing tools free?",
      answer:
        "Many AI writing tools offer free tiers with basic features such as grammar checking and basic suggestions. Advanced capabilities like plagiarism detection, style improvements, and unlimited usage typically require paid subscriptions.",
    },
    {
      question: "Can AI writing tools help with academic papers?",
      answer:
        "Yes, AI writing tools can help with research, outlining, drafting, editing, and citation management for academic papers. However, always ensure your institution allows AI assistance and use these tools ethically to support your own work.",
    },
  ],

  productivity: [
    {
      question: "What are the best AI productivity tools?",
      answer:
        "The best AI productivity tools include task managers, note-taking apps, calendar assistants, and automation platforms that help streamline workflows, prioritize tasks, and save time on repetitive activities.",
    },
    {
      question: "How can AI improve my productivity?",
      answer:
        "AI can improve productivity by automating routine tasks, providing intelligent suggestions, organizing information, scheduling meetings, summarizing content, and helping you focus on high-value work.",
    },
  ],

  research: [
    {
      question: "What are AI research tools?",
      answer:
        "AI research tools help with literature reviews, data analysis, academic paper search, citation management, and summarization. They can quickly scan large volumes of academic papers and extract relevant insights.",
    },
    {
      question: "Can AI tools help with academic research?",
      answer:
        "Yes, AI tools can significantly accelerate academic research by helping you discover relevant papers, extract key findings, organize references, identify research gaps, and generate summaries. They complement but don't replace critical thinking and analysis.",
    },
  ],

  coding: [
    {
      question: "What are the best AI coding assistants?",
      answer:
        "The best AI coding assistants provide intelligent code completion, bug detection, code explanation, and refactoring suggestions. They support multiple programming languages and integrate with popular IDEs.",
    },
    {
      question: "Can AI help me learn to code?",
      answer:
        "Yes, AI coding tools can help beginners learn programming by explaining code, suggesting corrections, providing examples, and answering coding questions in real-time. They serve as interactive tutors available 24/7.",
    },
  ],

  "data-analysis": [
    {
      question: "What are AI data analysis tools?",
      answer:
        "AI data analysis tools help process, visualize, and interpret large datasets. They can automate data cleaning, perform statistical analysis, generate insights, create visualizations, and predict trends.",
    },
    {
      question: "Do I need coding skills to use AI data analysis tools?",
      answer:
        "Many modern AI data analysis tools offer no-code or low-code interfaces that allow you to analyze data through natural language queries and visual interfaces. However, some advanced tools may require programming knowledge for complex analyses.",
    },
  ],
};

export function getCategoryFAQs(categorySlug: string): FAQItem[] {
  return categoryFAQs[categorySlug] || categoryFAQs.default;
}

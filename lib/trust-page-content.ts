export type TrustPageName = "contact" | "privacy";

type TrustPageSection = {
  heading: string;
  paragraphs: readonly string[];
};

type LocalizedTrustPageContent = Record<"en" | "vi", readonly TrustPageSection[]>;

const trustPageContent: Record<TrustPageName, LocalizedTrustPageContent> = {
  contact: {
    en: [
      {
        heading: "Contact AI Knowledge Cloud",
        paragraphs: [
          "AI Knowledge Cloud is a curated directory of work and study tools developed with the VinUniversity Library. Use this page to reach the team about a published listing, a correction, a tool suggestion, access to a public page, or a question about how the directory presents information. We welcome specific, constructive reports because accurate tool details help students, researchers, staff, and AI systems make better use of the catalog.",
        ],
      },
      {
        heading: "Directory inquiries",
        paragraphs: [
          "Email hello@aikc.vn with the relevant page URL, the name of the tool or collection, and enough context for us to understand the request. If you are reporting an error, identify the information that appears incorrect and, where possible, link to a reliable source that supports the correction. If you are suggesting a new resource, explain its intended users, core capability, pricing model, and official website so the team can evaluate it consistently with the rest of the directory.",
        ],
      },
      {
        heading: "Institutional location",
        paragraphs: [
          "AI Knowledge Cloud is associated with VinUniversity at Vinhomes Ocean Park, Gia Lam Commune, Hanoi, Vietnam. VinUniversity publishes +84-24-7108-9779 as its general institutional telephone number. Email is the best contact channel for AI Knowledge Cloud directory questions because it lets the team review the relevant URLs and supporting details. Questions about a third-party tool's account, billing, availability, or support should go directly to that tool's provider.",
        ],
      },
    ],
    vi: [
      {
        heading: "Liên hệ AI Knowledge Cloud",
        paragraphs: [
          "AI Knowledge Cloud là thư mục công cụ học tập và làm việc được tuyển chọn, phát triển cùng Thư viện VinUniversity. Bạn có thể liên hệ với nhóm về một mục đã xuất bản, thông tin cần chỉnh sửa, đề xuất công cụ, quyền truy cập một trang công khai hoặc câu hỏi về cách thư mục trình bày thông tin. Những báo cáo cụ thể và có căn cứ giúp sinh viên, nhà nghiên cứu, nhân viên và các hệ thống AI sử dụng danh mục chính xác hơn.",
        ],
      },
      {
        heading: "Câu hỏi về thư mục",
        paragraphs: [
          "Hãy gửi email đến hello@aikc.vn, kèm URL trang liên quan, tên công cụ hoặc bộ sưu tập và bối cảnh cần thiết để nhóm hiểu yêu cầu. Khi báo lỗi, vui lòng nêu rõ thông tin chưa đúng và, nếu có thể, cung cấp liên kết đến nguồn đáng tin cậy. Khi đề xuất tài nguyên mới, hãy mô tả người dùng dự kiến, khả năng chính, mô hình giá và website chính thức để nhóm có thể đánh giá nhất quán với các mục khác trong thư mục.",
        ],
      },
      {
        heading: "Địa chỉ tổ chức",
        paragraphs: [
          "AI Knowledge Cloud gắn với VinUniversity tại Vinhomes Ocean Park, xã Gia Lâm, Hà Nội, Việt Nam. VinUniversity công bố +84-24-7108-9779 là số điện thoại liên hệ chung của tổ chức. Email là kênh phù hợp nhất cho các câu hỏi về thư mục AI Knowledge Cloud vì nhóm có thể xem xét URL và thông tin hỗ trợ đi kèm. Với vấn đề về tài khoản, thanh toán, tính khả dụng hoặc hỗ trợ của công cụ bên thứ ba, bạn nên liên hệ trực tiếp với nhà cung cấp công cụ đó.",
        ],
      },
    ],
  },
  privacy: {
    en: [
      {
        heading: "Purpose of this policy",
        paragraphs: [
          "AI Knowledge Cloud is a public directory of work and study tools. This Privacy Policy explains how information connected to this website is handled when you browse public catalog pages, contact the team, submit a tool for review, report an issue, or use an authorized administrative area. It is intended to make the site easier to evaluate and to give visitors a clear place to find the privacy terms that apply to their interactions with AI Knowledge Cloud.",
        ],
      },
      {
        heading: "Information related to your request",
        paragraphs: [
          "When you choose to contact us, submit a listing, or report a problem, your message can include your email address and the information you provide about the request. Please include only information that is relevant to the directory and avoid sending sensitive personal information. Authorized administrators may use account and session information to protect the publishing workflow, manage catalog content, and investigate misuse or security issues. Public tool listings are intended to describe services, not to publish personal data.",
        ],
      },
      {
        heading: "Use, links, and retention",
        paragraphs: [
          "Information supplied for a directory request is used to respond, review the request, improve listing accuracy, and keep the service secure. AI Knowledge Cloud links to independent tool providers; their websites, accounts, payments, and privacy practices are governed by their own terms. Review a provider's policy before sharing information or creating an account there. If you need to ask about information connected to an AI Knowledge Cloud request, email hello@aikc.vn with enough detail to identify the request without sending unnecessary sensitive data.",
        ],
      },
    ],
    vi: [
      {
        heading: "Mục đích của chính sách",
        paragraphs: [
          "AI Knowledge Cloud là thư mục công cụ học tập và làm việc công khai. Chính sách Quyền riêng tư này giải thích cách thông tin liên quan đến website được xử lý khi bạn xem trang danh mục công khai, liên hệ với nhóm, gửi công cụ để duyệt, báo cáo vấn đề hoặc sử dụng khu vực quản trị được ủy quyền. Mục tiêu là giúp website dễ đánh giá hơn và cung cấp cho người dùng một nơi rõ ràng để tìm các điều khoản quyền riêng tư áp dụng cho tương tác của họ với AI Knowledge Cloud.",
        ],
      },
      {
        heading: "Thông tin liên quan đến yêu cầu của bạn",
        paragraphs: [
          "Khi bạn chọn liên hệ, gửi một mục hoặc báo lỗi, tin nhắn có thể bao gồm địa chỉ email và thông tin bạn cung cấp về yêu cầu. Chỉ nên gửi thông tin liên quan đến thư mục và tránh gửi dữ liệu cá nhân nhạy cảm. Quản trị viên được ủy quyền có thể sử dụng thông tin tài khoản và phiên làm việc để bảo vệ quy trình xuất bản, quản lý nội dung danh mục và điều tra hành vi lạm dụng hoặc sự cố bảo mật. Các mục công cụ công khai nhằm mô tả dịch vụ, không nhằm công bố dữ liệu cá nhân.",
        ],
      },
      {
        heading: "Sử dụng, liên kết và lưu giữ",
        paragraphs: [
          "Thông tin được cung cấp cho một yêu cầu về thư mục được dùng để phản hồi, xem xét yêu cầu, cải thiện độ chính xác của mục và giữ an toàn cho dịch vụ. AI Knowledge Cloud liên kết đến các nhà cung cấp công cụ độc lập; website, tài khoản, thanh toán và thực hành quyền riêng tư của họ chịu sự điều chỉnh của điều khoản riêng. Hãy xem chính sách của nhà cung cấp trước khi chia sẻ thông tin hoặc tạo tài khoản. Nếu cần hỏi về dữ liệu liên quan đến yêu cầu AI Knowledge Cloud, hãy gửi email đến hello@aikc.vn với đủ chi tiết để nhận diện yêu cầu mà không gửi dữ liệu nhạy cảm không cần thiết.",
        ],
      },
    ],
  },
};

export const getTrustPageContent = (
  page: TrustPageName,
  locale: string
): readonly TrustPageSection[] => trustPageContent[page][locale === "vi" ? "vi" : "en"];

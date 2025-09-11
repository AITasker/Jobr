import { db } from "./db";
import { jobs } from "@shared/schema";

const jobData = [
  // Tech Jobs - Frontend
  {
    title: "Senior Frontend Developer",
    company: "TechCorp Solutions",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹15-25 LPA",
    description: "We are looking for an experienced Frontend Developer to join our dynamic team. You will be responsible for developing user-facing web applications using modern JavaScript frameworks, collaborating with designers and backend developers to create seamless user experiences.",
    requirements: ["React", "TypeScript", "Tailwind CSS", "Node.js", "5+ years experience", "REST APIs", "Git", "Agile methodology"]
  },
  {
    title: "React Developer",
    company: "StartupXYZ",
    location: "Mumbai, India",
    type: "Full-time",
    salary: "₹8-15 LPA",
    description: "Join our fast-growing startup to build cutting-edge web applications. Work with modern React ecosystem and contribute to product decisions. Great opportunity for growth in a dynamic environment.",
    requirements: ["React", "JavaScript", "HTML5", "CSS3", "Redux", "2+ years experience", "Webpack", "Jest"]
  },
  {
    title: "Frontend Engineer - Vue.js",
    company: "Digital Innovations",
    location: "Pune, India",
    type: "Contract",
    salary: "₹12-18 LPA",
    description: "Contract position for an experienced Vue.js developer to work on enterprise-level applications. Remote-friendly with occasional office visits required.",
    requirements: ["Vue.js", "JavaScript", "Vuex", "TypeScript", "3+ years experience", "Nuxt.js", "SASS"]
  },
  
  // Tech Jobs - Backend
  {
    title: "Node.js Backend Developer",
    company: "CloudTech Systems",
    location: "Hyderabad, India",
    type: "Full-time",
    salary: "₹12-20 LPA",
    description: "Build scalable backend services using Node.js and modern cloud technologies. Work with microservices architecture and contribute to system design decisions.",
    requirements: ["Node.js", "Express.js", "MongoDB", "PostgreSQL", "AWS", "Docker", "4+ years experience", "Microservices"]
  },
  {
    title: "Python Backend Engineer",
    company: "DataFlow Inc",
    location: "Chennai, India",
    type: "Full-time",
    salary: "₹10-18 LPA",
    description: "Develop robust backend systems using Python and Django. Work with data pipelines and API development in a collaborative environment.",
    requirements: ["Python", "Django", "PostgreSQL", "Redis", "Celery", "3+ years experience", "REST APIs", "Docker"]
  },
  {
    title: "Java Spring Boot Developer",
    company: "Enterprise Solutions",
    location: "Gurgaon, India",
    type: "Full-time",
    salary: "₹15-22 LPA",
    description: "Senior Java developer position working on enterprise applications. Experience with Spring ecosystem and cloud deployment required.",
    requirements: ["Java", "Spring Boot", "Spring Security", "MySQL", "Maven", "5+ years experience", "AWS", "Kubernetes"]
  },

  // Tech Jobs - Full Stack
  {
    title: "Full Stack Engineer",
    company: "InnovateTech",
    location: "Remote",
    type: "Full-time",
    salary: "₹12-20 LPA",
    description: "Build scalable web applications using modern technologies in a fast-paced startup environment. Full remote position with flexible working hours.",
    requirements: ["React", "Node.js", "MongoDB", "AWS", "3+ years experience", "TypeScript", "Docker", "GraphQL"]
  },
  {
    title: "Full Stack Developer - MERN",
    company: "WebSolutions Pro",
    location: "Noida, India",
    type: "Full-time",
    salary: "₹10-16 LPA",
    description: "Work on diverse client projects using MERN stack. Opportunity to work with various industries and technologies.",
    requirements: ["MongoDB", "Express.js", "React", "Node.js", "JavaScript", "2+ years experience", "Git", "Agile"]
  },

  // Tech Jobs - Mobile
  {
    title: "React Native Developer",
    company: "MobileFirst Technologies",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹12-18 LPA",
    description: "Develop cross-platform mobile applications using React Native. Work on consumer-facing apps with millions of users.",
    requirements: ["React Native", "JavaScript", "iOS", "Android", "Redux", "3+ years experience", "App Store deployment", "Firebase"]
  },
  {
    title: "Flutter Developer",
    company: "AppCrafters",
    location: "Mumbai, India",
    type: "Contract",
    salary: "₹15-20 LPA",
    description: "6-month contract to develop a high-performance mobile application using Flutter. Potential for extension based on performance.",
    requirements: ["Flutter", "Dart", "iOS", "Android", "State management", "2+ years experience", "API integration", "Git"]
  },
  {
    title: "iOS Developer",
    company: "Mobile Dynamics",
    location: "Pune, India",
    type: "Full-time",
    salary: "₹14-22 LPA",
    description: "Native iOS development using Swift. Work on consumer and enterprise applications with focus on performance and user experience.",
    requirements: ["Swift", "iOS SDK", "Xcode", "UIKit", "Core Data", "4+ years experience", "App Store", "RESTful APIs"]
  },

  // Tech Jobs - DevOps/Cloud
  {
    title: "DevOps Engineer",
    company: "CloudScale Solutions",
    location: "Hyderabad, India",
    type: "Full-time",
    salary: "₹16-25 LPA",
    description: "Manage cloud infrastructure and implement CI/CD pipelines. Work with modern DevOps tools and practices to ensure scalable deployments.",
    requirements: ["AWS", "Docker", "Kubernetes", "Jenkins", "Terraform", "4+ years experience", "Linux", "Python scripting"]
  },
  {
    title: "Site Reliability Engineer",
    company: "ScaleTech",
    location: "Remote",
    type: "Full-time",
    salary: "₹18-28 LPA",
    description: "Ensure reliability and performance of large-scale distributed systems. Remote position with global team collaboration.",
    requirements: ["AWS", "GCP", "Kubernetes", "Monitoring tools", "Python", "5+ years experience", "Incident management", "Automation"]
  },

  // Tech Jobs - Data/AI
  {
    title: "Data Scientist",
    company: "AI Innovations",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹20-30 LPA",
    description: "Work on machine learning models and data analysis for business insights. Collaborate with product teams to implement AI solutions.",
    requirements: ["Python", "Machine Learning", "TensorFlow", "Pandas", "SQL", "3+ years experience", "Statistics", "Data visualization"]
  },
  {
    title: "Machine Learning Engineer",
    company: "DeepTech Labs",
    location: "Chennai, India",
    type: "Full-time",
    salary: "₹18-28 LPA",
    description: "Build and deploy ML models in production environments. Work on cutting-edge AI projects with research opportunities.",
    requirements: ["Python", "PyTorch", "TensorFlow", "MLOps", "Docker", "4+ years experience", "AWS", "Model deployment"]
  },

  // Design Jobs
  {
    title: "Product Designer",
    company: "Design Studio",
    location: "Mumbai, India",
    type: "Contract",
    salary: "₹12-18 LPA",
    description: "Join our creative team to design intuitive user experiences for mobile and web applications. Work closely with product managers and developers.",
    requirements: ["Figma", "UI/UX Design", "Prototyping", "User Research", "3+ years experience", "Design systems", "Wireframing"]
  },
  {
    title: "UX/UI Designer",
    company: "UserCentric Design",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹10-15 LPA",
    description: "Create beautiful and functional user interfaces. Conduct user research and usability testing to improve product experiences.",
    requirements: ["Sketch", "Figma", "Adobe Creative Suite", "User research", "2+ years experience", "Prototyping", "HTML/CSS basics"]
  },
  {
    title: "Senior UX Designer",
    company: "DigitalCraft",
    location: "Pune, India",
    type: "Full-time",
    salary: "₹15-22 LPA",
    description: "Lead UX design initiatives for enterprise software. Mentor junior designers and collaborate with stakeholders across the organization.",
    requirements: ["UX Design", "Figma", "User research", "Usability testing", "5+ years experience", "Design leadership", "Stakeholder management"]
  },

  // Marketing Jobs
  {
    title: "Digital Marketing Manager",
    company: "GrowthHackers Inc",
    location: "Mumbai, India",
    type: "Full-time",
    salary: "₹8-15 LPA",
    description: "Lead digital marketing campaigns across multiple channels. Analyze performance metrics and optimize for growth.",
    requirements: ["Google Ads", "Facebook Ads", "SEO", "Google Analytics", "3+ years experience", "Content marketing", "A/B testing"]
  },
  {
    title: "Content Marketing Specialist",
    company: "ContentPro",
    location: "Remote",
    type: "Full-time",
    salary: "₹6-12 LPA",
    description: "Create engaging content across multiple formats and platforms. Remote position with flexible schedule and creative freedom.",
    requirements: ["Content writing", "SEO", "Social media", "WordPress", "2+ years experience", "Analytics", "Brand voice"]
  },
  {
    title: "Performance Marketing Lead",
    company: "AdTech Solutions",
    location: "Gurgaon, India",
    type: "Full-time",
    salary: "₹12-20 LPA",
    description: "Drive user acquisition through paid marketing channels. Manage large advertising budgets and optimize for ROI.",
    requirements: ["Google Ads", "Facebook Ads", "Performance marketing", "Data analysis", "4+ years experience", "Budget management", "Attribution modeling"]
  },

  // Sales Jobs
  {
    title: "Business Development Manager",
    company: "SalesPro Systems",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹10-18 LPA",
    description: "Drive business growth through strategic partnerships and client acquisition. Build relationships with enterprise clients.",
    requirements: ["B2B sales", "CRM software", "Negotiation", "Relationship building", "3+ years experience", "Enterprise sales", "Target achievement"]
  },
  {
    title: "Inside Sales Representative",
    company: "TechSales Inc",
    location: "Hyderabad, India",
    type: "Full-time",
    salary: "₹5-10 LPA",
    description: "Generate leads and close deals through phone and email outreach. Great opportunity for sales career growth.",
    requirements: ["Sales experience", "CRM", "Lead generation", "Communication skills", "1+ years experience", "Target oriented", "Phone sales"]
  },

  // Finance Jobs
  {
    title: "Financial Analyst",
    company: "FinanceFirst Corp",
    location: "Mumbai, India",
    type: "Full-time",
    salary: "₹8-15 LPA",
    description: "Analyze financial data and create reports for management decision making. Work with cross-functional teams on budgeting and forecasting.",
    requirements: ["Excel", "Financial modeling", "SQL", "PowerBI", "2+ years experience", "Financial analysis", "Reporting"]
  },
  {
    title: "Investment Banking Associate",
    company: "Capital Markets Ltd",
    location: "Mumbai, India",
    type: "Full-time",
    salary: "₹15-25 LPA",
    description: "Work on M&A transactions and capital raising activities. High-growth opportunity in investment banking.",
    requirements: ["Financial modeling", "Excel", "PowerPoint", "Investment banking", "3+ years experience", "Valuation", "Due diligence"]
  },

  // Healthcare Jobs
  {
    title: "Healthcare Data Analyst",
    company: "MedTech Solutions",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹10-16 LPA",
    description: "Analyze healthcare data to improve patient outcomes and operational efficiency. Work with medical professionals and technology teams.",
    requirements: ["SQL", "Python", "Healthcare analytics", "Data visualization", "2+ years experience", "Statistical analysis", "Healthcare domain"]
  },
  {
    title: "Telemedicine Product Manager",
    company: "HealthTech Innovations",
    location: "Chennai, India",
    type: "Full-time",
    salary: "₹18-25 LPA",
    description: "Lead product development for telemedicine platform. Work with doctors, patients, and technical teams to enhance healthcare delivery.",
    requirements: ["Product management", "Healthcare", "Agile", "User research", "4+ years experience", "Stakeholder management", "Regulatory knowledge"]
  },

  // Education Jobs
  {
    title: "EdTech Product Designer",
    company: "LearnTech",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹12-18 LPA",
    description: "Design educational experiences for online learning platform. Create engaging and effective user interfaces for students and educators.",
    requirements: ["UX/UI Design", "Figma", "Educational psychology", "User research", "3+ years experience", "Mobile design", "Accessibility"]
  },
  {
    title: "Content Developer - Technical Training",
    company: "SkillBuilder Academy",
    location: "Mumbai, India",
    type: "Contract",
    salary: "₹8-14 LPA",
    description: "Develop technical training content for programming courses. 12-month contract with possibility of extension.",
    requirements: ["Technical writing", "Programming knowledge", "Curriculum design", "Video creation", "2+ years experience", "Training delivery", "LMS"]
  },

  // E-commerce Jobs
  {
    title: "E-commerce Manager",
    company: "ShopTech Solutions",
    location: "Gurgaon, India",
    type: "Full-time",
    salary: "₹12-20 LPA",
    description: "Manage online marketplace operations and drive sales growth. Work with multiple channels including Amazon, Flipkart, and own website.",
    requirements: ["E-commerce", "Marketplace management", "Digital marketing", "Analytics", "3+ years experience", "Inventory management", "Amazon/Flipkart"]
  },
  {
    title: "Supply Chain Analyst",
    company: "LogiFlow Systems",
    location: "Chennai, India",
    type: "Full-time",
    salary: "₹8-15 LPA",
    description: "Optimize supply chain operations using data analysis and process improvement. Work with vendors, warehouses, and logistics partners.",
    requirements: ["Supply chain", "Excel", "SQL", "Process improvement", "2+ years experience", "Inventory management", "Analytics"]
  },

  // Gaming Jobs
  {
    title: "Game Developer - Unity",
    company: "GameStudio Pro",
    location: "Pune, India",
    type: "Full-time",
    salary: "₹10-18 LPA",
    description: "Develop mobile and PC games using Unity engine. Work on both original IP and client projects with creative freedom.",
    requirements: ["Unity", "C#", "Game development", "2D/3D graphics", "3+ years experience", "Mobile games", "Performance optimization"]
  },
  {
    title: "Game Designer",
    company: "Indie Game Studios",
    location: "Bangalore, India",
    type: "Contract",
    salary: "₹12-16 LPA",
    description: "Design game mechanics, levels, and user experience for indie games. 8-month contract with creative ownership opportunities.",
    requirements: ["Game design", "Level design", "Prototyping", "Unity basics", "2+ years experience", "Player psychology", "Documentation"]
  },

  // Consulting Jobs
  {
    title: "Management Consultant",
    company: "ConsultPro Services",
    location: "Mumbai, India",
    type: "Full-time",
    salary: "₹18-28 LPA",
    description: "Provide strategic consulting services to Fortune 500 companies. Travel required for client engagements.",
    requirements: ["Management consulting", "Strategy", "PowerPoint", "Excel", "MBA preferred", "4+ years experience", "Client management", "Problem solving"]
  },
  {
    title: "Technology Consultant",
    company: "TechConsult Inc",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹15-25 LPA",
    description: "Help clients with digital transformation initiatives. Work with enterprise technologies and provide technical expertise.",
    requirements: ["Technology consulting", "Enterprise software", "Project management", "Client communication", "5+ years experience", "Solution architecture", "Change management"]
  },

  // Startup Jobs
  {
    title: "Growth Hacker",
    company: "StartupBoost",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹8-15 LPA",
    description: "Drive user acquisition and retention for early-stage startup. Wear multiple hats and work in fast-paced environment with equity upside.",
    requirements: ["Growth hacking", "Digital marketing", "Analytics", "A/B testing", "2+ years experience", "Startup experience", "Data-driven mindset"]
  },
  {
    title: "Founding Engineer",
    company: "NextGen Startup",
    location: "Mumbai, India",
    type: "Full-time",
    salary: "₹10-18 LPA + Equity",
    description: "Join as founding engineer to build product from scratch. Significant equity stake and leadership opportunities.",
    requirements: ["Full stack development", "React", "Node.js", "AWS", "3+ years experience", "Startup mindset", "Leadership potential"]
  },

  // Remote/International
  {
    title: "Senior Software Engineer - Remote",
    company: "GlobalTech Corp",
    location: "Remote (India)",
    type: "Full-time",
    salary: "$60,000-$90,000",
    description: "Work with international team on global products. Full remote position with US company, competitive international compensation.",
    requirements: ["JavaScript", "React", "Node.js", "AWS", "5+ years experience", "Remote work experience", "English communication", "Timezone flexibility"]
  },
  {
    title: "DevOps Engineer - International Remote",
    company: "CloudGlobal Inc",
    location: "Remote (Worldwide)",
    type: "Full-time",
    salary: "$70,000-$110,000",
    description: "Manage global cloud infrastructure for international clients. Remote-first company with async communication culture.",
    requirements: ["AWS", "Kubernetes", "Terraform", "CI/CD", "4+ years experience", "English proficiency", "Remote collaboration", "On-call availability"]
  },

  // Freelance/Contract
  {
    title: "Freelance Web Developer",
    company: "Multiple Clients",
    location: "Remote",
    type: "Freelance",
    salary: "₹500-₹2000/hour",
    description: "Work on diverse web development projects for multiple clients. Flexible schedule and project-based compensation.",
    requirements: ["HTML", "CSS", "JavaScript", "WordPress", "2+ years experience", "Client communication", "Time management", "Portfolio"]
  },
  {
    title: "Contract UI/UX Designer",
    company: "Design Agency Network",
    location: "Mumbai, India",
    type: "Contract",
    salary: "₹15-25 LPA",
    description: "3-month contract with potential extension. Work on multiple client projects ranging from startups to enterprises.",
    requirements: ["Figma", "Adobe Creative Suite", "UI/UX", "Client presentation", "3+ years experience", "Agency experience", "Tight deadlines"]
  },

  // Entry Level Jobs
  {
    title: "Junior Frontend Developer",
    company: "TechTraining Corp",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹4-8 LPA",
    description: "Great opportunity for fresh graduates or developers with 1-2 years experience. Comprehensive training and mentorship provided.",
    requirements: ["HTML", "CSS", "JavaScript", "React basics", "0-2 years experience", "Learning attitude", "Computer Science degree", "Portfolio projects"]
  },
  {
    title: "Trainee Software Developer",
    company: "DevAcademy Systems",
    location: "Chennai, India",
    type: "Full-time",
    salary: "₹3-6 LPA",
    description: "6-month training program followed by full-time employment. Learn multiple technologies and work on real projects.",
    requirements: ["Programming basics", "Any language", "Fresh graduate", "Problem solving", "Communication skills", "Willingness to learn", "Team work"]
  },

  // Leadership/Management
  {
    title: "Engineering Manager",
    company: "TechLeadership Inc",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹25-40 LPA",
    description: "Lead engineering team of 8-12 developers. Drive technical decisions and mentor team members while contributing to code.",
    requirements: ["Engineering leadership", "Team management", "Technical expertise", "Agile", "7+ years experience", "Mentoring", "Strategic thinking", "Full stack knowledge"]
  },
  {
    title: "Product Manager - AI/ML",
    company: "AI Product Labs",
    location: "Mumbai, India",
    type: "Full-time",
    salary: "₹20-35 LPA",
    description: "Lead product development for AI-powered solutions. Work with data scientists, engineers, and business stakeholders.",
    requirements: ["Product management", "AI/ML understanding", "Agile", "Stakeholder management", "5+ years experience", "Data-driven decisions", "Technical background"]
  },

  // Quality Assurance
  {
    title: "QA Automation Engineer",
    company: "QualityFirst Systems",
    location: "Hyderabad, India",
    type: "Full-time",
    salary: "₹8-15 LPA",
    description: "Build and maintain automated testing frameworks. Ensure product quality through comprehensive testing strategies.",
    requirements: ["Test automation", "Selenium", "Java/Python", "CI/CD", "3+ years experience", "API testing", "Performance testing", "Bug tracking"]
  },
  {
    title: "Manual QA Tester",
    company: "TestPro Solutions",
    location: "Pune, India",
    type: "Contract",
    salary: "₹6-10 LPA",
    description: "6-month contract for comprehensive manual testing of web and mobile applications. Detail-oriented role with learning opportunities.",
    requirements: ["Manual testing", "Test cases", "Bug reporting", "Web testing", "1+ years experience", "Attention to detail", "Documentation", "JIRA"]
  },

  // Specialized/Niche
  {
    title: "Blockchain Developer",
    company: "CryptoTech Innovations",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹20-35 LPA",
    description: "Develop blockchain applications and smart contracts. Work on cutting-edge DeFi and Web3 projects.",
    requirements: ["Blockchain", "Solidity", "Ethereum", "Web3", "JavaScript", "2+ years experience", "Smart contracts", "DeFi protocols"]
  },
  {
    title: "Cybersecurity Analyst",
    company: "SecureNet Solutions",
    location: "Mumbai, India",
    type: "Full-time",
    salary: "₹15-25 LPA",
    description: "Monitor and protect organizational assets from cyber threats. Implement security measures and incident response.",
    requirements: ["Cybersecurity", "Network security", "SIEM tools", "Incident response", "3+ years experience", "Security certifications", "Risk assessment", "Compliance"]
  },

  // Recent/Trending
  {
    title: "ChatGPT Integration Specialist",
    company: "AI Integration Corp",
    location: "Remote",
    type: "Contract",
    salary: "₹18-28 LPA",
    description: "Integrate ChatGPT and other LLM models into business applications. High-demand role with cutting-edge AI technology.",
    requirements: ["OpenAI API", "LLM integration", "Python", "API development", "2+ years experience", "AI/ML basics", "Prompt engineering", "NLP"]
  },
  {
    title: "Prompt Engineer",
    company: "PromptCraft AI",
    location: "Bangalore, India",
    type: "Full-time",
    salary: "₹15-25 LPA",
    description: "Design and optimize prompts for various AI models. New and emerging role in the AI industry with high growth potential.",
    requirements: ["Prompt engineering", "AI models", "NLP", "Python", "1+ years experience", "Creative thinking", "Testing methodologies", "AI tools"]
  }
];

export async function seedJobs() {
  console.log("Starting to seed jobs...");
  
  try {
    // Clear existing jobs
    await db.delete(jobs);
    console.log("Cleared existing jobs");

    // Insert new jobs
    const insertedJobs = [];
    for (const job of jobData) {
      const [insertedJob] = await db.insert(jobs).values({
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        salary: job.salary,
        description: job.description,
        requirements: job.requirements,
        isActive: true,
        postedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
      }).returning();
      insertedJobs.push(insertedJob);
    }

    console.log(`Successfully seeded ${insertedJobs.length} jobs`);
    return insertedJobs;
  } catch (error) {
    console.error("Error seeding jobs:", error);
    throw error;
  }
}
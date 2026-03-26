import { GoogleGenAI, Type } from "@google/genai";
import { CareerAnalysis, Roadmap, CareerInsight, ChatMessage, WellnessLog, WellnessInsight, DailyQuizResponse, DailyTask, KnowledgeQuiz } from "../types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!GEMINI_API_KEY) {
    return null;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  return aiClient;
};

const buildFallbackDailyTasks = (goal: string, roadmapStage: string) => [
  {
    title: `Review ${goal} fundamentals`,
    description: `Spend 45 minutes revising the core concepts needed for the ${roadmapStage} stage.`,
    type: "ai-generated" as const,
  },
  {
    title: "Complete one focused practice session",
    description: "Work through one exercise, case, or coding problem and write down what slowed you down.",
    type: "ai-generated" as const,
  },
  {
    title: "Capture one portfolio takeaway",
    description: "Document one concrete learning and add it to your notes, portfolio, or roadmap tracker.",
    type: "ai-generated" as const,
  },
];

const buildFallbackIntegratedInsights = (
  quizzes: DailyQuizResponse[],
  tasks: any[]
): Array<{ title: string; summary: string; type: "improvement" | "strength" | "weakness" }> => {
  const recent = quizzes.slice(-5);
  const averageDifficulty = recent.length > 0
    ? recent.reduce((sum, quiz) => sum + (quiz.difficulty || 0), 0) / recent.length
    : 0;
  const averageFocus = recent.length > 0
    ? recent.reduce((sum, quiz) => sum + (quiz.focus || 0), 0) / recent.length
    : 0;
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return [
    {
      title: "Consistency snapshot",
      summary: `You completed ${completedTasks} of ${tasks.length} tracked tasks${tasks.length > 0 ? ` (${completionRate}%)` : ""}. Keep the same daily cadence before increasing workload.`,
      type: completionRate >= 60 ? "strength" : "improvement",
    },
    {
      title: "Difficulty pattern",
      summary: averageDifficulty >= 7
        ? "Recent check-ins show higher difficulty. Break harder topics into smaller drills before moving on."
        : "Recent difficulty is manageable. Use that headroom to add one more stretch task each week.",
      type: averageDifficulty >= 7 ? "weakness" : "strength",
    },
    {
      title: "Focus trend",
      summary: averageFocus >= 7
        ? "Your recent focus scores are solid. Preserve the same study environment and timing."
        : "Focus is inconsistent. Shorter sessions and clearer start/end goals will likely improve retention.",
      type: averageFocus >= 7 ? "strength" : "improvement",
    },
  ];
};

const buildFallbackWellnessCheckIn = () => ({
  studyTime: 4,
  focus: 7,
  rest: 7,
  breaks: 3,
  summary: "Logged with default values because Gemini is not configured.",
});

const buildFallbackWellnessInsights = (logs: WellnessLog[]): WellnessInsight[] => {
  const recent = logs.slice(-7);
  const avgFocus = recent.length ? recent.reduce((sum, log) => sum + log.focus, 0) / recent.length : 0;
  const avgRest = recent.length ? recent.reduce((sum, log) => sum + log.rest, 0) / recent.length : 0;

  return [
    {
      title: "Focus baseline",
      desc: avgFocus >= 7 ? "Focus has been stable. Protect the same study blocks." : "Focus has dipped. Reduce session length and remove one distraction before each study block.",
      type: avgFocus >= 7 ? "positive" : "neutral",
    },
    {
      title: "Recovery signal",
      desc: avgRest >= 7 ? "Rest looks supportive of progress." : "Rest quality is limiting consistency. Tighten your sleep window before increasing study hours.",
      type: avgRest >= 7 ? "positive" : "negative",
    },
    {
      title: "Break quality",
      desc: "Use timed breaks instead of unplanned pauses so effort stays repeatable across the week.",
      type: "neutral",
    },
  ];
};

const buildFallbackCareerAnalysis = (answers: Record<string, string>): CareerAnalysis => {
  const skills = (answers.skills || "").split(",").map((item) => item.trim()).filter(Boolean);
  const interests = (answers.interests || "").split(",").map((item) => item.trim()).filter(Boolean);
  const goal = answers.goals || answers.role || "target role";

  return {
    strengths: skills.slice(0, 4).length > 0 ? skills.slice(0, 4) : ["Curiosity", "Willingness to learn"],
    weaknesses: ["Needs clearer specialization", "Needs more project evidence"],
    careerFitScore: 72,
    suggestions: [
      {
        title: goal,
        matchScore: 72,
        description: `This path fits your stated interests in ${interests.slice(0, 2).join(", ") || "career growth"} and can be strengthened with more practical work samples.`,
        strengths: skills.slice(0, 3).length > 0 ? skills.slice(0, 3) : ["Adaptability"],
      },
    ],
  };
};

const buildFallbackRoadmap = (careerTitle: string): Roadmap => ({
  id: crypto.randomUUID(),
  uid: "",
  title: `${careerTitle} Roadmap`,
  description: `A practical 6-month plan to build toward ${careerTitle}.`,
  createdAt: new Date().toISOString(),
  months: [
    { month: 1, focus: "Foundations", goals: ["Learn core concepts", "Set study routine"], weeks: [{ week: 1, tasks: ["Review core concepts"] }, { week: 2, tasks: ["Take notes on key terminology"] }, { week: 3, tasks: ["Practice one basic exercise"] }, { week: 4, tasks: ["Summarize what you learned"] }] },
    { month: 2, focus: "Core tools", goals: ["Learn essential tools", "Apply them weekly"], weeks: [{ week: 1, tasks: ["Set up your tool stack"] }, { week: 2, tasks: ["Follow one hands-on tutorial"] }, { week: 3, tasks: ["Repeat the workflow without help"] }, { week: 4, tasks: ["Document your process"] }] },
    { month: 3, focus: "Mini projects", goals: ["Build 2 small projects"], weeks: [{ week: 1, tasks: ["Choose a mini-project idea"] }, { week: 2, tasks: ["Build version one"] }, { week: 3, tasks: ["Improve based on feedback"] }, { week: 4, tasks: ["Publish the result"] }] },
    { month: 4, focus: "Portfolio", goals: ["Show proof of work", "Write clear case studies"], weeks: [{ week: 1, tasks: ["Select best project"] }, { week: 2, tasks: ["Write project summary"] }, { week: 3, tasks: ["Polish screenshots or outputs"] }, { week: 4, tasks: ["Publish portfolio update"] }] },
    { month: 5, focus: "Market alignment", goals: ["Study job descriptions", "Close skill gaps"], weeks: [{ week: 1, tasks: ["Review 10 job descriptions"] }, { week: 2, tasks: ["List recurring skill requirements"] }, { week: 3, tasks: ["Close one important gap"] }, { week: 4, tasks: ["Update resume bullets"] }] },
    { month: 6, focus: "Interview readiness", goals: ["Practice interviews", "Refine pitch"], weeks: [{ week: 1, tasks: ["Prepare answers to common questions"] }, { week: 2, tasks: ["Run one mock interview"] }, { week: 3, tasks: ["Refine weak answers"] }, { week: 4, tasks: ["Apply to relevant roles"] }] },
  ],
});

const buildFallbackQuiz = (
  goal: string,
  roadmapTasks: string[],
  dailyTasks: string[],
  focusScore: number
): Omit<KnowledgeQuiz, "id" | "uid" | "date"> => {
  const topic = roadmapTasks[0] || dailyTasks[0] || `${goal} fundamentals`;
  const difficulty = focusScore > 80 ? "Advanced" : focusScore > 50 ? "Intermediate" : "Beginner";

  return {
    topic,
    difficulty,
    questions: [
      {
        question: `What is the best first step before starting a new ${goal} study session?`,
        options: ["Define one specific outcome", "Open random resources", "Skip planning", "Study without notes"],
        correctAnswer: 0,
        explanation: "A clear goal makes practice measurable and easier to review.",
      },
      {
        question: "How should you use a roadmap task after completing it once?",
        options: ["Ignore it forever", "Review what worked and what was unclear", "Delete all notes", "Only repeat easy parts"],
        correctAnswer: 1,
        explanation: "Reflection turns one-off effort into repeatable improvement.",
      },
      {
        question: "Which activity best strengthens retention?",
        options: ["Passive scrolling", "Rewriting without thinking", "Active recall and practice", "Skipping hard sections"],
        correctAnswer: 2,
        explanation: "Active recall creates stronger learning feedback than passive review.",
      },
      {
        question: "What is the most useful use of industry news in a roadmap?",
        options: ["Replace your plan every day", "Compare trends against your priority skills", "Only read headlines", "Ignore source quality"],
        correctAnswer: 1,
        explanation: "News should refine priorities, not constantly reset them.",
      },
      {
        question: "If focus is low, what is the better adjustment?",
        options: ["Study longer", "Add more tabs", "Shorten the session and narrow the goal", "Skip review"],
        correctAnswer: 2,
        explanation: "Reducing scope is usually a better recovery move than forcing more time.",
      },
    ],
  };
};

const buildFallbackMentorResponse = (message: string, context: string) => {
  const normalized = message.trim().toLowerCase();
  const contextMatch = context.match(/aiming for (.+?)\./i);
  const goal = contextMatch?.[1] || "your target role";

  if (!normalized) {
    return `Focus on one concrete step toward ${goal} today. Pick a 30-minute task, finish it, and note what blocked you.`;
  }

  if (/\b(hi|hello|hey)\b/.test(normalized)) {
    return `Hi. Let's keep this practical for ${goal}. Tell me one of these: a skill you want to improve, a project you are building, or a job target you want to prepare for.`;
  }

  if (/\b(roadmap|plan|next step|what should i do)\b/.test(normalized)) {
    return `For ${goal}, use this sequence: 1) pick one core skill, 2) do one focused practice task today, 3) write one proof-of-work note, 4) review one market signal from News Intelligence and adjust your roadmap only if it changes your priorities.`;
  }

  if (/\b(interview|resume|cv|job)\b/.test(normalized)) {
    return `For ${goal}, prioritize proof over volume. Update one resume bullet with a measurable result, prepare two interview stories using Situation-Action-Result, and align them to one job description before you apply.`;
  }

  if (/\b(stuck|confused|hard|difficult|problem)\b/.test(normalized)) {
    return `When you're stuck, narrow the task. Define the exact subproblem, spend 25 minutes on only that piece, then write down one thing you now understand and one question still open.`;
  }

  if (/\b(skill|learn|study|practice)\b/.test(normalized)) {
    return `Build momentum with a short loop: revise one concept, apply it in a small exercise, and summarize the takeaway in your own words. Repeat that cycle daily for ${goal}.`;
  }

  return `Here’s the practical move for ${goal}: turn your question into one task you can finish today, one artifact you can keep, and one metric you can review tomorrow. If you want, send your exact goal and I’ll turn it into a 3-step plan.`;
};

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = "https://newsapi.org/v2/everything";

type NewsApiArticle = {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  source?: {
    name?: string;
  };
};

const sanitizeDomain = (source: string) =>
  source
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "");

const buildNewsQuery = (goals: string[]) => {
  const goalTerms = goals
    .map((goal) => goal.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((goal) => `"${goal}"`);

  if (goalTerms.length === 0) {
    return 'career OR jobs OR hiring OR skills';
  }

  return `(${goalTerms.join(" OR ")}) AND (career OR jobs OR hiring OR skills OR industry OR market)`;
};

const inferImportance = (text: string): CareerInsight["importance"] => {
  const normalized = text.toLowerCase();
  if (/(layoff|recession|hiring freeze|visa|regulation|automation risk|downturn)/.test(normalized)) {
    return "high";
  }
  if (/(hiring|salary|ai|certification|trend|demand|remote|upskill)/.test(normalized)) {
    return "medium";
  }
  return "low";
};

const inferWarnings = (text: string): string[] => {
  const normalized = text.toLowerCase();
  const warnings: string[] = [];

  if (/(layoff|job cuts|downturn|hiring freeze)/.test(normalized)) {
    warnings.push("Track hiring volatility before committing to one niche.");
  }
  if (/(ai automation|automation|disruption)/.test(normalized)) {
    warnings.push("Prioritize skills that complement automation rather than repeat routine work.");
  }
  if (/(regulation|policy|visa)/.test(normalized)) {
    warnings.push("Watch for policy changes that can affect role availability.");
  }

  return warnings;
};

const inferSkills = (goals: string[], article: NewsApiArticle): string[] => {
  const sourceText = `${goals.join(" ")} ${article.title || ""} ${article.description || ""}`.toLowerCase();
  const keywordMap: Array<[string, string]> = [
    ["ai", "AI literacy"],
    ["machine learning", "Machine learning"],
    ["data", "Data analysis"],
    ["cloud", "Cloud platforms"],
    ["security", "Cybersecurity"],
    ["frontend", "Frontend development"],
    ["backend", "Backend development"],
    ["python", "Python"],
    ["javascript", "JavaScript"],
    ["react", "React"],
    ["product", "Product thinking"],
    ["design", "Design systems"],
    ["leadership", "Leadership"],
    ["communication", "Communication"],
  ];

  return keywordMap
    .filter(([needle]) => sourceText.includes(needle))
    .map(([, label]) => label)
    .slice(0, 4);
};

const buildNextStep = (article: NewsApiArticle, skills: string[]) => {
  if (skills.length > 0) {
    return `Read the source and note one takeaway for your roadmap, then practice ${skills[0]}.`;
  }
  if ((article.description || "").toLowerCase().includes("hiring")) {
    return "Read the source and compare the hiring signal with your current roadmap priorities.";
  }
  return "Read the source and note one relevant takeaway for your roadmap.";
};

const toCareerInsight = (goals: string[], article: NewsApiArticle): CareerInsight | null => {
  if (!article.title || !article.url) {
    return null;
  }

  const summary = article.description?.trim() || "Open the article for the latest update.";
  const combinedText = `${article.title} ${summary}`;
  const skills = inferSkills(goals, article);

  return {
    title: article.title,
    summary,
    importance: inferImportance(combinedText),
    trend: article.source?.name || "Latest update",
    skills,
    warnings: inferWarnings(combinedText),
    nextSteps: buildNextStep(article, skills),
    publishedAt: article.publishedAt,
    sources: [
      {
        title: article.source?.name || "Open article",
        url: article.url,
      },
    ],
  };
};

export const generateDailyTasks = async (
  quiz: Partial<DailyQuizResponse>, 
  goal: string, 
  roadmapStage: string
): Promise<Array<Omit<DailyTask, 'id' | 'uid' | 'date' | 'status'>>> => {
  const prompt = `Generate 3-5 daily tasks for a student aiming to become a ${goal}. 
  Current Roadmap Stage: ${roadmapStage}
  Recent Check-in: Studied ${quiz.studyHours}h on ${quiz.topic} with difficulty ${quiz.difficulty}/10 and focus ${quiz.focus}/10.
  
  Tasks should be actionable, specific, and help them overcome current difficulties or progress in their roadmap.
  Return a JSON array of objects with:
  - title: string
  - description: string
  - type: "ai-generated"
  `;

  const ai = getAiClient();
  if (!ai) {
    return buildFallbackDailyTasks(goal, roadmapStage);
  }
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["ai-generated"] }
          },
          required: ["title", "description", "type"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const generateIntegratedInsights = async (
  profile: any,
  quizzes: DailyQuizResponse[],
  tasks: any[]
): Promise<Array<{ title: string, summary: string, type: 'improvement' | 'strength' | 'weakness' }>> => {
  const ai = getAiClient();
  if (!ai) {
    return buildFallbackIntegratedInsights(quizzes, tasks);
  }

  const prompt = `Analyze the student's progress and provide 3 integrated AI insights.
  Profile: ${JSON.stringify(profile)}
  Recent Quizzes: ${JSON.stringify(quizzes.slice(-5))}
  Task Completion: ${tasks.filter(t => t.status === 'completed').length}/${tasks.length} tasks done.
  
  Detect:
  - Weak areas based on high difficulty scores in quizzes.
  - Consistency patterns.
  - Suggestions for improvement.
  
  Return a JSON array of objects with:
  - title: string
  - summary: string
  - type: "improvement" | "strength" | "weakness"
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["improvement", "strength", "weakness"] }
          },
          required: ["title", "summary", "type"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const processWellnessCheckIn = async (text: string): Promise<{ studyTime: number, focus: number, rest: number, breaks: number, summary: string }> => {
  const ai = getAiClient();
  if (!ai) {
    return buildFallbackWellnessCheckIn();
  }

  const prompt = `The user is checking in for their daily wellness log. 
  Extract the following metrics from their message:
  - studyTime (number of hours spent studying)
  - focus (focus level from 1-10)
  - rest (rest/sleep quality from 1-10)
  - breaks (number of breaks taken)
  - summary (a short, encouraging summary of their day)

  User message: "${text}"
  
  If a metric is not mentioned, estimate it reasonably based on the tone or context, or use neutral defaults (Study: 4, Focus: 7, Rest: 7, Breaks: 3).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          studyTime: { type: Type.NUMBER },
          focus: { type: Type.NUMBER },
          rest: { type: Type.NUMBER },
          breaks: { type: Type.NUMBER },
          summary: { type: Type.STRING }
        },
        required: ["studyTime", "focus", "rest", "breaks", "summary"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateWellnessInsights = async (logs: WellnessLog[]): Promise<WellnessInsight[]> => {
  const ai = getAiClient();
  if (!ai) {
    return buildFallbackWellnessInsights(logs);
  }

  const prompt = `Analyze the following wellness logs for a student and provide 3 actionable AI Growth Insights.
  Logs (last 7 days): ${JSON.stringify(logs)}
  
  Detect patterns such as:
  - Correlation between study hours and focus levels.
  - Impact of rest on productivity.
  - Effectiveness of breaks.
  
  Provide 3 insights, each with:
  - title: Short catchy title
  - desc: Detailed observation and a specific suggestion (e.g., Pomodoro, more sleep, consistent schedule)
  - type: "positive" | "neutral" | "negative"
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            desc: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["positive", "neutral", "negative"] }
          },
          required: ["title", "desc", "type"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const analyzeCareer = async (answers: Record<string, string>): Promise<CareerAnalysis> => {
  const ai = getAiClient();
  if (!ai) {
    return buildFallbackCareerAnalysis(answers);
  }

  const prompt = `Analyze the following career assessment answers and provide a detailed career analysis.
  Answers: ${JSON.stringify(answers)}
  
  Return a JSON object with:
  - strengths: string[]
  - weaknesses: string[]
  - careerFitScore: number (0-100)
  - suggestions: Array of { title: string, matchScore: number, description: string, strengths: string[] }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          careerFitScore: { type: Type.NUMBER },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                matchScore: { type: Type.NUMBER },
                description: { type: Type.STRING },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "matchScore", "description", "strengths"]
            }
          }
        },
        required: ["strengths", "weaknesses", "careerFitScore", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateRoadmap = async (careerTitle: string, currentSkills: string[]): Promise<Roadmap> => {
  const ai = getAiClient();
  if (!ai) {
    return buildFallbackRoadmap(careerTitle);
  }

  const prompt = `Generate a 6-month career roadmap for someone aiming to become a ${careerTitle}. 
  Current skills: ${currentSkills.join(", ")}.
  
  Return a JSON object with:
  - title: string
  - description: string
  - months: Array of { month: number, focus: string, goals: string[], weeks: Array of { week: number, tasks: string[] } }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          months: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                month: { type: Type.NUMBER },
                focus: { type: Type.STRING },
                goals: { type: Type.ARRAY, items: { type: Type.STRING } },
                weeks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      week: { type: Type.NUMBER },
                      tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["week", "tasks"]
                  }
                }
              },
              required: ["month", "focus", "goals", "weeks"]
            }
          }
        },
        required: ["title", "description", "months"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
};

export const fetchCareerNews = async (goals: string[], preferredSources?: string[]): Promise<CareerInsight[]> => {
  if (!NEWS_API_KEY) {
    console.warn("NEWS_API_KEY is missing. Returning an empty news list.");
    return [];
  }

  const params = new URLSearchParams({
    q: buildNewsQuery(goals),
    language: "en",
    sortBy: "publishedAt",
    pageSize: "6",
    searchIn: "title,description",
    apiKey: NEWS_API_KEY,
  });

  const domains = (preferredSources || [])
    .map(sanitizeDomain)
    .filter(Boolean)
    .slice(0, 10);

  if (domains.length > 0) {
    params.set("domains", domains.join(","));
  }

  const response = await fetch(`${NEWS_API_BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`News API request failed with status ${response.status}`);
  }

  const payload = await response.json() as { articles?: NewsApiArticle[] };
  const deduped = new Map<string, CareerInsight>();

  for (const article of payload.articles || []) {
    const insight = toCareerInsight(goals, article);
    if (!insight) continue;

    const key = `${insight.title}::${insight.sources[0]?.url || ""}`;
    if (!deduped.has(key)) {
      deduped.set(key, insight);
    }
  }

  return Array.from(deduped.values());
};

export const chatWithMentor = async (history: ChatMessage[], message: string, context: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) {
    return buildFallbackMentorResponse(message, context);
  }
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are ZAMOX AI Mentor, a career growth specialist. 
      Your goal is to provide short, actionable advice to students.
      Context about the user: ${context}
      Be encouraging, professional, and growth-oriented. 
      Use the "Plant -> Nurture -> Bloom" metaphor when appropriate.`
    }
  });

  // Convert history to Gemini format
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const response = await chat.sendMessage({
    message: message
  });

  return response.text || "I'm sorry, I couldn't process that.";
};

export const generateKnowledgeQuiz = async (
  goal: string,
  roadmapTasks: string[],
  dailyTasks: string[],
  focusScore: number
): Promise<Omit<KnowledgeQuiz, 'id' | 'uid' | 'date'>> => {
  const ai = getAiClient();
  if (!ai) {
    return buildFallbackQuiz(goal, roadmapTasks, dailyTasks, focusScore);
  }

  const difficulty = focusScore > 80 ? 'Advanced' : focusScore > 50 ? 'Intermediate' : 'Beginner';
  
  const prompt = `Generate a 5-question multiple choice quiz for a student aiming to become a ${goal}.
  Difficulty Level: ${difficulty} (based on Focus Score: ${focusScore}/100)
  Context:
  - Roadmap Tasks: ${roadmapTasks.join(", ")}
  - Daily Tasks: ${dailyTasks.join(", ")}
  
  The quiz should test their knowledge on these topics.
  Return a JSON object with:
  - topic: string
  - difficulty: string
  - questions: Array of { question: string, options: string[], correctAnswer: number (index), explanation: string }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        },
        required: ["topic", "difficulty", "questions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

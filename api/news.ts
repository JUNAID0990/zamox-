type NewsApiArticle = {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  source?: {
    name?: string;
  };
};

type CareerInsight = {
  title: string;
  summary: string;
  importance: "high" | "medium" | "low";
  trend: string;
  skills: string[];
  warnings: string[];
  nextSteps: string;
  publishedAt?: string;
  sources: { title: string; url: string }[];
};

const NEWS_API_BASE_URL = "https://newsapi.org/v2/everything";

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
    return "career OR jobs OR hiring OR skills";
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

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const newsApiKey = process.env.NEWS_API_KEY;
  if (!newsApiKey) {
    res.status(500).json({ error: "NEWS_API_KEY is missing", insights: [] });
    return;
  }

  const rawGoals = typeof req.query.goals === "string" ? req.query.goals : "";
  const rawSources = typeof req.query.sources === "string" ? req.query.sources : "";
  const goals = rawGoals.split("|").map((item) => item.trim()).filter(Boolean);
  const preferredSources = rawSources.split("|").map(sanitizeDomain).filter(Boolean).slice(0, 10);

  const params = new URLSearchParams({
    q: buildNewsQuery(goals),
    language: "en",
    sortBy: "publishedAt",
    pageSize: "6",
    searchIn: "title,description",
    apiKey: newsApiKey,
  });

  if (preferredSources.length > 0) {
    params.set("domains", preferredSources.join(","));
  }

  try {
    const response = await fetch(`${NEWS_API_BASE_URL}?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      res.status(response.status).json({
        error: payload?.message || `News API request failed with status ${response.status}`,
        insights: [],
      });
      return;
    }

    const deduped = new Map<string, CareerInsight>();
    for (const article of (payload.articles || []) as NewsApiArticle[]) {
      const insight = toCareerInsight(goals, article);
      if (!insight) continue;

      const key = `${insight.title}::${insight.sources[0]?.url || ""}`;
      if (!deduped.has(key)) {
        deduped.set(key, insight);
      }
    }

    res.status(200).json({ insights: Array.from(deduped.values()) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch news", insights: [] });
  }
}

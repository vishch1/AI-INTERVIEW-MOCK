import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

console.log(
  "Gemini key loaded:",
  !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
);
export async function POST(request: Request) {
  const { type, role, level, techstack, amount, userid } = await request.json();

  try {
    const { text: questions } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `,
    });
    let parsedQuestions;

      try {
        parsedQuestions = JSON.parse(questions);
      } catch {
        return Response.json(
          {
            success: false,
            error: "Gemini returned invalid JSON",
          },
          { status: 500 }
        );
      }


    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(",").map((t: string) => t.trim()),
      questions: parsedQuestions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };
   
    console.log("Saving interview...");
    console.log(interview);
    const docRef = await db.collection("interviews").add(interview);
    console.log("Interview saved:", docRef.id);
    return Response.json({ success: true, id: docRef.id }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },{ status: 500 });
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}


import cors from "cors";
import express from "express";
import { tavily } from "@tavily/core";
import { generateText, streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { middleware } from "./middleware";
import { prisma } from "./db";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./prompt";

const app = express();
app.use(express.json({ limit: "14mb" }));
app.use(cors({
    origin: "*",
    exposedHeaders: ["X-Conversation-Id"],
}));

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

// Signup

// Signin

// const res = prisma.user.create({
//     data:{
//         email:"hari@gmail.com",
//         provider:"Github",
//         name:"hari"
//     }
// })
// console.log(res)

// Past conversations get
app.get("/conversations", middleware, async (req, res) => {
    const conversations = await prisma.conversation.findMany({
        where: { userId: req.userId },
        include: { messages: true },
    });
    conversations.sort((first, second) => {
        const firstMessageId = Math.max(0, ...first.messages.map((message) => message.id));
        const secondMessageId = Math.max(0, ...second.messages.map((message) => message.id));
        return secondMessageId - firstMessageId;
    });

    res.json(conversations);
});

// Past conversation get
app.post("/conversation/:conversationId", middleware, async (req, res) => {
    const conversationId = req.params.conversationId;
    if (typeof conversationId !== "string") {
        res.status(400).json({ error: "Conversation id is required" });
        return;
    }

    const conversation = await prisma.conversation.findFirst({
        where: {
            id: conversationId,
            userId: req.userId,
        },
        include: { messages: true },
    });

    if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
    }

    res.json(conversation);
});

app.post("/witty_ask", middleware, async (req, res) => {
    //1)get the query from the user
    const query = req.body.query;
    if (typeof query !== "string" || !query.trim()) {
        res.status(400).json({ error: "Query is required" });
        return;
    }
    if (query.length > 10_000) {
        res.status(413).json({ error: "Query is too long" });
        return;
    }
    const image = req.body.image;
    if (image !== undefined && (typeof image !== "string" || !image.startsWith("data:image/"))) {
        res.status(400).json({ error: "Image must be a valid data URL" });
        return;
    }
    if (image && req.body.model !== "gemini") {
        res.status(400).json({ error: "Image questions require the Gemini model" });
        return;
    }
    if (image && image.length > 14 * 1024 * 1024) {
        res.status(413).json({ error: "Image must be smaller than 10 MB" });
        return;
    }

    try {
        //2*make sure user has access/credits to hit the end point
        //3*check if we have web search indexed for a similar query
        //4)if no we do web serarch to gather resources
        let conversationId = req.body.conversationId;
        const isNewConversation = typeof conversationId !== "string";
        if (typeof conversationId !== "string") {
            const conversation = await prisma.conversation.create({
                data: {
                    title: "New conversation",
                    slug: `${Date.now()}-${query.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                    userId: req.userId!,
                },
            });
            conversationId = conversation.id;
        } else {
            const conversation = await prisma.conversation.findFirst({
                where: {
                    id: conversationId,
                    userId: req.userId,
                },
            });

            if (!conversation) {
                res.status(404).json({ error: "Conversation not found" });
                return;
            }
        }
        res.setHeader("X-Conversation-Id", conversationId);

        await prisma.message.create({
            data: {
                content: query,
                role: "User",
                conversationId,
            },
        });

        const webSearchResponse = await client.search(query, {
            searchDepth: "advanced",
        });
        const webSearchResult = webSearchResponse.results;

        //5)do some context engineer on thte prompt+ web serach responses
        //6)hit the LLM and stream back the response
        //how do u hit the llm we can use vercel ai gatetway
        const prompt = PROMPT_TEMPLATE
            .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
            .replace("{{USER_QUERY}}", query);
        const selectedModel = req.body.model === "gemini"
            ? google("gemini-flash-lite-latest")
            : groq("openai/gpt-oss-120b");
        const result = streamText({
            model: selectedModel,
            ...(image
                ? {
                    messages: [{
                        role: "user" as const,
                        content: [
                            { type: "text" as const, text: prompt },
                            { type: "image" as const, image },
                        ],
                    }],
                }
                : { prompt }),
            system: SYSTEM_PROMPT,
        });

        let responseText = "";
        for await (const textPart of result.textStream) {
            //as we get the response to the user we have to stream it
            responseText += textPart;
            res.write(textPart);
        }

        // we use res.write to write to the event stream and we use res.end to close the event stream
        await prisma.message.create({
            data: {
                content: responseText,
                role: "Assistant",
                conversationId,
            },
        });

        if (isNewConversation) {
            try {
                const titleResult = await generateText({
                    model: selectedModel,
                    system: "Create concise conversation titles.",
                    prompt: `Summarize the assistant's first answer as a clear title in 3 to 8 words.
Do not use quotes, punctuation at the end, markdown, or generic words such as "Answer".
Return only the title.

Assistant answer:
${responseText}`,
                });
                const title = titleResult.text
                    .replace(/<[^>]+>/g, "")
                    .replace(/[*#"`]/g, "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 60);
                if (title) {
                    await prisma.conversation.update({
                        where: { id: conversationId },
                        data: { title },
                    });
                }
            } catch (titleError) {
                console.error("conversation title generation failed:", titleError);
            }
        }

        res.write("\n<SOURCES>\n");
        res.write(JSON.stringify(webSearchResult.map((result) => ({ result: result.url }))));
        res.end("\n</SOURCES>\n");
    } catch (error) {
        console.error("witty_ask failed:", error);
        if (!res.headersSent) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Could not complete the request",
            });
        } else {
            res.end();
        }
    }
});

//1) get the exisiting chat from the db
//2) forward the full history to the LLM
//2.5) Do context engineering here (like if initial message is too long then sumarize it and send it to the llm so cost reduces)
//3) stream the response to the user
app.post("/curl_ask/follow_up", middleware, async (req, res) => {
    const conversation = await prisma.conversation.findFirst({
        where: {
            id: req.body.conversationId,
            userId: req.userId,
        },
        include: { messages: true },
    });

    if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
    }

    res.json(conversation);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

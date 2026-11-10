import { createClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export async function middleware(req: Request, res: Response, next: NextFunction) {
    //the job of this route is when user sends us a request from frotned with a token we going to check with supabase if the guy is logged in what is their user it 
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token || !process.env.SUPABASE_API_SECRET || !process.env.SUPABASE_URL) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const client = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_API_SECRET,
    );
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const user = data.user;
    const email = user.email ?? `${user.id}@supabase.local`;
    const name = user.user_metadata.full_name ?? user.user_metadata.name ?? email;
    const provider = user.app_metadata.provider === "google" ? "Google" : "Github";

    await prisma.user.upsert({
        where: { id: user.id },
        create: {
            id: user.id,
            supabaseId: user.id,
            email,
            provider,
            name,
        },
        update: { email, provider, name },
    });

    req.userId = user.id;
    next();
}

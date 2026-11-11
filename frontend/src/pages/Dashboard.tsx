import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router";
import { createClient } from "../lib/client";
import { BACKEND_URL } from "../lib/config";

type Conversation = {
    id: string;
    title: string | null;
};

type ModelChoice = "groq" | "gemini";
type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

function CodeBlock({ language, code }: { language: string; code: string }) {
    const [copied, setCopied] = useState(false);

    async function copyCode() {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <div className="code-block">
            <div className="code-header">
                <span>{language || "code"}</span>
                <button onClick={copyCode}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <pre><code>{code}</code></pre>
        </div>
    );
}

function MarkdownTable({ lines }: { lines: string[] }) {
    const rows = lines
        .filter((line) => !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim()))
        .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
    const [header, ...body] = rows;

    if (!header || header.length === 0) {
        return null;
    }

    return (
        <div className="reply-table-wrapper">
            <table className="reply-table">
                <thead>
                    <tr>{header.map((cell, index) => <th key={index}><InlineMarkdown text={cell} /></th>)}</tr>
                </thead>
                <tbody>
                    {body.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {header.map((_, cellIndex) => (
                                <td key={cellIndex}><InlineMarkdown text={row[cellIndex] ?? ""} /></td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function InlineMarkdown({ text }: { text: string }) {
    const chunks = text.split(/(\*\*[^*]+\*\*)/g);
    return (
        <>
            {chunks.map((chunk, index) =>
                chunk.startsWith("**") && chunk.endsWith("**")
                    ? <strong key={index}>{chunk.slice(2, -2)}</strong>
                    : chunk.replace(/[*_`]/g, ""),
            )}
        </>
    );
}

function Reply({
    text,
    onFollowUp,
    disabled,
}: {
    text: string;
    onFollowUp: (question: string) => void;
    disabled: boolean;
}) {
    const answerMatch = text.match(/<ANSWER>([\s\S]*?)(?:<\/ANSWER>|$)/i);
    const answerText = (answerMatch?.[1] ?? text)
        .replace(/<FOLLOW_UPS>[\s\S]*$/i, "")
        .trim();
    const followUps = [...text.matchAll(/<question>([\s\S]*?)<\/question>/gi)]
        .map((match) => match[1]?.trim())
        .filter((question): question is string => Boolean(question));
    const parts = answerText.split(/```([\w+-]*)\n([\s\S]*?)```/g);

    return (
        <div className="reply">
            {parts.map((part, index) => {
                if (index % 3 === 2) {
                    return <CodeBlock key={index} language={parts[index - 1] ?? ""} code={part} />;
                }
                if (index % 3 === 1) {
                    return null;
                }

                const lines = part.split("\n");
                            const rendered: ReactNode[] = [];
                let lineIndex = 0;
                while (lineIndex < lines.length) {
                                const line = lines[lineIndex] ?? "";
                                const separator = lines[lineIndex + 1] ?? "";
                                if (line.trim().startsWith("|") && lineIndex + 1 < lines.length && separator.includes("---")) {
                                    const tableLines = [line];
                                    lineIndex += 1;
                                    while (lineIndex < lines.length && (lines[lineIndex] ?? "").trim().startsWith("|")) {
                                        tableLines.push(lines[lineIndex] ?? "");
                            lineIndex += 1;
                        }
                        rendered.push(<MarkdownTable key={`${index}-table-${lineIndex}`} lines={tableLines} />);
                        continue;
                    }
                    if (!line.trim()) {
                        lineIndex += 1;
                        continue;
                    }

                    const cleanLine = line.trim().replace(/^\s*[-*]\s+/, "");
                    const heading = cleanLine.match(/^#{1,3}\s+(.+)$/);
                    const chunks = cleanLine.split(/(\*\*[^*]+\*\*)/g);
                    if (heading) {
                        rendered.push(<h3 className="reply-heading" key={`${index}-${lineIndex}`}>{heading[1]}</h3>);
                        lineIndex += 1;
                        continue;
                    }

                    rendered.push(
                        <p key={`${index}-${lineIndex}`}>
                            {chunks.map((chunk, chunkIndex) =>
                                chunk.startsWith("**") && chunk.endsWith("**")
                                    ? <strong key={chunkIndex}>{chunk.slice(2, -2)}</strong>
                                    : chunk,
                            )}
                        </p>
                    );
                    lineIndex += 1;
                }
                return rendered;
            })}
            {followUps.length > 0 && (
                <div className="follow-ups">
                    <h3>Follow-up questions</h3>
                    {followUps.map((question) => (
                        <button
                            className="follow-up-button"
                            key={question}
                            onClick={() => onFollowUp(question)}
                            disabled={disabled}
                        >
                            {question}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const supabase = createClient();

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [conversationId, setConversationId] = useState<string>();
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [model, setModel] = useState<ModelChoice>("gemini");
    const [image, setImage] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function getInfo() {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setUser(data.user);
            } else {
                navigate("/auth");
            }
        }

        getInfo();
    }, [navigate]);

    async function getConversations() {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`${BACKEND_URL}/conversations`, {
            headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        });

        if (response.ok) {
            setConversations(await response.json() as Conversation[]);
        }
    }

    useEffect(() => {
        if (user) {
            getConversations();
        }
    }, [user]);

    async function askQuestion(question: string) {
        if (!question.trim() || !user || loading) {
            return;
        }

        if (image && model !== "gemini") {
            setError("Image questions require the Gemini model.");
            return;
        }

        setQuery("");
        const selectedImage = image;
        setImage(null);
        setLoading(true);
        setError("");
        setMessages((current) => [
            ...current,
            { role: "user", content: question.trim() },
            { role: "assistant", content: "" },
        ]);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const imageData = selectedImage
                ? await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(new Error("Could not read the selected image"));
                    reader.readAsDataURL(selectedImage);
                })
                : undefined;
            const response = await fetch(`${BACKEND_URL}/witty_ask`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token ?? ""}`,
                },
                body: JSON.stringify({ query: question, conversationId, model, image: imageData }),
            });

            if (!response.ok || !response.body) {
                throw new Error(await response.text() || "Could not get an answer");
            }

            const newConversationId = response.headers.get("X-Conversation-Id");
            if (newConversationId) {
                setConversationId(newConversationId);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                result += decoder.decode(value, { stream: true });
                const assistantText = result.split("\n<SOURCES>\n")[0] ?? "";
                setMessages((current) => {
                    const next = [...current];
                    const lastMessage = next[next.length - 1];
                    if (lastMessage?.role === "assistant") {
                        next[next.length - 1] = { ...lastMessage, content: assistantText };
                    }
                    return next;
                });
            }

            await getConversations();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    async function askWitty(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await askQuestion(query);
    }

    async function openConversation(id: string) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`${BACKEND_URL}/conversation/${id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        });

        if (response.ok) {
            const conversation = await response.json();
            setConversationId(id);
            setMessages(conversation.messages.map((message: { role: string; content: string }) => ({
                role: message.role.toLowerCase() === "user" ? "user" : "assistant",
                content: message.content,
            })));
        }
    }

    async function logout() {
        await supabase.auth.signOut();
        navigate("/auth");
    }

    return (
        <main className="app-shell">
            {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close conversations" onClick={() => setSidebarOpen(false)} />}
            <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
                <div className="brand"><span>&lt;/&gt;</span> Witty</div>
                <button className="new-chat" onClick={() => {
                    setConversationId(undefined);
                    setMessages([]);
                    setSidebarOpen(false);
                }}>+ New conversation</button>
                <h2>Conversations</h2>
                <div className="conversation-list">
                    {conversations.map((conversation) => (
                        <button key={conversation.id} onClick={() => {
                            openConversation(conversation.id);
                            setSidebarOpen(false);
                        }}>
                            {conversation.title ?? "Untitled conversation"}
                        </button>
                    ))}
                </div>
                <div className="account-menu">
                    {accountMenuOpen && (
                        <div className="account-popover">
                            <button onClick={logout}>Log out</button>
                        </div>
                    )}
                    <button className="account" onClick={() => setAccountMenuOpen((open) => !open)}>
                        <span className="account-avatar">
                            {(user?.email?.[0] ?? "W").toUpperCase()}
                        </span>
                        <span className="account-details">
                            <strong>{user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Account"}</strong>
                            <small>{user?.email}</small>
                        </span>
                    </button>
                </div>
            </aside>

            <section className="chat-area">
                <button className="sidebar-toggle" type="button" aria-label="Open conversations" onClick={() => setSidebarOpen(true)}>
                    ☰
                </button>
                <div className="chat-content">
                    {messages.length === 0 && !loading && <div className="welcome">
                        <div className="welcome-mark">&lt;/&gt;</div>
                        <h1>What should we explore?</h1>
                    </div>}
                    {messages.map((message, index) => (
                        <div className={`message-row ${message.role}`} key={`${index}-${message.role}`}>
                            {message.role === "user" ? (
                                <div className="user-message">{message.content}</div>
                            ) : (
                                <article className="answer">
                                    {message.content
                                        ? <Reply text={message.content} onFollowUp={askQuestion} disabled={loading} />
                                        : loading && index === messages.length - 1
                                            ? <p className="status">Searching and thinking...</p>
                                            : null}
                                </article>
                            )}
                        </div>
                    ))}
                    {error && <p className="error">{error}</p>}
                </div>
                <form className="query-box" onSubmit={askWitty}>
                    {image && (
                        <div className="selected-image">
                            <span className="selected-image-icon">🖼</span>
                            <span className="selected-image-name">{image.name}</span>
                            <button type="button" onClick={() => setImage(null)} aria-label="Remove image">×</button>
                        </div>
                    )}
                    <div className="composer-row">
                        <input
                            ref={imageInputRef}
                            className="image-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={(event) => {
                                const selectedFile = event.target.files?.[0];
                                if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
                                    setError("Image must be smaller than 10 MB");
                                    event.currentTarget.value = "";
                                    return;
                                }
                                setError("");
                                setImage(selectedFile ?? null);
                            }}
                        />
                        <button
                            className="attach-button"
                            type="button"
                            aria-label="Attach an image"
                            title={model === "gemini" ? "Attach an image" : "Select Gemini to attach an image"}
                            onClick={() => imageInputRef.current?.click()}
                        >
                            +
                        </button>
                        <textarea
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    event.currentTarget.form?.requestSubmit();
                                }
                            }}
                            placeholder="Ask anything..."
                            rows={1}
                        />
                        <select value={model} onChange={(event) => setModel(event.target.value as ModelChoice)}>
                            <option value="groq">Groq</option>
                            <option value="gemini">Gemini</option>
                        </select>
                        <button type="submit" disabled={loading || !query.trim()}>Ask</button>
                    </div>
                </form>
            </section>
        </main>
    );
}

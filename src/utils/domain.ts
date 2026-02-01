export function getDomain(url?: string): string | null {
    if (!url) return null;  

    // ignore non http/s (like chrome://, brave:// etc)
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
    }

    try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
    } catch {
    return null;
    }
}

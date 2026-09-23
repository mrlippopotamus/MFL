// Vercel serverless function: catch-all proxy for the PlayMFL API.
//
// File location matters here: because this file is at api/[...path].js,
// Vercel routes any request under /api/* to this function, with the
// remaining path segments available in req.query.path.
//
//   GET https://your-project.vercel.app/api/players?limit=50
//   -> req.query.path = ["players"], req.query.limit = "50"
//   -> this forwards to https://api.playmfl.com/players?limit=50
//
// Why a proxy at all: browsers block cross-origin fetches unless the
// target server opts in with CORS headers, and api.playmfl.com has no
// reason to allow a page on vercel.app as an origin. A serverless
// function making the request is a server-to-server call, which CORS
// doesn't restrict — then this function adds its own permissive CORS
// headers before handing the JSON back to your page.

const UPSTREAM = "https://api.playmfl.com";

module.exports = async function handler(req, res) {
  // Allow the browser page to call this function from any origin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const { path, ...rest } = req.query;
  const upstreamPath = "/" + (Array.isArray(path) ? path.join("/") : (path || ""));
  const search = new URLSearchParams(rest).toString();
  const targetUrl = `${UPSTREAM}${upstreamPath}${search ? `?${search}` : ""}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Accept": "application/json",
        // If an endpoint needs your own session's auth, set MFL_TOKEN as
        // an environment variable in the Vercel project settings (never
        // commit a real token to the repo) and uncomment this line:
        // "Authorization": `Bearer ${process.env.MFL_TOKEN || ""}`,
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body),
    });

    const contentType = upstreamRes.headers.get("content-type") || "application/json";
    const body = await upstreamRes.text();

    res.status(upstreamRes.status);
    res.setHeader("Content-Type", contentType);
    res.send(body);
  } catch (err) {
    res.status(502).json({
      error: "Proxy could not reach api.playmfl.com",
      detail: err.message,
    });
  }
};

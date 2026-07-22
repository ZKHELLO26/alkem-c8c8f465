// Vercel serverless function that wraps the TanStack Start SSR handler.
// The build produces `dist/server/server.js` whose default export has a
// fetch(request) method. We adapt Node's (req, res) into a Web Request,
// invoke the handler, and stream the Web Response back.
import server from "../dist/server/server.js";

export const config = { runtime: "nodejs" };

function nodeReqToWebRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
    else if (v != null) headers.set(k, String(v));
  }

  const method = req.method || "GET";
  const hasBody = !["GET", "HEAD"].includes(method);
  return new Request(url, {
    method,
    headers,
    body: hasBody ? req : undefined,
    duplex: "half",
  });
}

async function webResponseToNode(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  if (!webRes.body) {
    res.end();
    return;
  }
  const reader = webRes.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

export default async function handler(req, res) {
  try {
    const request = nodeReqToWebRequest(req);
    const response = await server.fetch(request);
    await webResponseToNode(response, res);
  } catch (err) {
    console.error("SSR handler error:", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}

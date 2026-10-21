import http from "node:http";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOST = "0.0.0.0";
const DEFAULT_PORT = 4780;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function readPort() {
  const index = process.argv.indexOf("--port");
  if (index === -1) return DEFAULT_PORT;
  const port = Number(process.argv[index + 1]);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

function isVirtualInterface(name) {
  return /radmin|vpn|virtual|vmware|vbox|hyper-v|vethernet|tailscale|zerotier|loopback/i.test(name);
}

function lanAddresses() {
  const result = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (entry.address.startsWith("169.254.")) continue;
      result.push({ name, address: entry.address, virtual: isVirtualInterface(name) });
    }
  }
  const score = (item) => {
    if (item.virtual) return 2;
    if (/wi-?fi|wlan|ethernet|以太网|无线/i.test(item.name)) return 0;
    return 1;
  };
  return result.sort((a, b) => score(a) - score(b));
}

function sendText(response, status, text) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(text);
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendText(response, 405, "Method Not Allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname);
  } catch {
    sendText(response, 400, "Bad Request");
    return;
  }

  if (pathname === "/" || pathname.endsWith("/")) pathname += "index.html";
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    });
    if (request.method === "HEAD") response.end();
    else response.end(data);
  } catch (error) {
    if (error && error.code === "EISDIR") {
      sendText(response, 404, "Not Found");
      return;
    }
    sendText(response, 404, "Not Found");
  }
});

const port = readPort();
server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`端口 ${port} 已被占用。请关闭旧服务，或运行：`);
    console.error(`  node server.mjs --port 4781`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, HOST, () => {
  const addresses = lanAddresses();
  const primary = addresses.find((item) => !item.virtual) || addresses[0];
  console.log("");
  console.log("  余记 · 手机访问服务已启动");
  console.log("");
  console.log(`  电脑本机：http://localhost:${port}`);
  if (primary) console.log(`  手机访问：http://${primary.address}:${port}`);
  for (const item of addresses) {
    if (item === primary) continue;
    console.log(`  其他地址：http://${item.address}:${port}  (${item.name})`);
  }
  console.log("");
  console.log("  1. 手机与电脑连接同一个 Wi-Fi");
  console.log("  2. 用手机浏览器打开上面的“手机访问”地址");
  console.log("  3. 保持这个窗口运行；按 Ctrl+C 停止");
  console.log("");
  console.log("  如果手机无法打开，请双击 allow-phone.cmd 放行 Windows 防火墙，");
  console.log("  或检查手机与电脑是否在同一个 Wi-Fi、路由器是否开启了设备隔离。");
  console.log("");
});

process.on("SIGINT", () => {
  console.log("\n服务已停止。");
  server.close(() => process.exit(0));
});

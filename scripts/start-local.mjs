import { spawn, execFileSync } from "node:child_process";
import {
  openSync,
  closeSync,
  existsSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { resolve } from "node:path";
const cwd = resolve(import.meta.dirname, "..");
const cli = resolve(cwd, "node_modules/.bin/supabase");
const dockerEnv = { ...process.env };
for (const name of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete dockerEnv[name];
const docker = (args) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env: dockerEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
docker(["info", "--format", "{{.ServerVersion}}"]);
const logPath = "/tmp/ons-huis-supabase-local.log";
const fd = openSync(logPath, "w", 0o600);
chmodSync(logPath, 0o600);
console.log(
  "Starting local Supabase. Private CLI output is retained in a restricted temporary log.",
);
const child = spawn(
  cli,
  [
    "start",
    "--exclude",
    "studio,imgproxy,edge-runtime,logflare,vector,supavisor",
  ],
  {
    cwd,
    env: {
      ...dockerEnv,
      DOCKER_HOST: "unix:///var/run/docker.sock",
      SUPABASE_INTERNAL_IMAGE_REGISTRY: "docker.io",
    },
    stdio: ["ignore", fd, fd],
  },
);
const patched = new Set();
const timer = setInterval(() => {
  for (const service of ["supabase_auth_osso", "supabase_storage_osso"]) {
    if (patched.has(service)) continue;
    try {
      const running = docker([
        "inspect",
        "--format",
        "{{.State.Running}}",
        service,
      ]).trim();
      if (running === "true") {
        docker([
          "cp",
          resolve(cwd, "scripts/local-healthcheck-wget.sh"),
          `${service}:/usr/local/bin/wget`,
        ]);
        patched.add(service);
        console.log(`${service}: loopback-only healthcheck fix applied.`);
      }
    } catch {
      /* Container not created yet. */
    }
  }
}, 1000);
child.on("error", () => {
  clearInterval(timer);
  closeSync(fd);
  console.error("Could not launch Supabase CLI.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  clearInterval(timer);
  closeSync(fd);
  if (code !== 0) {
    console.error(
      `Supabase did not become ready (exit ${code}). Inspect ${logPath} locally; it may contain development credentials.`,
    );
    process.exitCode = 1;
    return;
  }
  const envPath = resolve(cwd, ".env.local");
  if (!existsSync(envPath)) {
    const status = JSON.parse(
      execFileSync(cli, ["status", "-o", "json"], {
        cwd,
        env: { ...dockerEnv, DOCKER_HOST: "unix:///var/run/docker.sock" },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    if (!status.API_URL || !status.ANON_KEY)
      throw new Error(
        "Supabase did not return the expected public API settings.",
      );
    writeFileSync(
      envPath,
      `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\nNEXT_PUBLIC_SITE_URL=http://localhost:3000\n`,
      { mode: 0o600 },
    );
    console.log(
      "Local public API settings written to ignored .env.local. No privileged key was copied.",
    );
  } else console.log("Existing .env.local preserved.");
  console.log(
    "Local Supabase is ready. Restart/rebuild Next.js after configuration changes.",
  );
});

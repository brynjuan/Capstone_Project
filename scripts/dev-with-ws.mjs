import { spawn } from "node:child_process";

const processes = [
  { name: "next", command: "npm", args: ["run", "dev:next"] },
  { name: "ws", command: "npm", args: ["run", "ws"] },
];

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: ["inherit", "inherit", "inherit"],
    shell: true,
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });

  return child;
});

const cleanup = () => {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

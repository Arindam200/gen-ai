#!/usr/bin/env node

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");
require("dotenv").config();

const userApiKey = process.env.API_KEY;
const myApiKey = "AIzaSyD_XFPL5kqQoVDbfXQSrGrhyqGPGq_n9XI";
const version = "0.0.6";

let apiKey;
let requestCount = 0;
const requestLimit = 10;
const resetInterval = 60 * 60 * 1000;
const logDir = path.resolve(__dirname, 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

if (userApiKey) {
  apiKey = userApiKey;
} else {
  apiKey = myApiKey;
  setInterval(() => {
    requestCount = 0;
  }, resetInterval);
}

const genAI = new GoogleGenerativeAI(apiKey);

let inMemoryLogs = [];

async function ask(question, logToFile = true) {
  if (question) {
    try {
      if (!userApiKey && requestCount >= requestLimit) {
        console.log("Request limit reached. Please provide your own API key for unlimited usage.");
        return;
      }

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(question);
      const response = result.response;
      const text = response.text();
      console.log(text);

      // Log the question and response
      if (logToFile) {
        logChat(question, text);
      }

      if (!userApiKey) {
        requestCount++;
      }

      if (!interactiveMode) {
        process.exit(0);
      }
    } catch (error) {
      console.error("Error generating content:", error);
      process.exit(1);
    }
  } else {
    console.log("You must enter a prompt when calling this function");
    process.exit(1);
  }
}

function logChat(question, response) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] Question: ${question}\nResponse: ${response}\n\n`;
  inMemoryLogs.push(logEntry);
}

function writeLogsToFile() {
  const timestamp = new Date().toISOString();
  const logFilePath = path.join(logDir, `${timestamp.split('T')[0]}.log`);
  fs.appendFileSync(logFilePath, inMemoryLogs.join(''), 'utf8');
  console.log(`Logs have been written to ${logFilePath}`);
}

function isPackageInstalled(packageName) {
  try {
    execSync(`npm list -g ${packageName}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

let args;

if (process.argv[1].includes('npx')) {
  args = process.argv.slice(2);
} else {
  if (!isPackageInstalled('gen-ai-chat')) {
    console.error("Error: 'gen-ai-chat' package is not installed. Please install it using 'npm install -g gen-ai-chat'.");
    process.exit(1);
  }

  args = process.argv.slice(1);
}

let question = args.filter(arg => arg !== "-f" && arg !== "-d" && arg !== "--no-log-to-file" && !arg.startsWith("/")).join(" ");
let filePath;
let dirPath;
const logToFile = !args.includes("--no-log-to-file");

const helpMessage = `
\x1b[1mWelcome to Google Generative AI CLI | By Arindam\x1b[0m

Usage: npx gen-ai-chat <question> [options]

Options:
  -h, --help          Show this help message and exit
  -v, --version       Show the version number and exit
  -f <file>           Provide a file path to include its content as context
  -d <directory>      Provide a directory path to include all files' content as context
  -i, --interactive   Start interactive mode
  --no-log-to-file    Disable logging the chat to a file
  --write-logs        Write in-memory logs to a file

Examples:
  npx gen-ai-chat "What is the capital of France?"
  npx gen-ai-chat "What is the capital of France?" -f context.txt
  npx gen-ai-chat "What is the capital of France?" -d contextDir
  npx gen-ai-chat "What is the capital of France?" --no-log-to-file

\x1b[31mWarning: If you don't use the -f or -d flags, the response might be ambiguous.\x1b[0m
`;

if (args.includes("-h") || args.includes("--help")) {
  console.log(helpMessage);
  process.exit(0);
}

if (args.includes("-v") || args.includes("--version")) {
  console.log(`gen-ai-chat version: ${version}`);
  process.exit(0);
}

if (args.includes("--write-logs")) {
  writeLogsToFile();
  process.exit(0);
}

const largeFilesAndDirs = [
  "package-lock.json",
  "yarn.lock",
  "node_modules",
  "dist",
  "build",
  ".git",
  "coverage",
  "logs",
  "tmp",
  "temp"
];

const largeFileExtensions = [
  ".log",
  ".zip",
  ".tar",
  ".gz"
];

function isLargeFileOrDir(filePath) {
  const fileName = path.basename(filePath);
  const fileExt = path.extname(filePath);
  return largeFilesAndDirs.includes(fileName) || largeFileExtensions.includes(fileExt);
}

if (args.includes("-f")) {
  const fileIndex = args.indexOf("-f") + 1;
  if (fileIndex < args.length) {
    filePath = args[fileIndex];
    try {
      if (isLargeFileOrDir(filePath)) {
        console.log(`Skipping large file or directory: ${filePath}`);
      } else {
        const fileContent = fs.readFileSync(path.resolve(filePath), "utf-8");
        question = `${question}\n\nContext:\n${fileContent}`;
      }
    } catch (error) {
      console.error("Error reading file:", error);
      process.exit(1);
    }
  } else {
    console.log("Please provide a file path after the -f flag.");
    process.exit(1);
  }
}

if (args.includes("-d")) {
  const dirIndex = args.indexOf("-d") + 1;
  if (dirIndex < args.length) {
    dirPath = args[dirIndex];
    try {
      const files = fs.readdirSync(path.resolve(dirPath));
      let combinedContent = "";
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        if (isLargeFileOrDir(filePath)) {
          console.log(`Skipping large file or directory: ${file}`);
        } else {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          combinedContent += `\n\nContext from ${file}:\n${fileContent}`;
        }
      });
      question = `${question}\n\nContext:\n${combinedContent}`;
    } catch (error) {
      console.error("Error reading directory:", error);
      process.exit(1);
    }
  } else {
    console.log("Please provide a directory path after the -d flag.");
    process.exit(1);
  }
}

const pathLikeArgs = args.filter(arg => typeof arg === 'string' && (arg.startsWith("/") || arg.includes("\\")));

if (pathLikeArgs.length > 0 && !args.includes("-f") && !args.includes("-d")) {
  console.error("Error: Please use the -f flag for file paths or the -d flag for directory paths.");
  process.exit(1);
}

if (args.includes("-i") || args.includes("--interactive")) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'gen-ai-chat> '
  });

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();
    if (input.toLowerCase() === 'exit') {
      rl.close();
    } else {
      ask(input, logToFile);
      rl.prompt();
    }
  }).on('close', () => {
    console.log('Exiting interactive mode.');
    process.exit(0);
  });
} else {
  if (question) {
    ask(question, logToFile);
  } else {
    console.log("Please ask a question!");
    process.exit(0);
  }
}
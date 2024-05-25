#!/usr/bin/env node

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import readline from "readline";
import { Buffer } from "buffer";
import ora, { spinners } from "ora";
import dotenv from "dotenv";
import chalk from "chalk";
import inquirer from "inquirer";
import { fileURLToPath } from 'url';
import latestVersion from 'latest-version'; // Import latest-version

dotenv.config();

const userApiKey = process.env.API_KEY;
const defApiKey = "QUl6YVN5QVFPVUY3czUzLU9QTVZjbXlJQ0VoMUxlMDhsdlJEcXo0"; // Replace with your actual default API key
const myApiKey = Buffer.from(defApiKey, 'base64').toString('utf-8');
const version = "0.1.15";

let apiKey;
let requestCount = 0;
const requestLimit = 10;
const resetInterval = 60 * 60 * 1000;

const interactiveMode = process.argv.includes("-i") || process.argv.includes("--interactive");

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

const defaultModel = "gemini-pro";
let selectedModel = defaultModel;

const availableModels = ["gemini-pro", "gemini-1.5-flash-latest", "gemini-1.5-pro-latest", "gemini-pro-vision", "text-embedding-004"];

const promptUserForModel = async () => {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Please select a model:',
      choices: availableModels,
      default: defaultModel
    }
  ]);
  return answers.model;
};

const selectModel = async () => {
  selectedModel = await promptUserForModel();
  console.log(chalk.green("Selected model:") + chalk.white(selectedModel));
};

const ask = async (question, logToFile = true) => {
  if (!question) {
    console.log(chalk.red("You must enter a prompt when calling this function"));
    process.exit(1);
  }

  const spinner = ora('Generating response...').start();

  try {
    if (!userApiKey && requestCount >= requestLimit) {
      spinner.fail(chalk.red("Request limit reached. Please provide your own API key for unlimited usage."));
      return;
    }

    let model = await genAI.getGenerativeModel({ model: selectedModel });
    let result;
    let response;
    let text;

    try {
      result = await model.generateContent(question);
      response = result.response;
      text = response.text();
    } catch (error) {
      console.warn(chalk.yellow("Selected model failed, retrying with gemini-pro..."));
      model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      result = await model.generateContent(question);
      response = result.response;
      text = response.text();
    }

    spinner.succeed(chalk.green("Response generated successfully!"));
    console.log(chalk.blue.bold("\nResponse:") + chalk.white(text));

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
    spinner.fail(chalk.red("Error generating content:"));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
};

const logChat = (question, response) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] Question: ${question}\nResponse: ${response}\n\n`;
  inMemoryLogs.push(logEntry);
};

const writeLogsToFile = () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const logDir = path.resolve(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  const timestamp = new Date().toISOString();
  const logFilePath = path.join(logDir, `${timestamp.split('T')[0]}.log`);
  fs.appendFileSync(logFilePath, inMemoryLogs.join(''), 'utf8');
  console.log(`Logs have been written to ${logFilePath}`);
};

const isPackageInstalled = (packageName) => {
  try {
    execSync(`npm list -g ${packageName}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
};

const checkForUpdates = async () => {
  try {
    const latest = await latestVersion('gen-ai-chat');
    if (latest !== version) {
      console.log(chalk.yellow(`A new version of gen-ai-chat is available: ${latest}. You are using version: ${version}.`));
      console.log(chalk.yellow(`To update, run: npm install -g gen-ai-chat@${latest}`));
    }
  } catch (error) {
    console.error(chalk.red("Error checking for updates:"), error);
  }
};

const main = async () => {
  await checkForUpdates(); // Check for updates at the start

  let args;

  if (process.argv[1].includes('npx') || process.argv[0].includes('node')) {
    args = process.argv.slice(2);
  } else {
    if (!isPackageInstalled('gen-ai-chat')) {
      console.error("Error: 'gen-ai-chat' package is not installed. Please install it using 'npm install -g gen-ai-chat'.");
      process.exit(1);
    }
    args = process.argv.slice(1);
  }

  if (args.includes("--choose-model")) {
    await selectModel();
    process.exit(0); // Exit after selecting the model
  } else {
    const modelIndex = args.indexOf("--model");
    if (modelIndex !== -1 && modelIndex + 1 < args.length) {
      const modelArg = args[modelIndex + 1];
      if (availableModels.includes(modelArg)) {
        selectedModel = modelArg;
      } else {
        console.log(`Invalid model specified. Available models are: ${availableModels.join(", ")}`);
        process.exit(1);
      }
    }
  }

  let question = args.filter(arg => 
    arg !== "-f" && 
    arg !== "-d" && 
    arg !== "--no-log-to-file" && 
    arg !== "-h" && 
    arg !== "--help" && 
    arg !== "-v" && 
    arg !== "--version" && 
    arg !== "-i" && 
    arg !== "--interactive" && 
    arg !== "--write-logs" && 
    arg !== "--choose-model" && 
    !arg.startsWith("/")
  ).join(" ");
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
  --choose-model      Choose a model interactively

Examples:
  npx gen-ai-chat "What is the capital of France?"
  npx gen-ai-chat "What is the capital of France?" -f context.txt
  npx gen-ai-chat "What is the capital of France?" -d contextDir
  npx gen-ai-chat "What is the capital of France?" --no-log-to-file
  npx gen-ai-chat -i
  npx gen-ai-chat --choose-model
  npx gen-ai-chat --write-logs

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

  const sizeThreshold = 5 * 1024 * 1024; // 5MB in bytes

  const isLargeFileOrDir = (filePath) => {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath);
    if (largeFilesAndDirs.includes(fileName) || largeFileExtensions.includes(fileExt)) {
      return true;
    }
    try {
      const stats = fs.statSync(filePath);
      return stats.isFile() && stats.size > sizeThreshold;
    } catch (error) {
      console.error(`Error checking file size for ${filePath}:`, error);
      return false;
    }
  };

  if (args.includes("-f")) {
    const fileIndex = args.indexOf("-f") + 1;
    if (fileIndex < args.length) {
      filePath = args[fileIndex];
      const spinner = ora('Reading file...').start();
      try {
        if (isLargeFileOrDir(filePath)) {
          spinner.warn(chalk.yellow(`Skipping large file or directory: ${filePath}`));
        } else {
          const fileContent = fs.readFileSync(path.resolve(filePath), "utf-8");
          question = `${question}\n\nContext:\n${fileContent}`;
          spinner.succeed(chalk.green('File read successfully.'));
        }
      } catch (error) {
        spinner.fail(chalk.red("Error reading file:"));
        console.error(error);
        process.exit(1);
      }
    } else {
      console.log(chalk.red("Please provide a file path after the -f flag."));
      process.exit(1);
    }
  }

  if (args.includes("-d")) {
    const dirIndex = args.indexOf("-d") + 1;
    if (dirIndex < args.length) {
      dirPath = args[dirIndex];
      const spinner = ora('Reading directory...').start();
      try {
        const files = fs.readdirSync(path.resolve(dirPath));
        let combinedContent = "";
        files.forEach(file => {
          const filePath = path.join(dirPath, file);
          if (isLargeFileOrDir(filePath)) {
            spinner.warn(chalk.yellow(`Skipping large file or directory: ${file}`));
          } else {
            const fileContent = fs.readFileSync(filePath, "utf-8");
            combinedContent += `\n\nContext from ${file}:\n${fileContent}`;
          }
        });
        question = `${question}\n\nContext:\n${combinedContent}`;
        spinner.succeed(chalk.green('Directory read successfully.'));
      } catch (error) {
        spinner.fail(chalk.red("Error reading directory:"));
        console.error(error);
        process.exit(1);
      }
    } else {
      console.log(chalk.red("Please provide a directory path after the -d flag."));
      process.exit(1);
    }
  }

  if (args.includes("-i") || args.includes("--interactive")) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'gen-ai-chat> ',
      historySize: 100,
      completer: (line) => {
        const completions = ['exit', 'help', 'version'];
        const hits = completions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : completions, line];
      }
    });

    console.log("Welcome to Google Generative AI CLI Interactive Mode!");
    console.log("Type 'exit' to quit, 'help' for assistance, or 'version' to see the version number.");
    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      switch (input.toLowerCase()) {
        case 'exit':
          rl.close();
          break;
        case 'help':
          console.log("Available commands: exit, help, version");
          rl.prompt();
          break;
        case 'version':
          console.log(`gen-ai-chat version: ${version}`);
          rl.prompt();
          break;
        default:
          await ask(input, logToFile);
          rl.prompt();
          break;
      }
    }).on('close', () => {
      console.log('Exiting interactive mode.');
      process.exit(0);
    });
  } else {
    if (question) {
      await ask(question, logToFile);
    } else {
      console.log("Please ask a question!");
      process.exit(0);
    }
  }
};

main();
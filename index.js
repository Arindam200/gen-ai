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
import latestVersion from 'latest-version';
import axios from 'axios'; 
import hljs from 'highlight.js';
// import pdf from 'pdf-parse';
import crypto from 'crypto';

dotenv.config();

const userApiKey = process.env.API_KEY;
const defApiKey = "QUl6YVN5QVFPVUY3czUzLU9QTVZjbXlJQ0VoMUxlMDhsdlJEcXo0";
const myApiKey = Buffer.from(defApiKey, 'base64').toString('utf-8');
const version = "0.2.4";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Cache file path
const cacheFilePath = path.resolve(__dirname, 'cache.json');

// Function to generate a unique cache key
const generateCacheKey = (query, context) => {
  const normalizedQuery = query.toLowerCase().trim(); // Simple normalization
  const hash = crypto.createHash('sha256');
  hash.update(normalizedQuery + JSON.stringify(context));
  return hash.digest('hex');
};

// Function to load the cache from the file
const loadCache = () => {
  if (fs.existsSync(cacheFilePath)) {
    const data = fs.readFileSync(cacheFilePath, 'utf-8');
    return JSON.parse(data);
  }
  return {};
};

// Function to save the cache to the file
const saveCache = (cache) => {
  fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), 'utf-8');
};

// Function to check the cache
const checkCache = (key, cache) => {
  return cache[key];
};

// Function to insert into the cache
const insertIntoCache = (key, value, cache) => {
  cache[key] = {
    value,
    timestamp: Date.now()
  };
  saveCache(cache);
};

// Function to expire old cache entries
const expireCache = (cache, maxAge) => {
  const now = Date.now();
  for (const key in cache) {
    if (now - cache[key].timestamp > maxAge) {
      delete cache[key];
    }
  }
  saveCache(cache);
};

// Periodically expire old cache entries
// setInterval(() => {
//   const cache = loadCache();
//   expireCache(cache, 60 * 60 * 1000); // 1 hour
// }, 60 * 60 * 1000); // 1 hour



const searchStackOverflow = async (query) => {
  const spinner = ora('Searching Stack Overflow...').start();
  try {
    const response = await axios.get('https://api.stackexchange.com/2.3/search/advanced', {
      params: {
        order: 'desc',
        sort: 'relevance',
        q: query,
        site: 'stackoverflow'
      }
    });
    spinner.succeed(chalk.green("Stack Overflow search completed."));
    return response.data.items.map(item => item.link);
  } catch (error) {
    spinner.fail(chalk.red("Error searching Stack Overflow:"));
    console.error(chalk.red(error.message));
    return [];
  }
};

const formatResponse = (text) => {
  const lines = text.split('\n');
  let formattedText = '';
  let inCodeBlock = false;
  lines.forEach(line => {
    if (line.startsWith('# ')) {
      formattedText += chalk.bold(line) + '\n';
    } else if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      formattedText += '```';
    } else if (inCodeBlock) {
      formattedText += hljs.highlightAuto(line).value + '\n';
    } else if (line.startsWith('* ')) {
      formattedText += chalk.green('• ') + line.slice(2) + '\n';
    } else if (line.startsWith('**') && line.endsWith('**')) {
      formattedText += chalk.bold(line.slice(2, -2)) + '\n';
    } else {
      formattedText += line + '\n';
    }
  });

  return formattedText;
};

// const filePath = path.resolve(__dirname, 'data', '05-versions-space.pdf');

// const readPDF = async (filePath) => {
//   try {
//     if (!fs.existsSync(filePath)) {
//       throw new Error(`File not found: ${filePath}`);
//     }
//     const dataBuffer = fs.readFileSync(filePath);
//     const data = await pdf(dataBuffer);
//     return data.text;
//   } catch (error) {
//     console.error(`Error reading PDF: ${error.message}`);
//     process.exit(1);
//   }
// };

const ask = async (question, context = {}, logToFile = true, searchSO = false) => {
  if (!question) {
    console.log(chalk.red("You must enter a prompt when calling this function"));
    process.exit(1);
  }

  const cache = loadCache();
  const cacheKey = generateCacheKey(question, context);
  const cachedResponse = checkCache(cacheKey, cache);

  if (cachedResponse) {
    console.log(chalk.blue.bold("\nCached Response:\n") + chalk.white(cachedResponse.value));
    // return;
    process.exit(0);
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
    const formattedText = formatResponse(text);
    console.log(chalk.blue.bold("\nResponse:\n") + chalk.white(formattedText));

    // Insert the response into the cache
    insertIntoCache(cacheKey, formattedText, cache);

    // Log the question and response
    if (logToFile) {
      logChat(question, text);
    }

    // Check if the Stack Overflow search flag is present
    if (searchSO) {
      const stackOverflowLinks = await searchStackOverflow(question);
      if (stackOverflowLinks.length > 0) {
        console.log(chalk.blue.bold("\nStack Overflow Links:"));
        stackOverflowLinks.forEach(link => console.log(chalk.white(link)));
      } else {
        console.log(chalk.yellow("No relevant Stack Overflow links found."));
      }
    }

    if (!userApiKey) {
      requestCount++;
    }

  } catch (error) {
    spinner.fail(chalk.red("Error generating content:"));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
};

const logChat = (question, response) => {
  // const timestamp = new Date().toISOString();
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
  const day = String(now.getDate()).padStart(2, '0');

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const formattedDate = `${year}-${month}-${day}`;
  const formattedTime = `${hours}:${minutes}:${seconds}`;

  const formattedDateTime = `${formattedDate}, ${formattedTime}`;
  const logEntry = `[${formattedDateTime}]\n Question: ${question}\nResponse: ${response}\n\n`;
  writeLogToFile(logEntry);
};

const writeLogToFile = (logEntry) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const logDir = path.resolve(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  const timestamp = new Date().toISOString();
  const logFilePath = path.join(logDir, `${timestamp.split('T')[0]}.md`);
  fs.appendFileSync(logFilePath, logEntry, 'utf8');
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
    arg !== "--stackoverflow" && 
    arg !== "-s" && 
    !arg.startsWith("/")
  ).join(" ");
  let filePath;
  let dirPath;
  const searchSO = args.includes("--stackoverflow") || args.includes("-s");

  const helpMessage = `
\x1b[1mWelcome to Google Generative AI CLI | By Arindam\x1b[0m

Usage: npx gen-ai-chat <question> [options]

Options:
  -h, --help          Show this help message and exit
  -v, --version       Show the version number and exit
  -f <file>           Provide a file path to include its content as context
  -d <directory>      Provide a directory path to include all files' content as context
  -i, --interactive   Start interactive mode
  --write-logs        Write in-memory logs to a file
  --choose-model      Choose a model interactively
  --stackoverflow, -s Search Stack Overflow for relevant links
  --pdf, -p           Provide a PDF file path to include its content as context

Examples:
  npx gen-ai-chat "What is the capital of France?"
  npx gen-ai-chat "What is the capital of France?" -f context.txt
  npx gen-ai-chat "What is the capital of France?" -d contextDir
  npx gen-ai-chat -i
  npx gen-ai-chat --choose-model
  npx gen-ai-chat --write-logs
  npx gen-ai-chat "How to fix a TypeError in JavaScript?" --stackoverflow
  npx gen-ai-chat "Explain the theory of relativity" --pdf document.pdf

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
    console.log(chalk.red("No in-memory logs to write."));
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

  // if (args.includes("--pdf") || args.includes("-p")) {
  //   const pdfIndex = args.indexOf("--pdf") !== -1 ? args.indexOf("--pdf") + 1 : args.indexOf("-p") + 1;
  //   if (pdfIndex < args.length) {
  //     filePath = args[pdfIndex];
  //     const spinner = ora('Reading PDF...').start();
  //     try {
  //       const pdfContent = await readPDF(path.resolve(filePath));
  //       question = `${question}\n\nContext:\n${pdfContent}`;
  //       spinner.succeed(chalk.green('PDF read successfully.'));

  //       if (selectedModel !== "gemini-1.5-flash-latest") {
  //         console.log(chalk.yellow("TIP: For better responses with PDF content, consider using the 'gemini-1.5-flash-latest' model."));
  //       }
  //     } catch (error) {
  //       spinner.fail(chalk.red("Error reading PDF:"));
  //       console.error(error);
  //       process.exit(1);
  //     }
  //   } else {
  //     console.log(chalk.red("Please provide a PDF file path after the --pdf or -p flag."));
  //     process.exit(1);
  //   }
  // }

  if (args.includes("-i") || args.includes("--interactive")) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'gen-ai-chat> ',
      historySize: 100,
      completer: (line) => {
        const completions = ['exit', 'help', 'version', 'clear', 'model'];
        const hits = completions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : completions, line];
      }
    });

    console.log("Welcome to Google Generative AI CLI Interactive Mode!");
    console.log("Type 'exit' to quit, 'help' for assistance, 'version' to see the version number, 'clear' to clear the screen, or 'model' to switch models.");
    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      switch (input.toLowerCase()) {
        case 'exit':
          rl.close();
          break;
        case 'help':
          console.log("Available commands: exit, help, version, clear, model");
          rl.prompt();
          break;
        case 'version':
          console.log(`gen-ai-chat version: ${version}`);
          rl.prompt();
          break;
        case 'clear':
          console.clear();
          rl.prompt();
          break;
        case 'model':
          await selectModel();
          rl.prompt();
          break;
        default:
          await ask(input, true, searchSO);
          rl.prompt();
          break;
      }
    }).on('close', () => {
      console.log('Exiting interactive mode.');
      process.exit(0);
    });
  } else {
    if (question) {
      const { logResponses } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'logResponses',
          message: 'Do you want to log the responses?',
          default: true
        }
      ]);

      await ask(question, logResponses, searchSO);
    } else {
      console.log("Please ask a question!");
      process.exit(0);
    }
  }
};

main();
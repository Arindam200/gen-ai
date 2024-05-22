#!/usr/bin/env node

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const userApiKey = process.env.API_KEY;
const myApiKey = "AIzaSyD_XFPL5kqQoVDbfXQSrGrhyqGPGq_n9XI"; 

let apiKey;
let requestCount = 0;
const requestLimit = 10;
const resetInterval = 60 * 60 * 1000;

if (userApiKey) {
  apiKey = userApiKey;
} else {
  apiKey = myApiKey;
  setInterval(() => {
    requestCount = 0;
  }, resetInterval);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function ask(question) {
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

      if (!userApiKey) {
        requestCount++;
      }

      process.exit(0);
    } catch (error) {
      console.error("Error generating content:", error);
      process.exit(1);
    }
  } else {
    console.log("You must enter a prompt when calling this function");
    process.exit(1);
  }
}

const args = process.argv.slice(2);
let question = args.filter(arg => arg !== "-f" && arg !== "-d" && !arg.startsWith("/")).join(" ");
let filePath;
let dirPath;


if (args.includes("-f")) {
  const fileIndex = args.indexOf("-f") + 1;
  if (fileIndex < args.length) {
    filePath = args[fileIndex];
    try {
      const fileContent = fs.readFileSync(path.resolve(filePath), "utf-8");
      question = `${question}\n\nContext:\n${fileContent}`;
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
            const fileContent = fs.readFileSync(path.join(dirPath, file), "utf-8");
            combinedContent += `\n\nContext from ${file}:\n${fileContent}`;
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

if (question) {
  ask(question);
} else {
  console.log("Please ask a question!");
  process.exit(0);
}
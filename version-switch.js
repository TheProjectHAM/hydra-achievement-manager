const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Extensões de arquivos a serem verificados
const extensions = [".js", ".json", ".ts", ".md", ".yml", ".yaml", ".toml"];

// Função para ler entrada do usuário
function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Buscar arquivos recursivamente
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file === "node_modules" || file.startsWith(".")) continue;
      getAllFiles(filePath, fileList);
    } else if (extensions.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Função principal
async function main() {
  const oldVersion = await ask("Digite a versão que deseja substituir (ex: 1.2.3): ");
  if (!/^\d+\.\d+\.\d+$/.test(oldVersion)) {
    console.log("❌ Versão inválida. Use o formato x.y.z");
    return;
  }

  const newVersion = await ask(`Digite a nova versão para substituir "${oldVersion}": `);
  if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.log("❌ Nova versão inválida. Use o formato x.y.z");
    return;
  }

  const files = getAllFiles(process.cwd());
  let count = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, "utf-8");
    if (content.includes(oldVersion)) {
      content = content.split(oldVersion).join(newVersion);
      fs.writeFileSync(file, content, "utf-8");
      console.log(`✔️ Atualizado: ${file}`);
      count++;
    }
  }

  console.log(`\n✅ Substituída "${oldVersion}" por "${newVersion}" em ${count} arquivos.`);
}

main().catch(console.error);

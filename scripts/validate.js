// 驗證 index.html 內的房貸試算邏輯與資料是否正常
// 在 CI 中執行：node scripts/validate.js
// 任何一項檢查失敗就以非 0 狀態結束，CI 會擋下部署

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(filePath, 'utf8');

let failures = [];

function check(label, fn) {
  try {
    const result = fn();
    if (result === false) failures.push(label);
    else console.log(`  通過：${label}`);
  } catch (e) {
    failures.push(`${label}（拋出例外：${e.message}）`);
  }
}

console.log('開始驗證 index.html ...\n');

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
check('找得到 <script> 區塊', () => !!scriptMatch);

const scriptContent = scriptMatch ? scriptMatch[1] : '';

check('JS 語法可解析（無語法錯誤）', () => {
  new Function(scriptContent);
  return true;
});

const bankDataMatch = scriptContent.match(/const bankData = (\[[\s\S]*?\]);/);
check('找得到 bankData 陣列', () => !!bankDataMatch);

let bankData = [];
if (bankDataMatch) {
  bankData = eval(bankDataMatch[1]);
}

check('bankData 至少有 40 個方案', () => bankData.length >= 40);

check('每個方案都有 ltvMax（成數預設值）', () => {
  return bankData.every(p => typeof p.ltvMax === 'number' && p.ltvMax > 0 && p.ltvMax <= 100);
});

check('每個方案都有 id / bank / name / rate1 / term / grace', () => {
  return bankData.every(p =>
    p.id && p.bank && p.name &&
    typeof p.rate1 === 'number' &&
    typeof p.term === 'number' &&
    typeof p.grace === 'number'
  );
});

check('id 沒有重複', () => {
  const ids = bankData.map(p => p.id);
  return new Set(ids).size === ids.length;
});

check('不含「同上」殘留字樣', () => {
  const text = JSON.stringify(bankData);
  return !text.includes('同上');
});

check('不含未替換的佔位字樣（TODO / FIXME / XXX）', () => {
  return !/TODO|FIXME|XXX/.test(scriptContent);
});

console.log('');
if (failures.length > 0) {
  console.log('驗證失敗項目：');
  failures.forEach(f => console.log('  ✗ ' + f));
  console.log(`\n共 ${failures.length} 項失敗，中止部署。`);
  process.exit(1);
} else {
  console.log(`全部通過，共 ${bankData.length} 個方案，可以部署。`);
  process.exit(0);
}

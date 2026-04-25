const readline = require('readline');
const { initializeOrResetPassword } = require('../src/services/bootstrapService');

const readArg = (flag) => {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return '';
  return process.argv[idx + 1] || '';
};

const readPositional = (index) => {
  const raw = process.argv[2 + index] || '';
  if (!raw || raw.startsWith('--')) return '';
  return raw;
};

const readPasswordHidden = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Password: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const main = async () => {
  const email = readArg('--email');
  const token = readArg('--token');
  let password = readArg('--password');

  const finalEmail = email || readPositional(0);
  const finalToken = token || readPositional(1);
  let finalPassword = password || readPositional(2);

  if (!finalEmail || !finalToken) {
    throw new Error(
      'Usage: node backend/scripts/init-or-reset-password.js --email user@example.com --token <BOOTSTRAP_ADMIN_TOKEN> [--password <PASSWORD>]\n' +
      'Or: node backend/scripts/init-or-reset-password.js user@example.com <BOOTSTRAP_ADMIN_TOKEN> [PASSWORD]'
    );
  }

  if (!finalPassword) {
    finalPassword = await readPasswordHidden();
  }

  const user = await initializeOrResetPassword({
    email: finalEmail,
    password: finalPassword,
    bootstrapToken: finalToken,
  });

  console.log(`Password updated for user: ${user.email} (${user.id})`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

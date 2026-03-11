const fs = require('fs');
const path = require('path');

const envFile = `
export const environment = {
  production: true,
  supabaseUrl: '${process.env.SUPABASE_URL || 'https://guxrqydblcgtgnpwviii.supabase.co'}',
  supabaseKey: '${process.env.SUPABASE_KEY || 'sb_publishable_ozoSPkvZ98WADxXSPEKj-w_Mdgorh2r'}'
};
`;

const dir = './src/environments';
if (!require('fs').existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
}

require('fs').writeFileSync(path.join(dir, 'environment.prod.ts'), envFile);
require('fs').writeFileSync(path.join(dir, 'environment.ts'), envFile);

console.log('Environment files generated successfully.');

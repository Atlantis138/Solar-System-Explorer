import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import vinext from 'vinext';
import hostingConfig from './.openai/hosting.json';
import { sites } from './build/sites-vite-plugin';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return (async () => {
      process.env.WRANGLER_WRITE_LOGS ??= 'false';
      process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
      process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

      const { cloudflare } = await import('@cloudflare/vite-plugin');
      const { d1, r2 } = hostingConfig as { d1?: string | null; r2?: string | null };
      const placeholderDatabaseId = '00000000-0000-4000-8000-000000000000';

      return {
        server: {
          port: 3000,
          host: '0.0.0.0',
          allowedHosts: ['terminal.local'],
        },
        plugins: [
          vinext(),
          sites(),
          cloudflare({
            viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
            config: {
              main: './worker/index.ts',
              compatibility_flags: ['nodejs_compat'],
              d1_databases: d1
                ? [{ binding: d1, database_name: 'site-creator-d1', database_id: placeholderDatabaseId }]
                : [],
              r2_buckets: r2
                ? [{ binding: r2, bucket_name: 'site-creator-r2' }]
                : [],
            },
          }),
        ],
        define: {
          'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
          'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, '.'),
          },
        },
      };
    })();
});

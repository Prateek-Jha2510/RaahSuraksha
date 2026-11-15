import {defineConfig,loadEnv} from 'vite';
import {services} from './routing-api.js';
export default defineConfig(({mode})=>{
  const api=services({...loadEnv(mode,process.cwd(),''),...process.env});
  const install=server=>{server.middlewares.use('/api',api);};
  return {server:{fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.raah-data/**','**/.cache/**']}},
    plugins:[{name:'walking-routes',configureServer:install,configurePreviewServer:install}]};
});

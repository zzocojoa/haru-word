import { buildDashboard } from './openai-dashboard-data.mjs';

try { console.log(JSON.stringify(await buildDashboard())); }
catch { console.error('작업 대시보드를 만들지 못했습니다. Task Master 작업 JSON과 계획 manifest를 확인해 주세요.'); process.exitCode = 1; }

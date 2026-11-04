import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUTPUT_DIRECTORY = 'outputs/openai-migration-dashboard';

const text = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const identifier = value => {
  const id = String(value);
  if (!/^[1-9]\d*$/.test(id)) throw new Error('invalid_task_id');
  return id;
};
function taskDocument(task, child = false) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) throw new Error('invalid_task');
  return {
    id: identifier(task.id), title: text(task.title, '제목 없음'),
    description: text(task.description), details: text(task.details),
    testStrategy: text(task.testStrategy), status: text(task.status, 'unknown'),
    priority: text(task.priority, 'medium'),
    dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(String) : [],
    ...(child ? {} : { subtasks: (Array.isArray(task.subtasks) ? task.subtasks : []).map(s => taskDocument(s, true)) }),
  };
}

export function normalizeDashboard(tasksFile, manifest, source = {}) {
  if (!manifest || !Array.isArray(manifest.tasks) || !Array.isArray(manifest.gates)) throw new Error('invalid_manifest');
  const tag = text(manifest.tag, 'master');
  const collection = Object.hasOwn(tasksFile, tag) ? tasksFile[tag]?.tasks : tasksFile.tasks;
  if (!Array.isArray(collection)) throw new Error('missing_tasks');
  const planTasks = manifest.tasks.map(t => ({ id: identifier(t.id), phase: Number(t.phase) || 0, subtaskCount: Number(t.subtaskCount) || 0 }));
  const ids = new Set(planTasks.map(t => t.id));
  const selected = collection.filter(t => ids.has(String(t.id))).map(t => taskDocument(t));
  if (!selected.length && planTasks.length) throw new Error('missing_plan_tasks');
  if (new Set(selected.map(t => t.id)).size !== selected.length) throw new Error('duplicate_tasks');
  for (const task of selected) if (new Set(task.subtasks.map(s => s.id)).size !== task.subtasks.length) throw new Error('duplicate_subtasks');
  return {
    schemaVersion: 1,
    source: { mode: 'snapshot', tag, readAt: new Date().toISOString(), updatedAt: null, hash: '', ...source },
    plan: {
      id: text(manifest.planId), title: text(manifest.title, 'OpenAI API 전환'),
      description: text(manifest.description, 'API 전환부터 판단 개선까지. Task Master의 실제 작업 상태를 확인합니다.'),
      phaseLabels: { 1: text(manifest.phaseLabels?.[1], 'OpenAI 전환'), 2: text(manifest.phaseLabels?.[2], '판단 개선') }, tasks: planTasks,
      requirements: Array.isArray(manifest.requirements) ? manifest.requirements.map(r => ({ id: text(r.id), text: text(r.text), tasks: Array.isArray(r.tasks) ? r.tasks.map(String) : [] })) : [],
      gates: manifest.gates.map(g => ({ id: text(g.id), name: text(g.name), criteria: text(g.criteria), tasks: Array.isArray(g.tasks) ? g.tasks.map(String) : [],
        result: ['passed','held','pending'].includes(g.result?.status) ? { status:g.result.status, detail:text(g.result.detail) } : null })),
    },
    tasks: selected,
  };
}

export async function readDashboardSnapshot(root = PROJECT_ROOT, planId) {
  const taskPath = resolve(root, '.taskmaster/tasks/tasks.json');
  const registryPath = resolve(root, '.taskmaster/docs/dashboard-plans.json');
  let registry;
  try {
    if ((await stat(registryPath)).size > 100_000) throw new Error('source_too_large');
    registry = JSON.parse(await readFile(registryPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    registry = { defaultPlanId: 'openai-api-migration-2026-11-03', plans: [{ id:'openai-api-migration-2026-11-03', label:'OpenAI 전환', manifest:'.taskmaster/docs/openai-migration-manifest.json' }] };
  }
  if (!Array.isArray(registry.plans) || !registry.plans.length || registry.plans.length > 8
    || registry.plans.some(p=>!p || !/^[a-z0-9][a-z0-9-]{1,80}$/.test(p.id) || !/^\.taskmaster\/docs\/[a-z0-9-]+\.json$/.test(p.manifest))
    || new Set(registry.plans.map(p=>p.id)).size !== registry.plans.length
    || !registry.plans.some(p=>p.id===registry.defaultPlanId)) throw new Error('invalid_plan_registry');
  const selected = planId ?? registry.defaultPlanId;
  if (!registry.plans.some(p=>p.id===selected)) throw new Error('unknown_plan');
  const taskStat = await stat(taskPath);
  if (taskStat.size > 4_000_000) throw new Error('source_too_large');
  const rawTasks = await readFile(taskPath, 'utf8'), tasks = JSON.parse(rawTasks);
  const snapshots = await Promise.all(registry.plans.map(async entry=>{
    const manifestPath=resolve(root,entry.manifest);
    if ((await stat(manifestPath)).size > 1_000_000) throw new Error('source_too_large');
    const rawManifest=await readFile(manifestPath,'utf8'),manifest=JSON.parse(rawManifest);
    if (manifest.planId !== entry.id) throw new Error('plan_id_mismatch');
    const hash=createHash('sha256').update(rawTasks).update(rawManifest).digest('hex');
    const snapshot=normalizeDashboard(tasks,manifest,{mode:'live',updatedAt:taskStat.mtime.toISOString(),hash});
    snapshot.plan.context=text(entry.context);snapshot.plan.budget=text(entry.budget);snapshot.plan.kind=text(entry.kind);
    if(manifest.executionStarted&&entry.kind==='current'){
      snapshot.plan.context=text(manifest.execution?.dashboardContext,'승인한 수정 플랜 구현 진행 중. 새 유료 평가와 기존 사이트 배포를 포함하며 품질 미달·미측정이면 배포를 보류합니다.');
      const current=manifest.execution?.currentEvaluation;
      snapshot.plan.budget=current?'후속 평가 추가 US$'+current.approvedMaxUsd+' · 이번 보수적 사용 US$'+current.usedUsd+' · 이전 종료 원장과 별도':'새 평가 추가 US$'+manifest.authorization.newEvaluationMaxUsdBeforeTax+' · 보수적 사용 US$'+manifest.authorization.newEvaluationUsedUsdBeforeTax+' · 과거 평가 원장과 별도';
      const next=manifest.execution?.nextEvaluationProposal;
      if(current?.closed&&next?.preparationReady&&next.approved===false)snapshot.plan.budget='직전 평가 종료 · 상한 US$'+current.approvedMaxUsd+' / 보수적 사용 US$'+current.usedUsd+' · 새 평가 US$'+next.maxUsdBeforeTax+' 제안(미승인)';
    }
    return [entry.id,snapshot];
  }));
  const planSnapshots=Object.fromEntries(snapshots);
  return { ...planSnapshots[selected], catalog:{defaultPlanId:registry.defaultPlanId,plans:registry.plans.map(p=>({id:p.id,label:text(p.label),kind:text(p.kind)}))}, planSnapshots };
}

export function safeEmbeddedJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

export async function renderDashboard(snapshot) {
  const dir = resolve(PROJECT_ROOT, '.taskmaster/dashboard');
  const [template, css, js] = await Promise.all([
    readFile(resolve(dir, 'index.template.html'), 'utf8'),
    readFile(resolve(dir, 'dashboard.css'), 'utf8'),
    readFile(resolve(dir, 'dashboard.js'), 'utf8'),
  ]);
  const replacements = { '<!-- DASHBOARD_STYLE -->': css, '<!-- DASHBOARD_DATA -->': safeEmbeddedJson(snapshot), '<!-- DASHBOARD_SCRIPT -->': js };
  let html = template;
  for (const [marker, content] of Object.entries(replacements)) {
    if (html.split(marker).length !== 2) throw new Error('invalid_template_marker');
    html = html.replace(marker, () => content);
  }
  return html;
}

export async function buildDashboard(root = PROJECT_ROOT) {
  const snapshot = await readDashboardSnapshot(root);
  snapshot.source.mode = 'snapshot';
  const html = await renderDashboard(snapshot);
  const output = resolve(root, OUTPUT_DIRECTORY);
  await mkdir(output, { recursive: true });
  const path = resolve(output, 'index.html');
  await writeFile(path, html, 'utf8');
  return { path, tasks: snapshot.tasks.length, subtasks: snapshot.tasks.reduce((n,t)=>n+t.subtasks.length,0), sourceHash: snapshot.source.hash, selectedPlan:snapshot.plan.id, plans:snapshot.catalog.plans.map(p=>p.id) };
}

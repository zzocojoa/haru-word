// Static syntax/provenance only. Never execute candidate programs or certify English.
import {readFileSync,realpathSync,lstatSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),sha=x=>createHash('sha256').update(x).digest('hex'),check=(v,c)=>{if(!v)throw Error('PLR1_'+c);};
export const PROGRAM_LITERAL_ROLES_V1='ai-quality-v147-program-literal-syntax-roles-v1';
export const PROGRAM_LITERAL_AUDIT_FILE_V1='.taskmaster/evaluation/ai-quality-v147/program-literal-exposure-audit-v1.json';
export const PROGRAM_LITERAL_AUDIT_SHA_V1='1ab0a8f82d004cc588a1dc7b737c0d007dad58334e5e9d9a0d8be8a7fd56d8c0';
const here=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),read=f=>JSON.parse(readFileSync(f,'utf8'));
const name=n=>n&&(ts.isIdentifier(n)||ts.isStringLiteral(n))?n.text:null;
const callee=n=>ts.isIdentifier(n)?n.text:ts.isPropertyAccessExpression(n)?callee(n.expression)+'.'+name(n.name):'<dynamic>';
const bindings=n=>ts.isIdentifier(n)?n.text:ts.isArrayBindingPattern(n)?n.elements.map(x=>ts.isBindingElement(x)?bindings(x.name):null):null;
const namedRoles={sentence:'declared-sentence',original:'declared-original',correctedSentence:'proposed-correction',correction:'proposed-correction',corrected:'proposed-correction',before:'declared-before',example:'example',answer:'answer',explanation:'explanation',notes:'notes',correctionReason:'explanation',grammarReason:'explanation',contextNote:'context',stem:'question-stem',message:'message',expression:'expression'};
function features(node,ast){
 const ancestry=[];let child=node;
 for(let p=node.parent;p;p=p.parent){
  if(ts.isPropertyAssignment(p))ancestry.push({kind:'property',name:name(p.name),start:p.getStart(ast),end:p.end});
  if(ts.isVariableDeclaration(p))ancestry.push({kind:'variable',bindings:bindings(p.name),start:p.getStart(ast),end:p.end});
  if(ts.isCallExpression(p))ancestry.push({kind:'call',callee:callee(p.expression),argumentIndex:p.arguments.indexOf(child),start:p.getStart(ast),end:p.end});
  if(ts.isArrayLiteralExpression(p))ancestry.push({kind:'array',index:p.elements.indexOf(child),start:p.getStart(ast),end:p.end});
  if(ts.isForOfStatement(p)&&p.expression===child){const declaration=ts.isVariableDeclarationList(p.initializer)&&p.initializer.declarations[0];ancestry.push({kind:'for-of',bindings:declaration?bindings(declaration.name):null,start:p.getStart(ast),end:p.end});}
  child=p;
 }
 return {parentSyntaxKind:ts.SyntaxKind[node.parent.kind],ancestry};
}
function classify(f){
 for(const context of f.ancestry){
  const common={evidence:context,semanticRoleCertified:false};
  if(context.kind==='property')return {...common,role:namedRoles[context.name]??'property-value',basis:'named-object-property'};
  if(context.kind==='variable')return {...common,role:typeof context.bindings==='string'?(namedRoles[context.bindings]??'variable-initializer'):'variable-component',basis:'enclosing-variable-declaration'};
  if(context.kind==='for-of'){const path=f.ancestry.filter(x=>x.kind==='array'&&x.start>=context.start&&x.end<=context.end).map(x=>x.index),binding=typeof context.bindings==='string'?context.bindings:Array.isArray(context.bindings)&&path.length>1?context.bindings[path[0]]:null;return {...common,role:typeof binding==='string'?(namedRoles[binding]??'loop-binding'):'loop-component',basis:'literal-iterable-binding',binding:binding??null,arrayPath:path};}
  if(context.kind==='call'&&context.argumentIndex>=0){
   if(context.callee==='sqlite.prepare'&&context.argumentIndex===0&&f.parentSyntaxKind==='CallExpression')return {...common,role:'sql-statement',basis:'sqlite.prepare-argument-0'};
   if(context.callee==='test'&&context.argumentIndex===0)return {...common,role:'test-description',basis:'test-argument-0'};
   if(/^assert\./.test(context.callee))return {...common,role:context.argumentIndex===0?'assertion-observed-value':'assertion-expected-or-message',basis:'assertion-argument'};
   return {...common,role:'call-argument',basis:'enclosing-call-argument'};
  }
 }
 return {role:'unresolved-syntax-context',basis:'no-supported-role-rule',evidence:null,semanticRoleCertified:false};
}
export function classifyProgramLiteralFileV1(file,sourceText,expected){
 check(/^tests\/[A-Za-z0-9_.-]+\.test\.mjs$/.test(file)&&sha(sourceText)===expected.sourceSha256,'SOURCE_BINDING');const ast=ts.createSourceFile(file,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);check(ast.parseDiagnostics.length===0,'PARSE');const nodes=new Map();
 function visit(n){if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))nodes.set(n.getStart(ast)+':'+n.end,n);ts.forEachChild(n,visit);}visit(ast);
 return expected.literals.map(row=>{const node=nodes.get(row.utf16Start+':'+row.utf16End);check(node&&node.text===row.value&&sha(sourceText.slice(node.getStart(ast),node.end))===row.sourceSliceSha256,'OCCURRENCE_BINDING');const use=features(node,ast);return {id:row.id,sourceFile:file,sourceSha256:expected.sourceSha256,utf16Start:row.utf16Start,utf16End:row.utf16End,line:row.line,columnUtf16:row.columnUtf16,sourceSliceSha256:row.sourceSliceSha256,normalizedSha256:row.normalizedSha256,...classify(use),use,exclusionDisposition:'quarantine-exact-known-program-candidate',englishOriginalCertified:false};});
}
export function buildProgramLiteralRolesV1({audit,sources}){
 const {sha256,...basis}=audit;check(audit.protocol==='ai-quality-v147-local-program-literal-audit-v1'&&sha(JSON.stringify(basis))===sha256,'AUDIT_HASH');check(Object.keys(sources).sort().join('|')===Object.keys(audit.sourceBindings).sort().join('|'),'SOURCE_SET');
 const occurrences=audit.files.flatMap(f=>classifyProgramLiteralFileV1(f.sourceFile,sources[f.sourceFile],f));check(occurrences.length===audit.counts.candidateLiteralOccurrences&&new Set(occurrences.map(x=>x.id)).size===occurrences.length,'DENOMINATOR');
 const surfaces=audit.surfaces.map(s=>{const rows=occurrences.filter(x=>x.normalizedSha256===s.normalizedSha256);check(digest(rows.map(x=>x.id))===digest(s.originIds),'ORIGINS');return {normalizedSha256:s.normalizedSha256,originIds:[...s.originIds],roles:[...new Set(rows.map(x=>x.role))].sort(),alreadyInSelected426Corpus:s.alreadyInSelected426Corpus,exclusionDisposition:'quarantine-exact-known-program-candidate'};});
 const roleCounts={};for(const row of occurrences)roleCounts[row.role]=(roleCounts[row.role]??0)+1;
 const report={protocol:PROGRAM_LITERAL_ROLES_V1,parser:{package:'typescript',version:ts.version,sourceExecutionPerformed:false},auditHash:sha256,sourceBindings:{...audit.sourceBindings},occurrences,surfaces,counts:{files:audit.files.length,occurrences:occurrences.length,surfaces:surfaces.length,outsideSelected426:surfaces.filter(x=>!x.alreadyInSelected426Corpus).length,roleCounts},classificationKind:'syntactic-use-not-dataflow-or-English-truth',allCandidatesAccountedFor:true,allActualInputsIdentified:false,completeProjectExposure:false,structuralFamiliesCertified:false,modelSourceTextForwarded:false,actualEnglishQualityMeasured:false,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0};return {...report,hash:digest(report)};
}
export function loadProgramLiteralRolesV1(sourceRoot=null){
 const source=resolve(sourceRoot??read(resolve(here,'.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.sourceRoot),auditFile=resolve(source,PROGRAM_LITERAL_AUDIT_FILE_V1);check(realpathSync(auditFile)===auditFile&&!lstatSync(auditFile).isSymbolicLink()&&sha(readFileSync(auditFile))===PROGRAM_LITERAL_AUDIT_SHA_V1,'AUDIT_FILE');const audit=read(auditFile).result,sources={};
 for(const [f,h]of Object.entries(audit.sourceBindings)){const p=resolve(source,f);check(p.startsWith(source+sep)&&realpathSync(p)===p&&!lstatSync(p).isSymbolicLink(),'SOURCE_PATH');const text=readFileSync(p,'utf8');check(sha(text)===h,'SOURCE_BINDING');sources[f]=text;}
 return {result:buildProgramLiteralRolesV1({audit,sources}),sourceBindings:{[PROGRAM_LITERAL_AUDIT_FILE_V1]:PROGRAM_LITERAL_AUDIT_SHA_V1,...audit.sourceBindings},typescriptPackageSha256:sha(readFileSync(require.resolve('typescript/package.json'))),typescriptParserSha256:sha(readFileSync(require.resolve('typescript')))};
}

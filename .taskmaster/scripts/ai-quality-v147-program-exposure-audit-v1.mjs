// Local-only candidate audit. Parse source;never execute test programs or feed
// these unreviewed literals/corrections/test descriptions to model requests.
import {readFileSync,realpathSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {normalizedExposureSentenceV1} from './ai-quality-v147-exposure-v1.mjs';
import {validateGlobalExposureCorpusV1} from './ai-quality-v147-global-exposure-v1.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),sha=v=>createHash('sha256').update(v).digest('hex'),read=f=>JSON.parse(readFileSync(f,'utf8'));
const check=(ok,c)=>{if(!ok)throw Error('PA1_'+c);};
export const PROGRAM_EXPOSURE_AUDIT_V1='ai-quality-v147-local-program-literal-audit-v1';
const AUDIT_SHA='2528492a922f7fcacfc69da808768ad84b79ea789ac21444f1811631e8bd74a1',GLOBAL_SHA='147f8dd416a6f43685b55a7894adbddba21b6453255ae664b0b1bd3e79611013';
function candidateText(value){return typeof value==='string'&&value.isWellFormed()&&value.length<=2000&&!/[\r\n]/.test(value)&&/[.!?]["']?$/.test(value)&&(value.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)??[]).length>=2&&!/^https?:\/\//i.test(value);}
function sensitive(value,node){return /\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}/.test(value)||[node.parent?.name?.text,node.parent?.parent?.name?.text].some(x=>typeof x==='string'&&/(?:secret|token|apikey|api_key|password)/i.test(x));}
export function extractProgramLiteralCandidatesV1(sourceFile,sourceText){
 check(/^tests\/[A-Za-z0-9_.-]+\.test\.mjs$/.test(sourceFile)&&typeof sourceText==='string'&&sourceText.isWellFormed(),'SOURCE');
 const ast=ts.createSourceFile(sourceFile,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);check(ast.parseDiagnostics.length===0,'PARSE');
 const sourceSha256=sha(sourceText),literals=[],templates=[],excluded={otherStaticStrings:0,sensitiveStaticStrings:0,noncandidateTemplates:0,sensitiveTemplates:0};let staticStringsVisited=0,templateExpressionsVisited=0;
 const origin=n=>{const start=n.getStart(ast),pos=ast.getLineAndCharacterOfPosition(start);return {sourceFile,sourceSha256,utf16Start:start,utf16End:n.end,line:pos.line+1,columnUtf16:pos.character+1,sourceSliceSha256:sha(sourceText.slice(start,n.end)),parentSyntaxKind:ts.SyntaxKind[n.parent.kind]};};
 function visit(n){
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)){
   staticStringsVisited++;if(sensitive(n.text,n))excluded.sensitiveStaticStrings++;else if(candidateText(n.text)){const at=origin(n);literals.push({id:'program-literal-'+sha(sourceFile+':'+at.utf16Start+':'+at.utf16End).slice(0,24),...at,value:n.text,normalizedSha256:sha(normalizedExposureSentenceV1(n.text)),semanticRole:'unreviewed-program-text;may-be-input,correction,description-or-other'});}else excluded.otherStaticStrings++;
  }else if(ts.isTemplateExpression(n)){
   templateExpressionsVisited++;const parts=[n.head.text,...n.templateSpans.map(x=>x.literal.text)],combined=parts.join(' VARIABLE ');
   if(sensitive(combined,n))excluded.sensitiveTemplates++;else if(candidateText(combined)){const at=origin(n);templates.push({id:'program-template-'+sha(sourceFile+':'+at.utf16Start+':'+at.utf16End).slice(0,24),...at,staticParts:parts,holes:n.templateSpans.map(x=>({syntaxKind:ts.SyntaxKind[x.expression.kind],expressionSha256:sha(x.expression.getText(ast))})),dynamicExpansionExecuted:false,allGeneratedSentencesEnumerated:false});}else excluded.noncandidateTemplates++;
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);check(staticStringsVisited===literals.length+excluded.otherStaticStrings+excluded.sensitiveStaticStrings,'STATIC_DENOMINATOR');check(templateExpressionsVisited===templates.length+excluded.noncandidateTemplates+excluded.sensitiveTemplates,'TEMPLATE_DENOMINATOR');
 return {sourceFile,sourceSha256,staticStringsVisited,templateExpressionsVisited,excluded,literals,templates,completeForDeclaredAstFilter:true,allActualInputsIdentified:false};
}
export function buildProgramExposureAuditV1({sources,existingCorpus}){
 validateGlobalExposureCorpusV1(existingCorpus);check(sources&&Object.keys(sources).length>0,'SOURCES');const files=Object.keys(sources).sort().map(f=>extractProgramLiteralCandidatesV1(f,sources[f])),known=new Set(existingCorpus.records.map(r=>r.normalizedSha256)),map=new Map();
 for(const file of files)for(const row of file.literals){let r=map.get(row.normalizedSha256);if(!r){r={normalizedSha256:row.normalizedSha256,value:row.value,alreadyInSelected426Corpus:known.has(row.normalizedSha256),originIds:[]};map.set(row.normalizedSha256,r);}r.originIds.push(row.id);}
 const surfaces=[...map.values()].sort((a,b)=>a.normalizedSha256.localeCompare(b.normalizedSha256)),basis={protocol:PROGRAM_EXPOSURE_AUDIT_V1,scope:'Local candidate audit ofdeclared static sentence-like strings/templates inselected test programs. Not a model payload or a certified original-input inventory.',parser:{package:'typescript',version:ts.version,sourceExecutionPerformed:false},existingCorpusHash:existingCorpus.hash,sourceBindings:Object.fromEntries(files.map(f=>[f.sourceFile,f.sourceSha256])),files,surfaces,counts:{files:files.length,staticStringsVisited:files.reduce((n,f)=>n+f.staticStringsVisited,0),templateExpressionsVisited:files.reduce((n,f)=>n+f.templateExpressionsVisited,0),candidateLiteralOccurrences:files.reduce((n,f)=>n+f.literals.length,0),uniqueCandidateSurfaces:surfaces.length,candidateSurfacesOutsideSelected426:surfaces.filter(x=>!x.alreadyInSelected426Corpus).length,unexpandedCandidateTemplates:files.reduce((n,f)=>n+f.templates.length,0)},completeForDeclaredAstFilter:true,allActualInputsIdentified:false,allGeneratedSentencesEnumerated:false,completeProjectExposure:false,structuralFamiliesCertified:false,modelEvidenceProjectionAllowed:false,liveFreshnessPolicyChanged:false,actualEnglishQualityMeasured:false,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0};return {...basis,sha256:sha(JSON.stringify(basis))};
}
export function matchProgramExposureAuditV1(audit,sentence){
 const {sha256,...basis}=audit;check(audit.protocol===PROGRAM_EXPOSURE_AUDIT_V1&&sha(JSON.stringify(basis))===sha256&&typeof sentence==='string'&&sentence.isWellFormed(),'MATCH_BINDING');const key=sha(normalizedExposureSentenceV1(sentence)),matches=audit.surfaces.filter(r=>r.normalizedSha256===key);return {state:matches.length?'seen-program-text-candidate':'unresolved-not-a-freshness-clearance',matchingOriginIds:matches.flatMap(x=>x.originIds),freshnessQualified:false,originalInputRoleCertified:false,structuralFamilyCertified:false};
}
export function loadProgramExposureAuditV1(sourceRoot=null){
 const here=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),manifest=read(resolve(here,'.taskmaster/docs/ai-quality-v147-manifest.json')),source=resolve(sourceRoot??manifest.baseline.sourceRoot),root=resolve(manifest.baseline.existingDashboardRoot),auditFile=resolve(root,'outputs/ai-quality-v147-implementation-20261106/phase36/source-coverage-audit.json'),globalFile=resolve(source,'.taskmaster/evaluation/ai-quality-v147/global-exposure-corpus-v1.json');
 check(sha(readFileSync(auditFile))===AUDIT_SHA&&sha(readFileSync(globalFile))===GLOBAL_SHA,'BASELINE');const audit=read(auditFile),bindings=audit.programFilesNotExtracted;check(Object.keys(bindings).length===123,'SOURCE_COUNT');const sources={};
 for(const [f,h]of Object.entries(bindings)){check(/^tests\/[A-Za-z0-9_.-]+\.test\.mjs$/.test(f),'SOURCE_PATH');const path=resolve(source,f);check(path.startsWith(source+sep)&&!lstatSync(path).isSymbolicLink()&&realpathSync(path)===path,'SOURCE_PATH');const raw=readFileSync(path);check(sha(raw)===h,'SOURCE_CHANGED');sources[f]=raw.toString('utf8');}
 const result=buildProgramExposureAuditV1({sources,existingCorpus:read(globalFile)});return {result,baselineCoverageSha256:AUDIT_SHA,existingCorpusFile:'.taskmaster/evaluation/ai-quality-v147/global-exposure-corpus-v1.json',existingCorpusSha256:GLOBAL_SHA,typescriptPackageSha256:sha(readFileSync(require.resolve('typescript/package.json'))),typescriptParserSha256:sha(readFileSync(require.resolve('typescript')))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=loadProgramExposureAuditV1();if(process.env.QA_OUTPUT_DIR){const out=resolve(process.env.QA_OUTPUT_DIR);mkdirSync(out,{recursive:false});writeFileSync(resolve(out,'program-exposure-audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}console.log(JSON.stringify({...report.result.counts,allActualInputsIdentified:false,completeProjectExposure:false,liveFreshnessPolicyChanged:false,actualProviderCalls:0}));
}

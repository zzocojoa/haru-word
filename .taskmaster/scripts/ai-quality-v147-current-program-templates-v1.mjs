// Current frozen-source finite template extraction. Parse syntax/data only:
// never import selected tests, execute loops/SQL, or evaluate interpolation code.
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFiniteStringTableV1} from './ai-quality-v147-program-template-expansion-v1.mjs';
import {normalizedExposureSentenceV1} from './ai-quality-v147-exposure-v1.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
const sha=x=>createHash('sha256').update(x).digest('hex'),read=f=>JSON.parse(readFileSync(f,'utf8'));
const check=(ok,c)=>{if(!ok)throw Error('CPT1_'+c);};
const auditFile='outputs/ai-quality-v147-implementation-20261106/phase186/current-program-ast-audit.json';
const auditSha='2758ea6bf3f77b5a21fd9185d881cf983b38a3d259d8c9a1a5f7f65a18ce8d1e';
const mannerFile='lib/feedback-manner-adjectives.ts',wordsFile='data/words.json';
export const CURRENT_PROGRAM_TEMPLATES_V1='ai-quality-v147-current-finite-program-templates-v1';

function parse(file,text){
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
 check(ast.parseDiagnostics.length===0,'PARSE');return ast;
}
function origin(node,ast,file,text){
 const start=node.getStart(ast),pos=ast.getLineAndCharacterOfPosition(start);
 return {sourceFile:file,sourceSha256:sha(text),utf16Start:start,utf16End:node.end,line:pos.line+1,
  columnUtf16:pos.character+1,sourceSliceSha256:sha(text.slice(start,node.end))};
}
function bindingNames(node){
 if(ts.isIdentifier(node))return [node.text];
 check(ts.isArrayBindingPattern(node)&&node.elements.every(e=>ts.isBindingElement(e)&&!e.dotDotDotToken&&!e.initializer&&ts.isIdentifier(e.name)),'BINDING');
 return node.elements.map(e=>e.name.text);
}
function loopFor(node){
 let n=node.parent;while(n&&!ts.isForOfStatement(n))n=n.parent;
 check(n&&!n.awaitModifier&&ts.isVariableDeclarationList(n.initializer)&&(n.initializer.flags&ts.NodeFlags.Const)
  &&n.initializer.declarations.length===1,'FINITE_LOOP');return n;
}
function checkUnshadowed(hole,loop,name){
 for(let n=hole.parent;n&&n!==loop;n=n.parent){
  if((ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))
   &&n.parameters.some(p=>bindingNames(p.name).includes(name)))throw Error('CPT1_SHADOWED_HOLE');
  if(ts.isBlock(n))for(const st of n.statements)if(ts.isVariableStatement(st))
   for(const d of st.declarationList.declarations)check(!bindingNames(d.name).includes(name),'SHADOWED_HOLE');
 }
}
function mannerTable(mannerSource,wordRows){
 const ast=parse(mannerFile,mannerSource);let declaration=null;
 for(const st of ast.statements)if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)
  if(ts.isIdentifier(d.name)&&d.name.text==='PRODUCTIVE_MANNER_ADJECTIVES'){check(!declaration,'MANNER_DUPLICATE');declaration=d;}
 check(declaration?.initializer,'MANNER_DECLARATION');
 const values=readFiniteStringTableV1(declaration.initializer.getText(ast));
 const dictionary=[...new Set(wordRows.filter(w=>w.pos==='adj.'&&/^[a-z]+(?:ful|less)$/.test(w.word)).map(w=>w.word))].sort();
 check(values.every(v=>typeof v==='string')&&JSON.stringify(values)===JSON.stringify(dictionary),'MANNER_PROVENANCE');
 return {values,at:origin(declaration.initializer,ast,mannerFile,mannerSource)};
}
function nonLearningRole(node,parts,ast){
 const call=node.parent;
 if(!ts.isCallExpression(call)||!ts.isPropertyAccessExpression(call.expression))return null;
 const callee=call.expression.getText(ast);
 if(callee==='sqlite.prepare'&&parts.join('VARIABLE')==='DELETE FROM VARIABLE WHERE user_id=?')return 'verified-sql-statement';
 if(callee==='assert.equal'&&call.arguments[0]?.getText(ast)==='rule'&&parts.join('').startsWith('새 단어 '))return 'verified-korean-ui-guidance';
 return null;
}
export function buildCurrentProgramTemplatesV1({audit,sourceTexts,mannerSource,wordRows}){
 const {sha256,...auditBasis}=audit;
 check(sha(JSON.stringify(auditBasis))===sha256&&audit.protocol==='ai-quality-v147-local-program-literal-audit-v1','AUDIT_BINDING');
 const frames=audit.files.flatMap(f=>f.templates);check(frames.length>0&&frames.length<=500,'FRAME_BOUND');
 const manner=mannerTable(mannerSource,wordRows),parsed=new Map(),classified=[],generated=[],unresolved=[];
 for(const frame of frames){
  const text=sourceTexts[frame.sourceFile];check(typeof text==='string'&&sha(text)===audit.sourceBindings[frame.sourceFile],'SOURCE_BINDING');
  let ast=parsed.get(frame.sourceFile);if(!ast){ast=parse(frame.sourceFile,text);parsed.set(frame.sourceFile,ast);}
  let node=null;function find(n){if(ts.isTemplateExpression(n)&&n.getStart(ast)===frame.utf16Start&&n.end===frame.utf16End)node=n;ts.forEachChild(n,find);}find(ast);
  check(node&&sha(text.slice(frame.utf16Start,frame.utf16End))===frame.sourceSliceSha256,'FRAME_BINDING');
  const parts=[node.head.text,...node.templateSpans.map(x=>x.literal.text)];
  check(JSON.stringify(parts)===JSON.stringify(frame.staticParts),'STATIC_PARTS');
  const base={templateId:frame.id,templateOrigin:origin(node,ast,frame.sourceFile,text),sourceExecutionPerformed:false};
  const role=nonLearningRole(node,parts,ast);
  if(role){classified.push({...base,classification:role,expansionCount:0});continue;}
  try{
   const loop=loopFor(node),names=bindingNames(loop.initializer.declarations[0].name);let rows,iterableOrigin;
   if(ts.isIdentifier(loop.expression)){
    check(loop.expression.text==='PRODUCTIVE_MANNER_ADJECTIVES'&&names.length===1&&names[0]==='adjective','ITERABLE_IDENTIFIER');
    check(ast.statements.some(st=>ts.isImportDeclaration(st)&&st.moduleSpecifier.text==='../lib/feedback-manner-adjectives.ts'
     &&st.importClause?.namedBindings?.elements?.some(e=>e.name.text==='PRODUCTIVE_MANNER_ADJECTIVES'&&!e.propertyName)),'MANNER_IMPORT');
    rows=manner.values.map(v=>[v]);iterableOrigin=manner.at;
   }else{
    const table=readFiniteStringTableV1(loop.expression.getText(ast));
    rows=table.map(v=>Array.isArray(v)?v:[v]);iterableOrigin=origin(loop.expression,ast,frame.sourceFile,text);
   }
   check(rows.length<=100&&rows.every(row=>row.length===names.length&&row.every(v=>typeof v==='string')),'ROW_BINDING');
   const holes=node.templateSpans.map(span=>{
    check(ts.isIdentifier(span.expression)&&names.includes(span.expression.text),'HOLE_EXPRESSION');
    checkUnshadowed(span.expression,loop,span.expression.text);return span.expression.text;
   });
   const loopOrigin=origin(loop,ast,frame.sourceFile,text),iterationGroup='iteration-'+sha(frame.sourceFile+':'+loopOrigin.utf16Start+':'+loopOrigin.utf16End).slice(0,24);
   const expanded=rows.map((row,i)=>{
    const bindings=Object.fromEntries(names.map((n,j)=>[n,row[j]]));let sentence=parts[0];
    for(let j=0;j<holes.length;j++)sentence+=bindings[holes[j]]+parts[j+1];
    check(sentence.isWellFormed()&&sentence.length<=2000,'EXPANSION_BOUND');
    return {id:'current-program-expansion-'+sha(frame.id+':'+i).slice(0,24),templateId:frame.id,iterationGroup,iterationIndex:i,
     bindings,sentence,normalizedSha256:sha(normalizedExposureSentenceV1(sentence)),correctnessOrExpectedGradeAssigned:false};
   });
   check(generated.length+expanded.length<=5000,'TOTAL_BOUND');
   classified.push({...base,classification:'finite-English-test-text',loopOrigin,iterableOrigin,bindings:names,rows,expansionCount:expanded.length});
   generated.push(...expanded);
  }catch(e){
   check(/^(?:CPT1|PT1)_[A-Z0-9_]+$/.test(e?.message??''),'UNEXPECTED_FAILURE');
   const held={...base,classification:'unresolved-template',reason:e.message,expansionCount:0};
   classified.push(held);unresolved.push(held);
  }
 }
 const surfaces=[...new Map(generated.map(g=>[g.normalizedSha256,{normalizedSha256:g.normalizedSha256,sentence:g.sentence}])).values()]
  .sort((a,b)=>a.normalizedSha256.localeCompare(b.normalizedSha256));
 const basis={protocol:CURRENT_PROGRAM_TEMPLATES_V1,scope:'Current selected sentence-like test template expressions only; syntax/data derivation, not all program inputs or structural-family independence.',
  auditHash:audit.sha256,sourceBindings:{...Object.fromEntries([...new Set(frames.map(f=>f.sourceFile))].map(f=>[f,sha(sourceTexts[f])])),[mannerFile]:sha(mannerSource)},
  classifiedTemplates:classified,generated,surfaces,unresolved,
  counts:{candidateTemplates:frames.length,englishTemplates:classified.filter(x=>x.classification==='finite-English-test-text').length,
   excludedSqlTemplates:classified.filter(x=>x.classification==='verified-sql-statement').length,
   excludedUiTemplates:classified.filter(x=>x.classification==='verified-korean-ui-guidance').length,
   unresolvedTemplates:unresolved.length,adjectiveValues:manner.values.length,
   loopGroups:new Set(generated.map(g=>g.iterationGroup)).size,generatedOccurrences:generated.length,uniqueGeneratedSurfaces:surfaces.length},
  completeForSelectedCandidateFrames:unresolved.length===0,sourceExecutionPerformed:false,allProgramGeneratedInputsEnumerated:false,
  completeProjectExposure:false,structuralFamiliesCertified:false,referenceQualified:false,mainDispatchAuthorized:false,
  actualProviderCalls:0,actualCountCalls:0,actualKeyReads:0};
 return {...basis,sha256:sha(JSON.stringify(basis))};
}
export function loadCurrentProgramTemplatesV1(){
 const here=fileURLToPath(new URL('../..',import.meta.url)),m=read(resolve(here,'.taskmaster/docs/ai-quality-v147-manifest.json'));
 const src=resolve(m.baseline.sourceRoot),root=resolve(m.baseline.existingDashboardRoot);
 const auditRaw=readFileSync(resolve(root,auditFile));check(sha(auditRaw)===auditSha,'FROZEN_AUDIT');
 const audit=JSON.parse(auditRaw),frozenFile='outputs/ai-quality-v147-implementation-20261106/phase168/rebuild-source.json',
  frozen=read(resolve(root,frozenFile)),wanted=new Set(audit.files.filter(f=>f.templates.length).map(f=>f.sourceFile)),sourceTexts={};
 function bound(file,expected){
  const path=resolve(src,file),st=lstatSync(path);
  check(st.isFile()&&!st.isSymbolicLink()&&realpathSync(path)===path,'SOURCE_PATH');
  const raw=readFileSync(path);check(sha(raw)===expected,'CURRENT_SOURCE_CHANGED');return raw;
 }
 for(const[f,h]of Object.entries(audit.sourceBindings)){const raw=bound(f,h);if(wanted.has(f))sourceTexts[f]=raw.toString('utf8');}
 const manner=bound(mannerFile,frozen.sourceFiles[mannerFile]),words=bound(wordsFile,frozen.sourceFiles[wordsFile]);
 const result=buildCurrentProgramTemplatesV1({audit,sourceTexts,mannerSource:manner.toString('utf8'),wordRows:JSON.parse(words)});
 return {result,auditFile,auditFileSha256:auditSha,frozenFile,frozenFileSha256:sha(readFileSync(resolve(root,frozenFile))),
  additionalSourceBindings:{[wordsFile]:sha(words)},sourceRoot:src,dashboardRoot:root,sourceTexts};
}

export function extendCurrentProgramIndexV1({baseIndex,expansion,additionalSourceBindings={}}){
 const base=structuredClone(baseIndex),oldHash=base.sha256;delete base.sha256;
 const expanded=structuredClone(expansion),expandedHash=expanded.sha256;delete expanded.sha256;
 check(sha(JSON.stringify(base))===oldHash&&base.protocol==='ai-quality-v147-current-program-exposure-snapshot-v1','BASE_INDEX');
 check(sha(JSON.stringify(expanded))===expandedHash&&expanded.protocol===CURRENT_PROGRAM_TEMPLATES_V1,'EXPANSION_BINDING');
 for(const[f,h]of Object.entries(expanded.sourceBindings))if(Object.hasOwn(base.sourceBindings,f))check(base.sourceBindings[f]===h,'INDEX_SOURCE');
 const entries=new Map(base.entries.map(e=>[e.normalizedSha256,e]));let added=0;
 for(const g of expanded.generated){
  if(!entries.has(g.normalizedSha256)){entries.set(g.normalizedSha256,{normalizedSha256:g.normalizedSha256,origins:[]});added++;}
  const entry=entries.get(g.normalizedSha256);let origin=entry.origins.find(o=>o.kind==='current-program-finite-template');
  if(!origin){origin={kind:'current-program-finite-template',ids:[]};entry.origins.push(origin);}origin.ids.push(g.id);
 }
 base.phase='phase189';base.parentIndexHash=oldHash;base.currentFiniteExpansionHash=expandedHash;
 base.finiteSourceBindings={...expanded.sourceBindings,...additionalSourceBindings};
 base.entries=[...entries.values()].sort((a,b)=>a.normalizedSha256.localeCompare(b.normalizedSha256));
 Object.assign(base.counts,{currentUnexpandedTemplates:expanded.counts.unresolvedTemplates,currentFiniteGeneratedOccurrences:expanded.generated.length,
  currentFiniteUniqueSurfaces:expanded.surfaces.length,newUniqueFiniteSurfaces:added,combinedUniqueSurfaces:base.entries.length});
 base.completeForSelectedTestTemplates=expanded.completeForSelectedCandidateFrames;
 // Dynamic helpers, noncandidate expressions and structural families remain outside this finite audit.
 base.allDynamicInputsEnumerated=false;base.completeProjectExposure=false;base.structuralFamiliesCertified=false;
 base.referenceQualified=false;base.mainDispatchAuthorized=false;
 return {...base,sha256:sha(JSON.stringify(base))};
}


"use client";
import { Volume2, ExternalLink, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dictionaryUrl,koreanDictionaryUrl } from "@/lib/catalog-basics";
import { LEVELS, type Level } from "@/lib/learning";
import { speakOnDevice, type DeviceSpeechState } from "@/lib/device-speech";
import { HelpDetails } from './study-ui';
export function LevelSelect({value,onChange,disabled=false}:{value:Level;onChange:(v:Level)=>void;disabled?:boolean}){return <Select value={value} onValueChange={v=>onChange(v as Level)} disabled={disabled}><SelectTrigger aria-label="학습 수준" className="level-select"><SelectValue/></SelectTrigger><SelectContent>{LEVELS.map(l=><SelectItem key={l} value={l}>{l} · {l==="A1"?"시작":l==="A2"?"기초":l==="B1"?"중급":"중상급"}</SelectItem>)}</SelectContent></Select>}
export function Speak({text,dictionaryHref,showHelpInitially=false}:{text:string;dictionaryHref?:string;showHelpInitially?:boolean}) {
  const [state,setState] = useState<DeviceSpeechState & {text:string}>({status:'idle',message:'',text});
  const [attemptedText,setAttemptedText] = useState<string | undefined>(undefined);
  const playback = useRef<{text:string;stop:()=>void} | undefined>(undefined);
  useEffect(() => () => { if(playback.current?.text===text) playback.current.stop(); }, [text]);
  const status = state.text===text ? state.status : 'idle';
  const dictionary = dictionaryHref ?? (/^[a-z]+(?:[' -][a-z]+)?$/i.test(text) ? dictionaryUrl(text) : undefined);
  const message = status==='starting' ? '음성 준비 중' : status==='speaking' ? '재생 중' : status==='error' ? state.message : '';
  function speak() {
    setAttemptedText(text);
    playback.current = {text,stop:speakOnDevice(text,next => setState({...next,text}))};
  }
  return <div className="speak-wrap">
    <div className="audio-controls">
      <button type="button" className="secondary-button device-audio" aria-label={`${text} 기기 음성 듣기`} onClick={speak}><Volume2 size={18} aria-hidden="true"/><span>기기 음성 듣기</span></button>
      {dictionary&&<a className="audio-dictionary" href={dictionary} target="_blank" rel="noreferrer">사전 발음 <ExternalLink size={13} aria-hidden="true"/></a>}
      <span className="audio-message" data-state={status} role="status">{message}</span>
    </div>
    {(showHelpInitially||attemptedText===text)&&<HelpDetails title="음성 도움말" className="audio-help">
      <p>볼륨·무음 설정과 이어폰 연결을 확인하세요.</p>
      <p>앱에서 소리가 없으면 Safari 또는 Chrome으로 열어 보세요.</p>
      <p>기기 음성은 사전 발음과 다를 수 있어요.</p>
    </HelpDetails>}
  </div>;
}
export function DictionaryLinks({word}:{word:string}){return <div className="dictionary-links"><a href={dictionaryUrl(word)} target="_blank" rel="noreferrer">Oxford 발음·용례 <ExternalLink size={13}/></a><a href={koreanDictionaryUrl(word)} target="_blank" rel="noreferrer">영한사전 <ExternalLink size={13}/></a></div>}
export function download(name:string,body:string,type='application/json'){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function Clock({seconds,paused,onToggle,disabled=false}:{seconds:number;paused:boolean;onToggle:()=>void;disabled?:boolean}){return <button className="timer" disabled={disabled} onClick={onToggle} aria-label={paused?'타이머 계속':'타이머 일시 정지'}>{paused?<Play size={15}/>:<Pause size={15}/>}<span>{Math.floor(seconds/60).toString().padStart(2,'0')}:{(seconds%60).toString().padStart(2,'0')}</span><span className="muted">/ 15:00</span></button>}

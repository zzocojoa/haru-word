"use client";
import { Volume2, ExternalLink, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dictionaryUrl,koreanDictionaryUrl } from "@/lib/catalog";
import { LEVELS, type Level } from "@/lib/learning";
import { speakOnDevice, type DeviceSpeechState } from "@/lib/device-speech";
export function LevelSelect({value,onChange,disabled=false}:{value:Level;onChange:(v:Level)=>void;disabled?:boolean}){return <Select value={value} onValueChange={v=>onChange(v as Level)} disabled={disabled}><SelectTrigger aria-label="학습 수준" className="level-select"><SelectValue/></SelectTrigger><SelectContent>{LEVELS.map(l=><SelectItem key={l} value={l}>{l} · {l==="A1"?"시작":l==="A2"?"기초":l==="B1"?"중급":"중상급"}</SelectItem>)}</SelectContent></Select>}
export function Speak({text}:{text:string}) {
  const [state,setState] = useState<DeviceSpeechState & {text:string}>({status:'idle',message:'',text});
  const [attemptedText,setAttemptedText] = useState<string | undefined>(undefined);
  const playback = useRef<{text:string;stop:()=>void} | undefined>(undefined);
  useEffect(() => () => { if(playback.current?.text===text) playback.current.stop(); }, [text]);
  function speak() {
    setAttemptedText(text);
    playback.current = {text,stop:speakOnDevice(text,next => setState({...next,text}))};
  }
  return <span className="speak-wrap">
    <button type="button" className="secondary-button device-audio" aria-label={`${text} 기기 음성 듣기`} onClick={speak}><Volume2 size={20}/><span>기기 음성 듣기</span></button>
    {state.text===text&&state.message&&<span className="audio-message" role="status">{state.message}</span>}
    {attemptedText===text&&<span className="audio-help">소리가 없으면 볼륨·무음 설정과 연결된 이어폰을 확인해 주세요. 앱 안에서는 Safari 또는 Chrome으로 열어 보세요.{/^[a-z]+(?:[' -][a-z]+)?$/i.test(text)&&<> <a href={dictionaryUrl(text)} target="_blank" rel="noreferrer">사전 발음 듣기</a></>}</span>}
  </span>;
}
export function DictionaryLinks({word}:{word:string}){return <div className="dictionary-links"><a href={dictionaryUrl(word)} target="_blank" rel="noreferrer">Oxford 발음·용례 <ExternalLink size={13}/></a><a href={koreanDictionaryUrl(word)} target="_blank" rel="noreferrer">영한사전 <ExternalLink size={13}/></a></div>}
export function download(name:string,body:string,type='application/json'){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function Clock({seconds,paused,onToggle,disabled=false}:{seconds:number;paused:boolean;onToggle:()=>void;disabled?:boolean}){return <button className="timer" disabled={disabled} onClick={onToggle} aria-label={paused?'타이머 계속':'타이머 일시 정지'}>{paused?<Play size={15}/>:<Pause size={15}/>}<span>{Math.floor(seconds/60).toString().padStart(2,'0')}:{(seconds%60).toString().padStart(2,'0')}</span><span className="muted">/ 15:00</span></button>}

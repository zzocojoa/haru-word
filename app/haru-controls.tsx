'use client';
import {useRef, type ComponentProps, type MouseEvent, type ChangeEventHandler, type ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Selector} from '@astryxdesign/core/Selector';
import {Banner} from '@astryxdesign/core/Banner';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Text} from '@astryxdesign/core/Text';

type ActionHandler = (event: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
function useActionGate(blocked: boolean, action?: ActionHandler) {
  const pending = useRef(false);
  return async (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked || pending.current) {event.preventDefault(); event.stopPropagation(); return;}
    pending.current = true;
    try {await action?.(event);} finally {pending.current = false;}
  };
}
type ActionState = {disabled?: boolean; busy?: boolean; onClick?: ActionHandler};
export type HaruButtonProps = Omit<ComponentProps<typeof Button>, 'isDisabled'|'isLoading'|'isInterruptible'|'clickAction'|'onClick'> & ActionState & {lang?:string};
export function HaruButton({disabled=false,busy=false,onClick,className='',variant='secondary',...props}:HaruButtonProps) {
  const blocked=disabled||busy||props['aria-disabled']===true||props['aria-disabled']==='true';
  const click=useActionGate(blocked,onClick);
  return <Button {...props} className={`haru-action ${variant==='primary'?'primary-button':variant==='ghost'?'text-button':'secondary-button'} ${className}`}
    variant={variant} isDisabled={disabled} isLoading={busy} onClick={click} />;
}
export function HaruIconButton({disabled=false,busy=false,onClick,className='',...props}:
  Omit<ComponentProps<typeof IconButton>,'isDisabled'|'isLoading'|'isInterruptible'|'clickAction'|'onClick'> & ActionState) {
  const click=useActionGate(disabled||busy||props['aria-disabled']===true||props['aria-disabled']==='true',onClick);
  return <IconButton {...props} className={`haru-icon-action icon-button ${className}`} isDisabled={disabled} isLoading={busy} onClick={click} />;
}

type InputProps=Omit<ComponentProps<typeof TextInput>,'onChange'|'changeAction'|'isDisabled'|'isReadOnly'|'isRequired'|'htmlName'> & {
  disabled?:boolean;readOnly?:boolean;required?:boolean;name?:string;maxLength?:number;lang?:string;form?:string;onChange?:ChangeEventHandler<HTMLInputElement>;
};
export function HaruTextInput({disabled=false,readOnly=false,required=false,name,maxLength,lang,form,onChange,containerClassName='',controlClassName='',...props}:InputProps) {
  return <TextInput {...props} {...{required,maxLength,lang,form}} htmlName={name} isDisabled={disabled} isReadOnly={readOnly} isRequired={required}
    aria-label={props['aria-label']??(typeof props.label==='string'?props.label:undefined)}
    containerClassName={`haru-field ${containerClassName}`} controlClassName={`haru-field-control ${controlClassName}`}
    onChange={(_value,event)=>onChange?.(event)} />;
}
type AreaProps=Omit<ComponentProps<typeof TextArea>,'onChange'|'changeAction'|'isDisabled'|'isReadOnly'|'isRequired'|'htmlName'|'maxLength'|'htmlMaxLength'> & {
  disabled?:boolean;readOnly?:boolean;required?:boolean;name?:string;maxLength?:number;lang?:string;form?:string;onChange?:ChangeEventHandler<HTMLTextAreaElement>;
};
export function HaruTextArea({disabled=false,readOnly=false,required=false,name,maxLength,lang,form,onChange,containerClassName='',controlClassName='',...props}:AreaProps) {
  // Preserve native UTF-16 maxlength; Core's maxLength is a soft grapheme counter.
  return <TextArea {...props} {...{required,lang,form}} htmlName={name} isDisabled={disabled} isReadOnly={readOnly} isRequired={required} htmlMaxLength={maxLength}
    aria-label={props['aria-label']??(typeof props.label==='string'?props.label:undefined)}
    containerClassName={`haru-field ${containerClassName}`} controlClassName={`haru-field-control ${controlClassName}`}
    onChange={(_value,event)=>onChange?.(event)} />;
}
export function HaruSelector({disabled=false,readOnly=false,name,containerClassName='',controlClassName='',...props}:
  Omit<ComponentProps<typeof Selector>,'isDisabled'|'isReadOnly'|'htmlName'|'changeAction'|'hasClear'|'value'|'onChange'> & {disabled?:boolean;readOnly?:boolean;name?:string;value:string;onChange?:(value:string)=>void}) {
  return <Selector {...props} hasClear={false} htmlName={name} isDisabled={disabled} isReadOnly={readOnly}
    containerClassName={`haru-field ${containerClassName}`} controlClassName={`haru-field-control ${controlClassName}`} />;
}

export function HaruNotice({title,children,className='',status,role,icon=<></>,...props}:Omit<ComponentProps<typeof Banner>,'collapsible'|'isDismissable'>) {
  return <Banner {...props} icon={icon} status={status} role={role??(status==='error'?'alert':undefined)} title={<Text type="inherit" color="inherit" className="haru-notice-title">{title}</Text>}
    className={`haru-notice ${className}`} collapsible={false} isDismissable={false}>{children}</Banner>;
}
export function HaruProgress({value,max=100,label,'aria-label':ariaLabel,className='',...props}:{value?:number|null;max?:number;label?:string;'aria-label'?:string;className?:string}) {
  return <ProgressBar {...props} label={label??ariaLabel??'진행률'} value={value??0} max={max} isLabelHidden
    variant="neutral" data-slot="progress" className={`haru-progress ${className}`} />;
}
export function HaruStatus({className='',children,...props}:{className?:string;children:ReactNode}) {
  // State labels need wrapping text, not the counting Badge's single-line ellipsis.
  return <Text {...props} type="inherit" color="inherit" className={`haru-status ${className}`}>{children}</Text>;
}

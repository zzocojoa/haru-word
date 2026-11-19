'use client';
import {useId,type ComponentProps} from 'react';
import {Stack} from '@astryxdesign/core/Layout';
import {HaruTextArea} from '../haru-controls';

/** Preserve the editor's native label/inline control flow without private Field selectors. */
export function EditorTextArea({label,id,containerClassName='',...props}:Omit<ComponentProps<typeof HaruTextArea>,'isLabelHidden'>){
  const generated=useId(),inputId=id??generated;
  return <Stack direction="vertical" gap={0} padding={0} className="haru-editor-area">
    <label htmlFor={inputId}>{label}</label>
    <HaruTextArea {...props} id={inputId} label={label} isLabelHidden containerClassName={`haru-editor-area-control ${containerClassName}`}/>
  </Stack>;
}
